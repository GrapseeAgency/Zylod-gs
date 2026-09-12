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
import androidx.compose.material.icons.outlined.VerifiedUser
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.bridge.WebViewHost
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.session.WebProvenance
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Registry for the WebView the Compose shell is currently showing. Lets the
 * host activity route bridge calls (evaluateJavascript, cache clearing) to the
 * topmost embedded WebView. The pooled shell that is checked out last wins —
 * matching user-visible stacking.
 *
 * F2/F3 scope note: this registry is used ONLY for host→web calls that must
 * reach the VISIBLE shell (scanner/voice callbacks, cache clearing). It is
 * never used for WEB→NATIVE routing — page-change acks travel from the exact
 * speaking WebView instance to its own shell handle (WebAppBridge carries its
 * own instance), and no callback path ever writes to this registry except the
 * AndroidView attachment below (the only attachment truth).
 */
object NativeWebRegistry {
    @Volatile
    internal var webView: android.webkit.WebView? = null
}

/**
 * Web→native PAGE-CHANGE ack fan-out (one navigation authority).
 * [com.zylod.wholesale.bridge.WebAppBridge.onPageChanged] posts acks here;
 * the ack is delivered to the BUSY shell that owns the SPEAKING WebView via
 * its [WebShellHandle.onPageChanged] — instance-true routing, no global
 * last-checked-out-shell lookup. The ack only TRIGGERS the authoritative
 * document verification — it is never the proof itself (F4).
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
 * WebView shell for pageIds inside the Compose navigation — every WEBVIEW
 * owned pageId, AND the home tab root (home → WEBVIEW, owner directive:
 * `ZylodRoot` composes `WebScreen(pageId = "home")` at `HOME_ROUTE`).
 *
 * Round-6 remediation contract (owner-mandated order F1/F2/F3/F4/F5):
 *
 *  ── ROUTE OWNERSHIP ────────────────────────────────────────────────────
 *  This screen is ONLY reachable for pageIds that [com.zylod.wholesale.ui.nav.
 *  RouteOwnership] resolved to WEBVIEW — including home, whose tab-root
 *  destination [RouteOwnership.Destination.Home] renders THIS screen with
 *  pageId "home". It never decides what any surface means, and the native
 *  bar never renders a page this resolver did not route —
 *  one resolver, one owner per pageId.
 *
 *  ── GENERATION-BOUND CALLBACKS (F2/F3) ─────────────────────────────────
 *  Every drive (checkout, route change, reload) bumps the shell's navigation
 *  generation FIRST. Every asynchronous callback — evaluateJavascript
 *  results, onPageFinished, main-frame errors, renderer crash, page-change
 *  acks, JS bridge callbacks — captures the generation it belongs to and is
 *  dropped unless the shell is still in that exact generation. No stale
 *  callback from a superseded navigation or a reused pooled shell may reveal
 *  or modify the current screen. Acks route from the SPEAKING WebView
 *  instance to its own handle (per-instance bridge) — never through a
 *  global "last checked-out shell".
 *
 *  ── AUTHORITATIVE ACKNOWLEDGEMENT (F4) ─────────────────────────────────
 *  pushState "ok" and onPageFinished are NEVER treated as proof of a
 *  successful navigation. A destination is revealed ONLY after the
 *  authoritative verification (WebShellScripts.documentVerifyScript) reports,
 *  for the CURRENT generation, that (a) the SPA consumed the page
 *  (__zylodSpaReady) and (b) the SPA's LIVE committed state
 *  (__zylodCurrentPage + params) equals the requested pageId+params. The
 *  verification is triggered by a matching page-change ack AND re-run on a
 *  750 ms poll, so a missed ack can only ever delay a reveal until the 20 s
 *  watchdog, never hang forever and never reveal wrong content.
 *
 *  ── RUNTIME PROVENANCE (F1/F5) ─────────────────────────────────────────
 *  The same verification reads the served bundle's identity
 *  (window.__ZylodBundleIdentity) and WebProvenance applies the acceptance
 *  policy: a bundle WITHOUT an identity is blocked on every build type; a
 *  bundle with the WRONG commit is blocked in release and surfaced in a
 *  visible diagnostics banner in debug. A wrong/stale/unknown bundle is
 *  therefore never silently rendered as if it were the app.
 *
 *  ── ONE LOADING OWNER ──────────────────────────────────────────────────
 *  WebView surfaces are loaded by the WEB's own loading UI only. The shell
 *  paints NO spinner while a WebView is attached. The ONLY native loading
 *  surface is the pre-web bootstrap (server discovery / first checkout).
 *  Every load is bounded by a 20 s watchdog and terminates in
 *  success / content / provenance gate / error + retry — never an indefinite
 *  spinner, never a silent failure.
 *
 *  ── STALE PIXELS ARE FORBIDDEN ─────────────────────────────────────────
 *  While a route change is in flight the previous page's pixels are
 *  suppressed (alpha 0 over the theme background) until the authoritative
 *  verification lifts them for the current generation.
 *
 * Capability parity: same settings, same JS bridges (ZylodNativeBridge /
 * ZylodDownload), same clients (external-scheme routing, ngrok interstitial
 * bypass, JS dialogs, console, file chooser, getUserMedia, downloads,
 * __IS_OFFLINE__ injection) and an explicit unreachable-server error state
 * with Retry.
 */
