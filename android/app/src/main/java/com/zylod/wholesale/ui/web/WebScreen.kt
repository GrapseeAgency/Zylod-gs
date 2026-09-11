package com.zylod.wholesale.ui.web

import android.net.Uri
import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.zylod.wholesale.bridge.WebViewHost
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Registry for the WebView the Compose shell is currently showing. Lets the
 * host activity route bridge calls (evaluateJavascript, cache clearing) to the
 * topmost embedded WebView. The pooled shell that is checked out last wins —
 * matching user-visible stacking.
 */
object NativeWebRegistry {
    @Volatile
    internal var webView: android.webkit.WebView? = null
}

/**
 * Web→native PAGE-CHANGE ACK fan-out (round-4: one navigation authority).
 * [com.zylod.wholesale.bridge.WebAppBridge.onPageChanged] posts acks here;
 * the ack is delivered to the BUSY shell that owns the registry's topmost
 * WebView via its [WebShellHandle.onPageChanged] — no global listener, no
 * dispose race between screens. Acks are advisory (an older deployed web
 * bundle emits none) — every consumer keeps a bundle-independent fallback.
 */
object NativeWebPageAcks {
    fun dispatch(webView: android.webkit.WebView?, pageId: String) {
        webView ?: return
        NativeWebViewPool.handleFor(webView)?.onPageChanged?.invoke(pageId)
    }
}

/**
 * Reload channel between the host activity and the screens: a settings-driven
 * server change bumps [reloadTick] (optionally with a new base). The error
 * channel that used to live here is GONE — main-frame failures are per-screen
 * now; the old global tick made every future screen show the error state
 * after one transient failure (owner audit finding #2).
 */
object NativeWebBus {
    var reloadTick by mutableIntStateOf(0)
        private set
    internal var pendingBase: String? = null

    fun requestReload(newBase: String? = null) {
        pendingBase = newBase
        reloadTick++
    }
}

/**
 * WebView shell for Tier 3 pageIds inside the Compose navigation.
 *
 * Round-4 audit contract (owner: "one authoritative navigation controller",
 * "loading must also have one owner"):
 *
 *  ── ROUTE OWNERSHIP ────────────────────────────────────────────────────
 *  This screen is ONLY reachable for pageIds that [com.zylod.wholesale.ui.nav.
 *  RouteOwnership] resolved to WEBVIEW. It never decides what "home" or any
 *  native surface means, and the native bar never renders a WebView page —
 *  one resolver, one owner per pageId.
 *
 *  ── LIVE STATE, NOT BOOKKEEPING ────────────────────────────────────────
 *  Restore-in-place (Back out of a native PDP) is decided by probing the
 *  SPA's LIVE page state (`window.__zylodCurrentPage` + params, mirrored by
 *  the web navigation store) — never by remembered "last requested" values,
 *  which could drift from what the WebView actually renders (drifted
 *  bookkeeping is exactly how a Profile route ended up painting Home).
 *  Unknown/diverged state degrades to driving the SPA (soft-navigate, then
 *  full deep-link load) — the safe direction.
 *
 *  ── STALE PIXELS ARE FORBIDDEN ─────────────────────────────────────────
 *  While a route change is in flight the previous page's pixels are
 *  suppressed (alpha 0 over the theme background); they return only when
 *  the SPA acks the new page (`onPageChanged`), the soft-navigate result
 *  confirms the store consumed it, or a full document load finishes —
 *  whichever lands first (three independent lift paths, so an older
 *  deployed web bundle without the ack hook still works).
 *
 *  ── ONE LOADING OWNER ──────────────────────────────────────────────────
 *  WebView surfaces are loaded by the WEB's own loading UI only. The shell
 *  paints NO spinner while a WebView is attached (the old native spinner
 *  over the SPA's own spinner was the "two loading systems" defect, and a
 *  soft-navigate that was never accounted for spun forever into a false
 *  error). The ONLY native loading surface is the pre-web bootstrap (server
 *  discovery / first checkout — no web content exists to own loading yet).
 *  Every load is bounded by a 20 s watchdog and terminates in
 *  success / (web-rendered) content / error + retry — never an indefinite
 *  spinner.
 *
 *  Capability parity: same settings, same JS bridges (ZylodNativeBridge /
 *  ZylodDownload), same clients (external-scheme routing, ngrok interstitial
 *  bypass, JS dialogs, console, file chooser, getUserMedia, downloads,
 *  __IS_OFFLINE__ injection) and an explicit unreachable-server error state
 *  with Retry.
 */
