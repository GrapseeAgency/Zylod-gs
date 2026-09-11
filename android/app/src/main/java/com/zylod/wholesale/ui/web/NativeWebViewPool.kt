package com.zylod.wholesale.ui.web

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.util.Log
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewCompat
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.bridge.DownloadBridge
import com.zylod.wholesale.bridge.WebAppBridge
import com.zylod.wholesale.bridge.WebViewHost
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.session.WebAuthSeeder
import com.zylod.wholesale.session.WebShellScripts
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.ArrayDeque
import java.util.concurrent.TimeUnit

/**
 * Per-checkout event channel from the shared WebView's clients to whichever
 * WebScreen currently hosts it. Replaces the old process-global errorTick
 * broadcast, which poisoned EVERY future WebScreen composition after a single
 * transient main-frame failure (owner audit finding #2: taps appeared dead).
 */
internal class WebShellHandle {
    var onPageFinished: (() -> Unit)? = null
    var onMainFrameError: (() -> Unit)? = null
}

/**
 * Phase 1 runtime-audit fix (findings #1/#2/#4): a process-level pool of
 * WebView shells.
 *
 * Previously every WebScreen composition created a brand-new WebView and
 * destroyed it on leave — every Tier-3 navigation (and every Back out of a
 * native PDP covering a web page) re-downloaded and re-hydrated the whole SPA.
 * The pool keeps finished shells alive, checks them out per screen and pauses
 * them when detached, so:
 *
 *  - returning to a previously loaded page is a cheap re-attach (no reload);
 *  - the shell keeps its HTTP cache/renderer warm for the next checkout;
 *  - a paused, detached WebView does zero raster work while a native screen
 *    is on top (offscreenPreRaster removed for the same reason).
 *
 * A shell is invalidated (destroyed + rebuilt) when the resolved server base
 * URL or the auth-seed script changes — the document-start scripts cannot be
 * removed once installed, so correctness requires a fresh instance rather
 * than accumulating stale-token scripts.
 */
internal object NativeWebViewPool {

    private const val MAX_FREE = 3

    internal class Shell(
        val webView: WebView,
        val baseUrl: String,
        val seedScript: String,
        val handle: WebShellHandle,
    ) {
        /**
         * The page the SPA currently renders in this shell — maintained by
         * [softNavigate]/loadUrl callers. Lets a re-composing WebScreen skip
         * the soft-navigate entirely when the shell is already showing the
         * requested page (Back out of a native PDP: instant re-attach, no
         * re-navigation, scroll position preserved).
         */
        var lastPageId: String? = null
        var lastQuery: String? = null
    }

    private val free = ArrayDeque<Shell>()
    private val busy = HashSet<Shell>()

    // ── Checkout / check-in ────────────────────────────────────────────────

    /**
     * Returns a shell for [baseUrl], reusing a compatible free one when the
     * base URL and the current auth-seed script both match (most-recently
     * used first — LRU). [host] receives the bridge capability set (scanner,
     * voice, downloads, file chooser…).
     */
    @SuppressLint("SetJavaScriptEnabled")
    fun checkOut(context: Context, host: WebViewHost?, baseUrl: String): Shell {
        val seedScript = WebAuthSeeder.buildScript(context)
        synchronized(this) {
            val reusable = free.firstOrNull { it.baseUrl == baseUrl && it.seedScript == seedScript }
            if (reusable != null) {
                free.remove(reusable)
                busy.add(reusable)
                return reusable
            }
            // An incompatible free shell (stale base or rotated token) cannot
            // be re-seeded in place — document-start scripts are append-only.
            free.removeEach { it.baseUrl != baseUrl || it.seedScript != seedScript }
                .forEach { destroy(it) }
        }
        val shell = Shell(
            webView = createShellWebView(context, host),
            baseUrl = baseUrl,
            seedScript = seedScript,
            handle = WebShellHandle(),
        )
        // Document-start scripts: duplicated-web-chrome suppression (static)
        // + the current auth seed (built once above, installed once here).
        WebShellScripts.installDocumentStartScripts(shell.webView, baseUrl)
        WebAuthSeeder.installScript(shell.webView, baseUrl, seedScript)
        synchronized(this) { busy.add(shell) }
        return shell
    }