@Composable
fun WebScreen(pageId: String, query: String) {
    // Frame/jank attribution for every WebView-hosted page — INCLUDING home,
    // which is WebView-owned since the native-Home termination directive
    // (web:home; the retired native:home tag died with the quarantined
    // Compose Home). Harness untouched — measure BEFORE optimizing.
    com.zylod.wholesale.ui.components.SurfacePerfTag("web:$pageId")
    val context = LocalContext.current
    val host = context as? WebViewHost
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf(ServerConfig.cached(context)) }
    var resolving by remember { mutableStateOf(baseUrl == null) }
    var pageError by remember { mutableStateOf(false) }
    // Drives the watchdog/poll loop only. The UI NEVER paints a native
    // spinner from this while a WebView is attached.
    var pageLoading by remember { mutableStateOf(true) }
    // Stale-pixel suppression: true from the moment a route change starts
    // until the AUTHORITATIVE verification lifts it for the current generation.
    var suppressContent by remember { mutableStateOf(false) }
    // F1/F5: non-null → the provenance gate replaces the web content (release
    // mismatch / missing identity on ANY build type). Never a silent failure.
    var provenanceBlocked by remember { mutableStateOf<String?>(null) }
    // F1/F5 debug visibility: served identity differs from this build — shown,
    // not blocking (dev endpoints legitimately serve arbitrary commits).
    var debugProvenanceNote by remember { mutableStateOf<String?>(null) }
    var manualReload by remember { mutableIntStateOf(0) }
    var lastHandledReload by remember { mutableIntStateOf(0) }
    var shell by remember { mutableStateOf<NativeWebViewPool.Shell?>(null) }
    // Compose-visible mirror of the shell's navigation generation — re-keys
    // the verification poll/watchdog per drive.
    var loadGen by remember { mutableIntStateOf(0) }

    // ── Back contract (one navigation system) ─────────────────────────────
    // Hardware Back pops the NATIVE stack — deliberately NOT WebView history.

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
        provenanceBlocked = null
        debugProvenanceNote = null

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

        // Per-generation handler binding: state writes stay here in the
        // composition scope; generation guards live in bindShellHandlersImpl.
        fun bindShellHandlers(target: NativeWebViewPool.Shell, gen: Long) {
            bindShellHandlersImpl(
                shell = target,
                generation = gen,
                pageId = pageId,
                query = query,
                onError = { pageError = true; pageLoading = false },
                onProvenanceBlocked = { message ->
                    provenanceBlocked = message
                    pageLoading = false
                },
                onDebugNote = { note -> debugProvenanceNote = note },
                onRevealed = {
                    pageError = false
                    pageLoading = false
                    suppressContent = false
                },
            )
        }

        val active = shell
        if (active == null) {
            pageLoading = true
            suppressContent = true
            val checkedOut = NativeWebViewPool.checkOut(context, host, base)
            // F2: the NEW generation starts HERE — before any callback of this
            // drive can be scheduled — and every handler below captures it.
            val gen = checkedOut.bumpGeneration()
            loadGen = gen.toInt()
            bindShellHandlers(checkedOut, gen)
            shell = checkedOut
            // Checked-out-last-wins registry write happens in the SAME
            // main-thread turn as the checkout — no callback can interleave.
            NativeWebRegistry.webView = checkedOut.webView
            checkedOut.webView.onResume()
            if (forceReload) {
                checkedOut.webView.loadUrl(target, mapOf("ngrok-skip-browser-warning" to "1"))
                checkedOut.lastPageId = pageId
                checkedOut.lastQuery = query
            } else {
                navigateShell(checkedOut, pageId, query, gen, context)
            }
        } else {
            active.webView.onResume()
            val gen = active.bumpGeneration()
            loadGen = gen.toInt()
            bindShellHandlers(active, gen)
            if (forceReload) {
                // Retry (or settings-driven reload): a hard reload of the
                // target — the previous attempt is presumed broken, so the
                // restore/soft-nav fast paths are explicitly bypassed.
                pageLoading = true
                suppressContent = true
                active.webView.loadUrl(target, mapOf("ngrok-skip-browser-warning" to "1"))
                active.lastPageId = pageId
                active.lastQuery = query
            } else {
                pageLoading = true
                suppressContent = true
                navigateShell(active, pageId, query, gen, context)
            }
        }
    }

    // ── Verification poll + watchdog (bounded, per generation) ────────────
    // Every 750 ms the authoritative verification re-runs for the CURRENT
    // generation until the screen settles — a missed ack delays a reveal,
    // never hangs one. 20 s without settling = explicit error + retry.
    LaunchedEffect(shell, loadGen) {
        if (!pageLoading) return@LaunchedEffect
        val pooled = shell ?: return@LaunchedEffect
        val gen = pooled.generation()
        var waited = 0L
        while (waited < 20_000L) {
            delay(750)
            waited += 750
            // F2: a bump means a newer drive owns the shell — this loop dies.
            if (pooled.generation() != gen) return@LaunchedEffect
            if (!pageLoading) return@LaunchedEffect
            verifyDocument(pooled, gen, pageId, query)
        }
        if (pooled.generation() == gen && pageLoading) {
            pageError = true
            pageLoading = false
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        // F1: the provenance gate REPLACES the web content — a wrong/stale/
        // unknown bundle is never rendered as if it were the app.
        if (provenanceBlocked != null) {
            ProvenanceGate(
                message = provenanceBlocked.orEmpty(),
                onRetry = {
                    if (!resolving) {
                        manualReload++
                    }
                },
            )
        } else if (pageError) {
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
                // web content present to compete with.
                CircularProgressIndicator()
            }
            // F1/F5 debug visibility: the served bundle differs from this
            // build. Visible diagnostics, non-blocking (release blocks).
            if (debugProvenanceNote != null && BuildConfig.DEBUG) {
                Text(
                    debugProvenanceNote.orEmpty(),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
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
 * Assigns the per-generation event handlers on a checked-out shell. EVERY
 * closure captures [generation] and drops itself when the shell has moved on
 * (F2: no stale onPageFinished / error / ack may reveal or modify the current
 * screen). All state writes go through the shell's handle so the top-level
 * verification stays screen-agnostic.
 */
private fun bindShellHandlersImpl(
    shell: NativeWebViewPool.Shell,
    generation: Long,
    pageId: String,
    query: String,
    onError: () -> Unit,
    onProvenanceBlocked: (String) -> Unit,
    onDebugNote: (String?) -> Unit,
    onRevealed: () -> Unit,
) {
    shell.handle.onPageFinished = {
        // Document finished loading. This is NOT a reveal: the authoritative
        // verification decides (F4). Stale generations drop out immediately.
        if (shell.generation() == generation) {
            verifyDocument(shell, generation, pageId, query)
        }
    }
    shell.handle.onMainFrameError = {
        if (shell.generation() == generation) onError()
    }
    shell.handle.onPageChanged = { acked ->
        // Matching ack only TRIGGERS the authoritative verification for THIS
        // generation (F4); non-matching acks are irrelevant to this screen.
        if (shell.generation() == generation && acked == pageId) {
            verifyDocument(shell, generation, pageId, query)
        }
    }
    shell.handle.onProvenanceBlocked = { message ->
        if (shell.generation() == generation) onProvenanceBlocked(message)
    }
    shell.handle.onDebugNote = { note ->
        if (shell.generation() == generation) onDebugNote(note)
    }
    shell.handle.onRevealed = {
        if (shell.generation() == generation) onRevealed()
    }
}

/**
 * THE authoritative verification (F1+F4). Reads the document's bundle
 * identity, contract readiness and LIVE committed page state in ONE round
 * trip, then applies:
 *
 *  - provenance policy (WebProvenance): missing identity → gate (every build
 *    type); wrong commit → gate in release, visible diagnostics note in
 *    debug;
 *  - reveal policy: identity OK + SPA ready + live page+params equal to the
 *    requested route → and ONLY then are stale pixels unsuppressed and the
 *    generation settled. pushState "ok" and onPageFinished never reveal.
 */
private fun verifyDocument(
    shell: NativeWebViewPool.Shell,
    generation: Long,
    pageId: String,
    query: String,
) {
    if (shell.generation() != generation) return
    val script = com.zylod.wholesale.session.WebShellScripts.documentVerifyScript()
    shell.webView.evaluateJavascript(script) { result ->
        // F2: drop stale verification results from a superseded generation.
        if (shell.generation() != generation) return@evaluateJavascript
        val state = parseVerifyResult(result)
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            if (shell.generation() != generation) return@post
            applyVerification(shell, generation, pageId, query, state)
        }
    }
}

private data class DocumentState(
    val identity: WebProvenance.BundleIdentity?,
    val spaReady: Boolean,
    val page: String?,
    val params: Map<String, String>,
)

private fun applyVerification(
    shell: NativeWebViewPool.Shell,
    generation: Long,
    pageId: String,
    query: String,
    state: DocumentState,
) {
    val endpoint = shell.baseUrl
    val verdict = WebProvenance.evaluate(state.identity, BuildConfig.DEBUG)
    WebProvenance.logServed(endpoint, verdict, BuildConfig.DEBUG)

    if (WebProvenance.blocking(verdict, BuildConfig.DEBUG)) {
        // F1: a wrong/stale/unknown bundle is NEVER silently rendered — the
        // gate replaces the content with the exact provenance divergence.
        val message = when (verdict) {
            is WebProvenance.Verdict.Mismatch ->
                "The server at ${endpoint} is serving web bundle ${verdict.identity.shortCommit}, " +
                    "but this app was built from ${verdict.expectedCommit}."
            else ->
                "The server at ${endpoint} did not identify itself as a Zylod web bundle " +
                    "(no bundle identity found)."
        }
        shell.handle.onProvenanceBlocked?.invoke(message)
        return
    }

    if (verdict is WebProvenance.Verdict.Mismatch) {
        // DEBUG-only: visible diagnostics, non-blocking.
        shell.handle.onDebugNote?.invoke(
            "DEV bundle ${verdict.identity.shortCommit} @ $endpoint (app: ${verdict.expectedCommit})",
        )
    } else {
        shell.handle.onDebugNote?.invoke(null)
    }

    // F4 reveal rule — actual committed pageId+params for THIS generation.
    val pageMatches = state.page == pageId
    val paramsMatches = paramsMatch(state.params, query)
    if (state.spaReady && pageMatches && paramsMatches) {
        shell.handle.onRevealed?.invoke()
    }
    // else: keep suppressed — the ack/poll loop re-verifies until the watchdog.
}

/**
 * The ONE shell-driving decision (fresh checkouts and warm re-attachments).
 * Truth comes from the SPA's live state probe:
 *
 *  1. Probe `window.__zylodCurrentPage` + params. A page+params MATCH means
 *     the shell is already showing exactly the requested route — go straight
 *     to the authoritative verification (which re-reads the live state and
 *     the bundle identity, then reveals). A probe that reports a DIFFERENT
 *     page proves the old bookkeeping drifted — drive the SPA.
 *  2. Soft-navigate (pushState + popstate, the store's own contract). The
 *     result verifies the store consumed the target — but does NOT reveal
 *     (F4): the matching page-change ack (or the poll) triggers the
 *     authoritative verification that lifts suppression.
 *  3. Fallback: full deep-link `?page=` load (first load / stale bundle /
 *     rejected soft-nav). onPageFinished triggers the same verification.
 *
 * Every step is generation-guarded (F2): a result from a superseded drive is
 * dropped before it can touch screen state.
 */
private fun navigateShell(
    shell: NativeWebViewPool.Shell,
    pageId: String,
    query: String,
    generation: Long,
    context: android.content.Context,
) {
    probeLivePage(shell) { live ->
        if (shell.generation() != generation) return@probeLivePage
        if (live != null && live.first == pageId && paramsMatch(live.second, query)) {
            // Live truth: the shell IS the requested page already.
            shell.lastPageId = pageId
            shell.lastQuery = query
            // Still revealed through the authoritative path (identity +
            // live state) — one extra round trip, no special case.
            verifyDocument(shell, generation, pageId, query)
            return@probeLivePage
        }
        NativeWebViewPool.softNavigate(shell, pageId, query, generation) { ok ->
            if (shell.generation() != generation) return@softNavigate
            if (ok) {
                shell.lastPageId = pageId
                shell.lastQuery = query
                // NO reveal here (F4): the ack/poll-driven verification lifts
                // suppression when the SPA's committed state matches.
            } else {
                // Full deep-link load (re-seed first: the shell may have been
                // re-seeded at checkout with a rotated token while the loaded
                // document predates it).
                com.zylod.wholesale.session.WebAuthSeeder.install(shell.webView, shell.baseUrl, context)
                val target = shell.baseUrl.trimEnd('/') + "/?page=" + Uri.encode(pageId) +
                    (if (query.isNotBlank()) "&" + encodeQueryValues(query) else "")
                shell.webView.loadUrl(target, mapOf("ngrok-skip-browser-warning" to "1"))
                shell.lastPageId = pageId
                shell.lastQuery = query
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

/** Exception-free parse of the verify script's JSON result string. */
private fun parseVerifyResult(json: String?): DocumentState {
    if (json == null || json == "null" || json.isBlank()) {
        return DocumentState(identity = null, spaReady = false, page = null, params = emptyMap())
    }
    return try {
        val obj = org.json.JSONObject(json)
        val identity = WebProvenance.parseIdentity(obj.optJSONObject("identity"))
        val paramsObj = obj.optJSONObject("params")
        val params = mutableMapOf<String, String>()
        paramsObj?.let { o ->
            for (key in o.keys()) params[key] = o.optString(key, "")
        }
        val page = obj.optString("page", "")
        DocumentState(
            identity = identity,
            spaReady = obj.optBoolean("spaReady", false),
            page = page.ifEmpty { null },
            params = params,
        )
    } catch (_: Exception) {
        DocumentState(identity = null, spaReady = false, page = null, params = emptyMap())
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

/**
 * F1 provenance gate — replaces web content when the served bundle fails the
 * acceptance policy. Shows the EXACT divergence (endpoint, served identity,
 * expected commit) so the failure is diagnosable from the screen itself.
 */
@Composable
private fun ProvenanceGate(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
    ) {
        Icon(
            Icons.Outlined.VerifiedUser,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(44.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Web bundle verification failed",
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
        Spacer(Modifier.height(8.dp))
        Text(
            "The app refused to display an unverified web bundle. Redeploy the matching web bundle and retry.",
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