@Composable
fun WebScreen(pageId: String, query: String) {
    // Frame/jank attribution for the owner's Compose-vs-WebView comparison —
    // "web:<pageId>" pairs with "native:home" on the same FrameMetrics
    // pipeline (round-4: measure BEFORE optimizing).
    com.zylod.wholesale.ui.components.SurfacePerfTag("web:$pageId")
    val context = LocalContext.current
    val host = context as? WebViewHost
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf(ServerConfig.cached(context)) }
    var resolving by remember { mutableStateOf(baseUrl == null) }
    var pageError by remember { mutableStateOf(false) }
    // Drives the watchdog only (bounds every load attempt). The UI NEVER
    // paints a native spinner from this while a WebView is attached.
    var pageLoading by remember { mutableStateOf(true) }
    // Stale-pixel suppression: true from the moment a route change starts
    // until the SPA confirms the new page (ack / soft-nav ok / load finished).
    var suppressContent by remember { mutableStateOf(false) }
    var manualReload by remember { mutableIntStateOf(0) }
    var lastHandledReload by remember { mutableIntStateOf(0) }
    var shell by remember { mutableStateOf<NativeWebViewPool.Shell?>(null) }
    // Generation counter: bumped on every load/soft-nav attempt so the
    // watchdog can tell a stale timer from the active one.
    var loadGen by remember { mutableIntStateOf(0) }

    // ── Back contract (one navigation system) ─────────────────────────────
    // Hardware Back pops the NATIVE stack — deliberately NOT WebView history.
    // The native back stack IS the navigation truth; the SPA's own in-page
    // back affordances keep working inside the page.

    // Initial backend discovery only when no cached winner exists.
    LaunchedEffect(Unit) {
        if (baseUrl == null) {
            baseUrl = runCatching { ServerConfig.resolve(context) }.getOrNull()
        }
        resolving = false
    }

    val reloadTick = NativeWebBus.reloadTick
    LaunchedEffect(baseUrl, pageId, query, reloadTick, manualReload) {
        val pending = NativeWebBus.pendingBase
        if (pending != null) {
            baseUrl = pending
            NativeWebBus.pendingBase = null
        }
        val base = baseUrl ?: return@LaunchedEffect
        pageError = false

        val forceReload = manualReload != lastHandledReload
        if (forceReload) lastHandledReload = manualReload

        val current = shell
        if (current != null && current.baseUrl != base) {
            // Server switched underneath us — drop the old shell entirely.
            NativeWebViewPool.checkIn(current)
            if (NativeWebRegistry.webView === current.webView) NativeWebRegistry.webView = null
            shell = null
        }

        // `?page=<id>` contract; the id and every query VALUE are URL-encoded (D10).
        val target = base.trimEnd('/') + "/?page=" + Uri.encode(pageId) +
            (if (query.isNotBlank()) "&" + encodeQueryValues(query) else "")

        val active = shell
        if (active == null) {
            pageLoading = true
            loadGen++
            val checkedOut = NativeWebViewPool.checkOut(context, host, base)
            checkedOut.handle.onPageFinished = {
                pageError = false
                pageLoading = false
                suppressContent = false
                NativeWebRegistry.webView = checkedOut.webView
            }
            checkedOut.handle.onMainFrameError = {
                pageError = true
                pageLoading = false
            }
            checkedOut.handle.onPageChanged = { acked ->
                if (acked == pageId) {
                    pageLoading = false
                    suppressContent = false
                }
            }
            shell = checkedOut
            NativeWebRegistry.webView = checkedOut.webView
            checkedOut.webView.onResume()
            if (forceReload) {
                suppressContent = true
                checkedOut.webView.loadUrl(target)
                checkedOut.lastPageId = pageId
                checkedOut.lastQuery = query
            } else {
                navigateShell(
                    shell = checkedOut,
                    pageId = pageId,
                    query = query,
                    onDriving = { suppressContent = true; pageLoading = true },
                    onInPlace = { suppressContent = false; pageLoading = false },
                    onSoftOk = { suppressContent = false; pageLoading = false },
                    onFallback = {
                        // Full deep-link load: onPageFinished lifts
                        // suppression + loading (ack also may, first).
                        suppressContent = true
                        checkedOut.webView.loadUrl(target)
                        checkedOut.lastPageId = pageId
                        checkedOut.lastQuery = query
                    },
                )
            }
        } else {
            active.webView.onResume()
            active.handle.onPageChanged = { acked ->
                if (acked == pageId) {
                    pageLoading = false
                    suppressContent = false
                }
            }
            if (forceReload) {
                // Retry (or settings-driven reload): a hard reload of the
                // target — the previous attempt is presumed broken, so the
                // restore/soft-nav fast paths are explicitly bypassed.
                pageLoading = true
                suppressContent = true
                loadGen++
                active.webView.loadUrl(target)
                active.lastPageId = pageId
                active.lastQuery = query
            } else {
                navigateShell(
                    shell = active,
                    pageId = pageId,
                    query = query,
                    onDriving = { suppressContent = true; pageLoading = true },
                    onInPlace = { suppressContent = false; pageLoading = false; pageError = false },
                    onSoftOk = { suppressContent = false; pageLoading = false },
                    onFallback = {
                        // Full deep-link load (re-seed first: the shell may
                        // have been re-seeded at checkout with a rotated
                        // token while the loaded document predates it).
                        suppressContent = true
                        com.zylod.wholesale.session.WebAuthSeeder.install(active.webView, baseUrl ?: base, context)
                        active.webView.loadUrl(target)
                        active.lastPageId = pageId
                        active.lastQuery = query
                    },
                )
            }
        }
    }

    // Bounded loading: any load that hasn't settled in 20 s becomes an
    // explicit error with Retry — never an indefinite spinner.
    LaunchedEffect(shell, loadGen) {
        if (pageLoading) {
            delay(20_000)
            if (pageLoading) {
                pageError = true
                pageLoading = false
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        if (pageError) {
            WebErrorState(
                message = "The server isn't responding. Check your connection and try again.",
                onRetry = {
                    if (!resolving) {
                        resolving = true
                        pageError = false
                        scope.launch {
                            val fresh = runCatching { ServerConfig.resolve(context) }.getOrNull()
                            resolving = false
                            if (fresh != null && fresh != baseUrl) {
                                // New winner: the effect re-runs on baseUrl,
                                // drops the incompatible shell, and hard-loads
                                // the target on a fresh checkout.
                                baseUrl = fresh
                            } else {
                                // Same host: force a hard reload (the effect's
                                // forceReload branch) — NEVER a silent no-op.
                                manualReload++
                            }
                        }
                    }
                },
            )
        } else {
            // Keyed on the checked-out shell: the AndroidView factory re-runs
            // when the pool hands us a (possibly different) WebView. Shell
            // OWNERSHIP is explicit below — AndroidView only attaches views.
            //
            // LOADING OWNERSHIP: no native spinner here, ever. While content
            // is attached the WEB surface owns its own loading UI; the shell
            // only suppresses the PREVIOUS page's stale pixels during a
            // transition (alpha 0 over the theme background). The bootstrap
            // spinner below exists only while NO shell is attached (pre-web).
            key(shell?.webView) {
                val current = shell?.webView
                AndroidView(
                    factory = { _ ->
                        (current as? android.webkit.WebView)?.also { attached ->
                            (attached.parent as? ViewGroup)?.removeView(attached)
                            attached.onResume()
                        } ?: android.view.View(context)
                    },
                    onRelease = { view ->
                        if (NativeWebRegistry.webView === view) NativeWebRegistry.webView = null
                    },
                    update = { view ->
                        if (NativeWebRegistry.webView !== view && view is android.webkit.WebView) {
                            NativeWebRegistry.webView = view
                        }
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .alpha(if (suppressContent) 0f else 1f),
                )
            }
            if (shell == null && resolving) {
                // Bootstrap ONLY: no WebView exists yet (server discovery /
                // first checkout) — the one native loading surface, with no
                // web content present to compete with. Every load AFTER the
                // shell exists is owned by the web's own loading UI.
                CircularProgressIndicator()
            }
        }
    }

    // Shell ownership: whenever this screen stops hosting a shell (leaves
    // composition, or the shell is swapped), return it to the pool PAUSED —
    // never destroyed — so the next checkout re-attaches instantly.
    DisposableEffect(shell) {
        val owned = shell
        onDispose {
            owned?.let { pooled ->
                NativeWebViewPool.checkIn(pooled)
                if (NativeWebRegistry.webView === pooled.webView) NativeWebRegistry.webView = null
            }
        }
    }
}

/**
 * The ONE shell-driving decision (used for both fresh checkouts and warm
 * re-attachments). Truth comes from the SPA's live state probe:
 *
 *  1. Probe `window.__zylodCurrentPage` + params. A page+params MATCH means
 *     the shell is already showing exactly the requested route — restore in
 *     place (Back out of a native PDP: instant re-attach, scroll kept).
 *     A probe that reports a DIFFERENT page is proof the old bookkeeping
 *     drifted (the Home-under-Profile class of bug) — drive the SPA.
 *  2. Soft-navigate (pushState + popstate, the store's own contract). The
 *     result verifies the store consumed the target; "ok" lifts suppression
 *     immediately (the SPA's own loading UI is now the loading owner).
 *  3. Fallback via [onFallback]: full deep-link `?page=` load (first load /
 *     stale bundle / rejected soft-nav). onPageFinished lifts suppression.
 */
private fun navigateShell(
    shell: NativeWebViewPool.Shell,
    pageId: String,
    query: String,
    onDriving: () -> Unit,
    onInPlace: () -> Unit,
    onSoftOk: () -> Unit,
    onFallback: () -> Unit,
) {
    onDriving()
    probeLivePage(shell) { live ->
        if (live != null && live.first == pageId && paramsMatch(live.second, query)) {
            // Live truth: the shell IS the requested page already.
            shell.lastPageId = pageId
            shell.lastQuery = query
            onInPlace()
            return@probeLivePage
        }
        NativeWebViewPool.softNavigate(shell, pageId, query) { ok ->
            if (ok) {
                shell.lastPageId = pageId
                shell.lastQuery = query
                onSoftOk()
            } else {
                onFallback()
            }
        }
    }
}

/**
 * Reads the SPA's LIVE page state. Returns (pageId, paramsMap) or null when
 * the SPA has not booted (fresh shell / stale cached bundle) — the caller
 * then drives a soft-navigate / full load. Runs on the WebView thread.
 */
private fun probeLivePage(
    shell: NativeWebViewPool.Shell,
    onResult: (Pair<String, Map<String, String>>?) -> Unit,
) {
    val script = """
        (function(){
          try{
            if (window.__zylodSpaReady !== true) return null;
            var page = window.__zylodCurrentPage;
            if (typeof page !== 'string') return null;
            var params = {};
            try { params = JSON.parse(window.__zylodCurrentParams || '{}') || {}; } catch (e) { params = {}; }
            return { page: page, params: params };
          }catch(e){ return null; }
        })();
    """.trimIndent()
    shell.webView.evaluateJavascript(script) { result ->
        val parsed = result?.let(::parseLivePageJson)
        android.os.Handler(android.os.Looper.getMainLooper()).post { onResult(parsed) }
    }
}

/** Minimal, exception-free parse of the probe's `{"page":..,"params":{..}}`. */
private fun parseLivePageJson(json: String): Pair<String, Map<String, String>>? {
    if (json == "null" || json.isBlank()) return null
    return try {
        val obj = org.json.JSONObject(json)
        val page = obj.optString("page", "")
        if (page.isEmpty()) return null
        val paramsObj = obj.optJSONObject("params")
        val params = mutableMapOf<String, String>()
        paramsObj?.let { o ->
            for (key in o.keys()) params[key] = o.optString(key, "")
        }
        page to params
    } catch (_: Exception) {
        null
    }
}

/** Compares the SPA's live params map against the requested query string. */
private fun paramsMatch(live: Map<String, String>, query: String): Boolean {
    val expected = mutableMapOf<String, String>()
    if (query.isNotBlank()) {
        query.split('&').forEach { pair ->
            if (pair.isEmpty()) return@forEach
            val eq = pair.indexOf('=')
            val key = if (eq < 0) pair else pair.substring(0, eq)
            val value = if (eq < 0) "" else pair.substring(eq + 1)
            if (key.isNotEmpty()) expected[key] = Uri.decode(value)
        }
    }
    return live == expected
}

/** Encodes every VALUE segment of a preassembled query string (keeps '&' and '='). */
private fun encodeQueryValues(query: String): String =
    query.split('&').joinToString("&") { pair ->
        val eq = pair.indexOf('=')
        if (eq < 0) Uri.encode(pair)
        else pair.substring(0, eq + 1) + Uri.encode(pair.substring(eq + 1))
    }

/** Offline/error state for the WebView surface — same visual language as Home. */
@Composable
private fun WebErrorState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(44.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Can't reach Zylod",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(50),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier.fillMaxWidth(0.6f),
        ) {
            Text("Retry", fontWeight = FontWeight.SemiBold)
        }
    }
}