    /** Detaches and pauses a shell without destroying it. */
    fun checkIn(webView: WebView) {
        val shell = synchronized(this) { busy.firstOrNull { it.webView === webView } } ?: return
        checkIn(shell)
    }

    fun checkIn(shell: Shell) {
        synchronized(this) {
            if (!busy.remove(shell)) return
            (shell.webView.parent as? ViewGroup)?.removeView(shell.webView)
            shell.webView.onPause()
            // LRU: most-recently-freed at the front — the next checkout reuses
            // it first, so tab-hopping keeps the warm shells alive.
            free.addFirst(shell)
            while (free.size > MAX_FREE) destroy(free.removeLast())
        }
    }

    /** Destroys every pooled shell (server switch, credential reset). */
    fun reset() {
        synchronized(this) {
            free.forEach { destroy(it) }
            free.clear()
        }
    }

    /**
     * Memory pressure hook (called from the host activity's onTrimMemory):
     * pooled shells are warm SPA heaps — under pressure drop the coldest
     * first so a backgrounded app is never killed for cached webviews.
     */
    fun trim(level: Int) {
        val keep = when {
            level >= android.content.ComponentCallbacks2.TRIM_MEMORY_BACKGROUND -> 0
            level >= android.content.ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW -> 1
            else -> return
        }
        synchronized(this) {
            while (free.size > keep) destroy(free.removeLast())
        }
    }

    private fun destroy(shell: Shell) {
        try {
            (shell.webView.parent as? ViewGroup)?.removeView(shell.webView)
            shell.webView.destroy()
        } catch (_: Throwable) {
            // A destroyed-while-attached WebView must not crash the host.
        }
    }

    // ── Soft navigation (no document reload) ───────────────────────────────

    /**
     * Drives the already-hydrated SPA to [pageId] via history.pushState + a
     * synthetic popstate — the exact contract the web app's own navigation
     * store uses. Returns false when the SPA hasn't signalled readiness
     * (window.__zylodSpaReady) or the navigation was not consumed (contract
     * drift) — the caller then falls back to a full loadUrl. Runs on the
     * WebView thread (call from the main thread).
     */
    fun softNavigate(shell: Shell, pageId: String, query: String, onDone: (Boolean) -> Unit) {
        val script = WebShellScripts.softNavigateScript(pageId, query)
        shell.webView.evaluateJavascript(script) { result ->
            val ok = result?.contains("ok") == true && result?.contains("\"no\"") != true
            if (ok) {
                shell.lastPageId = pageId
                shell.lastQuery = query
            }
            onDone(ok)
        }
    }

    // ── Shell factory (full capability parity with the legacy shell) ───────

