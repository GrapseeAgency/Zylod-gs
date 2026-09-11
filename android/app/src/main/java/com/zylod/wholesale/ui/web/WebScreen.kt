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
 * Phase 1 runtime-audit remediation (owner findings #1/#2/#3/#4):
 *
 *  - Pooled shell ([NativeWebViewPool]): navigating between Tier-3 pages no
 *    longer destroys and re-creates the WebView (no full SPA reload per
 *    navigation). Same-page returns (Back from a native PDP) re-attach
 *    instantly; pageId changes drive the hydrated SPA client-side via
 *    history.pushState + popstate, with a full `?page=` loadUrl only as the
 *    fallback (first load / SPA not ready / soft-nav rejected).
 *
 *  - Deterministic state machine per screen: loading → success / error+retry.
 *    Success is delivered by the shell's onPageFinished (previously the
 *    spinner never cleared — screens looked stuck forever). A 20 s watchdog
 *    bounds every load: a hung server can never spin indefinitely.
 *
 *  - Main-frame failures are per-screen callbacks (no global error broadcast).
 *
 *  - Duplicated web bottom navigation is suppressed at document-start by the
 *    shell's injected stylesheet ([com.zylod.wholesale.session.WebShellScripts]);
 *    the native Scaffold bottom bar is the only navigation chrome.
 *
 * Capability parity with the legacy shell: same settings, same JS bridges
 * (ZylodNativeBridge / ZylodDownload), same clients (external-scheme routing,
 * ngrok interstitial bypass, JS dialogs, console, file chooser, getUserMedia,
 * downloads, __IS_OFFLINE__ injection) and an explicit unreachable-server
 * error state with Retry.
 */
@Composable
fun WebScreen(pageId: String, query: String) {
    val context = LocalContext.current
    val host = context as? WebViewHost
    val scope = rememberCoroutineScope()
    var baseUrl by remember { mutableStateOf(ServerConfig.cached(context)) }
    var resolving by remember { mutableStateOf(baseUrl == null) }
    var pageError by remember { mutableStateOf(false) }
    var pageLoading by remember { mutableStateOf(true) }
    var manualReload by remember { mutableIntStateOf(0) }
    var shell by remember { mutableStateOf<NativeWebViewPool.Shell?>(null) }
    // Generation counter: bumped on every load/soft-nav attempt so the
    // watchdog can tell a stale timer from the active one.
    var loadGen by remember { mutableIntStateOf(0) }

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
                pageLoading = false
                NativeWebRegistry.webView = checkedOut.webView
            }
            checkedOut.handle.onMainFrameError = {
                pageError = true
                pageLoading = false
            }
            shell = checkedOut
            NativeWebRegistry.webView = checkedOut.webView
            checkedOut.webView.onResume()
            checkedOut.webView.loadUrl(target)
            checkedOut.lastUrl = target
        } else if (active.lastUrl == target && !pageError) {
            // Restore-in-place: the shell is already showing exactly this page
            // (e.g. Back from a native PDP) — re-attach with zero work.
            pageLoading = false
            loadGen++
            active.webView.onResume()
        } else {
            pageLoading = true
            loadGen++
            active.webView.onResume()
            // Fast path: client-side pageId navigation on the hydrated SPA.
            NativeWebViewPool.softNavigate(active, pageId, query) { ok ->
                if (ok) {
                    active.lastUrl = target
                    pageLoading = false
                } else {
                    // Fallback: full deep-link load (first load, stale bundle,
                    // or the SPA rejected the synthetic navigation).
                    com.zylod.wholesale.session.WebAuthSeeder.install(active.webView, base, context)
                    active.webView.loadUrl(target)
                    active.lastUrl = target
                }
            }
        }
    }

    // Bounded loading (finding #3): any load that hasn't settled in 20 s
    // becomes an explicit error with Retry — never an indefinite spinner.
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
                            if (fresh != null) baseUrl = fresh
                            resolving = false
                            manualReload++
                        }
                    }
                },
            )
        } else {
            // Keyed on the checked-out shell: the AndroidView factory re-runs
            // when the pool hands us a (possibly different) WebView. Shell
            // OWNERSHIP is explicit below — AndroidView only attaches views.
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
                    modifier = Modifier.fillMaxSize(),
                )
            }
            if (resolving || pageLoading) {
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