    private fun createShellWebView(ctx: Context, host: WebViewHost?): WebView =
        WebView(ctx).apply {
            // OPAQUE background: a transparent WebView forces the compositor
            // to blend every frame of web content over the Compose layer —
            // measurable raster cost while the Category grid scrolls. The
            // value matches the Compose background behind this view.
            setBackgroundColor(resolveShellBackground(ctx))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = true
                if (BuildConfig.DEBUG) {
                    allowFileAccess = true
                    allowContentAccess = true
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                } else {
                    allowFileAccess = false
                    allowContentAccess = false
                    mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                }
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    safeBrowsingEnabled = true
                }
                // The app ships its own responsive layout; the system font-scale
                // would otherwise break it (classic WebView bug).
                textZoom = 100
                userAgentString = "$userAgentString ZylodAndroidNative/${BuildConfig.VERSION_NAME}"
                setSupportZoom(false)
                displayZoomControls = false
                loadWithOverviewMode = true
                useWideViewPort = true
                // Phase 1 audit: pre-rasterizing OFFSCREEN pages keeps the
                // renderer busy while a native screen is on top — a direct
                // source of scroll jank on PDP/Cart. Offscreen shells are
                // paused instead (checkIn).
                setOffscreenPreRaster(false)
            }

            val shellWebView = this
            CookieManager.getInstance().apply {
                setAcceptCookie(true)
                setAcceptThirdPartyCookies(shellWebView, true)
            }

            if (host != null) {
                addJavascriptInterface(WebAppBridge(host), "ZylodNativeBridge")
            }
            if (ctx is android.app.Activity) {
                addJavascriptInterface(DownloadBridge(ctx), "ZylodDownload")
                setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
                    host?.handleWebDownload(url, userAgent, contentDisposition, mimetype)
                }
            }

            webViewClient = createShellWebViewClient(ctx)
            webChromeClient = createShellWebChromeClient(ctx, host)
        }

    private val ngrokClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(6, TimeUnit.SECONDS)
            .readTimeout(6, TimeUnit.SECONDS)
            .build()
    }

    private fun createShellWebViewClient(ctx: Context): WebViewClient =
        object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                // Document-start injection fallback when the webkit API is not
                // supported by the WebView provider: BOTH seeds must fall back
                // (the chrome suppression previously had NO fallback — the
                // legacy web bar stayed visible and its taps could only ever
                // perform divergent SPA navigation; round-3 audit finding).
                WebShellScripts.injectSuppressionFallback(view)
                WebAuthSeeder.injectFallback(view)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                // Re-assert the connectivity flag: navigation wipes values the
                // NetworkMonitor collector injected into the previous document.
                val offline = !com.zylod.wholesale.ZylodApp.instance.networkMonitor.isConnected.value
                view?.evaluateJavascript("window.__IS_OFFLINE__ = $offline", null)
                // Phase 1 audit: hand the success event to the hosting screen
                // (clears the loading state — it previously never cleared).
                val handle = synchronized(NativeWebViewPool) {
                    busy.firstOrNull { it.webView === view }?.handle
                }
                handle?.onPageFinished?.invoke()
            }

            // Route non-web schemes (tel:, mailto:, intent:, market:, ...) to their
            // apps and off-origin http(s) links to the browser — same policy as the
            // legacy shell.
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: return false

                if (scheme != "http" && scheme != "https") {
                    return try {
                        ctx.startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: ActivityNotFoundException) {
                        Toast.makeText(ctx, "No app can open this link", Toast.LENGTH_SHORT).show()
                        true
                    }
                }

                val linkHost = uri.host?.lowercase() ?: return false
                val ownHosts = mutableSetOf("zylod.com", "www.zylod.com", "localhost", "127.0.0.1", "10.0.2.2")
                ServerConfig.cached(ctx)?.let { base ->
                    base.toHttpUrlOrNull()?.let { httpUrl -> ownHosts.add(httpUrl.host) }
                }
                if (ownHosts.contains(linkHost)) return false

                return try {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: ActivityNotFoundException) {
                    false // No browser on the device — fall back to loading it.
                }
            }

            // ngrok's free domains show a browser-warning interstitial to
            // browser-like requests; bypass it with the skip header (same as legacy).
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val reqUrl = request?.url ?: return null
                val reqHost = reqUrl.host ?: return null
                val isNgrok = reqHost.endsWith(".ngrok-free.dev") ||
                    reqHost.endsWith(".ngrok-free.app") ||
                    reqHost.endsWith(".ngrok.io")
                if (!isNgrok) return null

                return try {
                    val builder = Request.Builder()
                        .url(reqUrl.toString())
                        .header("ngrok-skip-browser-warning", "zylod-app")
                    request.requestHeaders?.forEach { (name, value) ->
                        if (!value.isNullOrEmpty() && !name.equals("ngrok-skip-browser-warning", ignoreCase = true)) {
                            builder.header(name, value)
                        }
                    }
                    val response = ngrokClient.newCall(builder.build()).execute()
                    val contentType = response.header("Content-Type")
                    val mime = contentType?.substringBefore(";")?.trim()
                    val encoding = contentType?.substringAfter("charset=", "")
                        ?.trim()?.takeIf { it.isNotEmpty() }
                    val webResponse = WebResourceResponse(mime, encoding, response.body?.byteStream())
                    val reason = response.message.ifEmpty { if (response.code in 200..299) "OK" else "Error" }
                    webResponse.setStatusCodeAndReasonPhrase(response.code, reason)
                    val headersMap = linkedMapOf<String, String>()
                    for (i in 0 until response.headers.size) {
                        headersMap[response.headers.name(i)] = response.headers.value(i)
                    }
                    webResponse.responseHeaders = headersMap
                    webResponse
                } catch (_: Exception) {
                    null // fall back to the default WebView loader
                }
            }

            // Main-frame load failure = unreachable server → the HOSTING SCREEN
            // shows its error state (per-screen, never a global broadcast).
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    if (!failingUrl.startsWith("file:///android_asset/")) {
                        val handle = synchronized(NativeWebViewPool) {
                            busy.firstOrNull { it.webView === view }?.handle
                        }
                        view?.post { handle?.onMainFrameError?.invoke() }
                    }
                }
            }

            // Main-frame HTTP failure (500/404/...) — onReceivedError does NOT
            // fire for these; without this the screen spun forever whenever
            // the server responded with an error document (audit finding #1).
            // Subresource failures are ignored (graceful degradation).
            override fun onReceivedHttpError(
                view: WebView?,
                request: WebResourceRequest?,
                errorResponse: WebResourceResponse?
            ) {
                if (request?.isForMainFrame == true && (errorResponse?.statusCode ?: 0) >= 400) {
                    val handle = synchronized(NativeWebViewPool) {
                        busy.firstOrNull { it.webView === view }?.handle
                    }
                    view?.post { handle?.onMainFrameError?.invoke() }
                }
            }

            // Renderer crash/OOM kill: without returning true here the whole
            // APP is killed. Destroy the poisoned shell and surface the
            // bounded error state; Retry builds a fresh shell (finding #3).
            override fun onRenderProcessGone(view: WebView?, detail: android.webkit.RenderProcessGoneDetail?): Boolean {
                val handle = synchronized(NativeWebViewPool) {
                    val gone = busy.firstOrNull { it.webView === view }
                    if (gone != null) {
                        busy.remove(gone)
                        destroy(gone)
                    }
                    gone?.handle
                }
                handle?.let { h ->
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        h.onMainFrameError?.invoke()
                    }
                }
                return true
            }
        }

    private fun createShellWebChromeClient(ctx: Context, host: WebViewHost?): WebChromeClient =
        object : WebChromeClient() {
            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult): Boolean {
                AlertDialog.Builder(ctx)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult): Boolean {
                AlertDialog.Builder(ctx)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setNegativeButton(android.R.string.cancel) { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage?): Boolean {
                if (BuildConfig.DEBUG) {
                    Log.d(
                        "ZylodWeb",
                        "${consoleMessage?.message()} (@${consoleMessage?.lineNumber()} ${consoleMessage?.sourceId()})"
                    )
                }
                return true
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams
            ): Boolean {
                val callback = filePathCallback ?: return false
                return host?.onShowFileChooser(callback, fileChooserParams) ?: false
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                host?.onWebPermissionRequest(request) ?: request.deny()
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                host?.onWebPermissionRequestCanceled(request)
            }
        }
}

private inline fun ArrayDeque<NativeWebViewPool.Shell>.removeEach(
    predicate: (NativeWebViewPool.Shell) -> Boolean,
): List<NativeWebViewPool.Shell> {
    val removed = ArrayList<NativeWebViewPool.Shell>()
    val iterator = iterator()
    while (iterator.hasNext()) {
        val item = iterator.next()
        if (predicate(item)) {
            iterator.remove()
            removed.add(item)
        }
    }
    return removed
}

/** Origin rule helper shared with [WebShellScripts]. */
internal fun documentStartOriginRule(baseUrl: String): String? {
    val url = baseUrl.toHttpUrlOrNull() ?: return null
    val defaultPort = if (url.isHttps) 443 else 80
    return if (url.port == defaultPort) "${url.scheme}://${url.host}" else "${url.scheme}://${url.host}:${url.port}"
}

/**
 * Resolves the theme's window background so the shell WebView is opaque and
 * matches the Compose surface behind it (a transparent WebView blends every
 * scrolled frame — Category grid raster cost). Falls back to white, the
 * app's light-theme background.
 */
private fun resolveShellBackground(ctx: Context): Int {
    val typedValue = android.util.TypedValue()
    return if (ctx.theme.resolveAttribute(android.R.attr.windowBackground, typedValue, true)) {
        typedValue.data
    } else {
        AndroidColor.WHITE
    }
}
