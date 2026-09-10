package com.zylod.wholesale.ui.web

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.util.Log
import android.view.View
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
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
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.bridge.DownloadBridge
import com.zylod.wholesale.bridge.WebViewHost
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Registry for the WebView the Compose shell is currently showing. Lets the
 * host activity route bridge calls (evaluateJavascript, cache clearing) to the
 * topmost embedded WebView. Last-created wins — matching user-visible stacking.
 */
object NativeWebRegistry {
    @Volatile
    internal var webView: WebView? = null
}

/**
 * Reload / error channel between the host activity, the WebViewClient and the
 * Compose state. Snapshot writes happen on the main thread only (bridge calls
 * are marshalled via runOnUiThread, WebViewClient callbacks arrive on it).
 */
object NativeWebBus {
    var reloadTick by mutableIntStateOf(0)
        private set
    var errorTick by mutableIntStateOf(0)
        private set
    internal var pendingBase: String? = null

    fun requestReload(newBase: String? = null) {
        pendingBase = newBase
        reloadTick++
    }

    internal fun reportMainFrameError() {
        errorTick++
    }
}

/**
 * WebView shell for Tier 3 pageIds inside the Compose navigation. Loads the SPA
 * deep-link URL (?page=<id>) on the active server so state stays uniform with
 * the web app and the zylod:// link scheme.
 *
 * Capability parity with the legacy shell (MainActivity.setupWebView): same
 * settings, same JS bridges (ZylodNativeBridge / ZylodDownload), same clients
 * (external-scheme routing, ngrok interstitial bypass, JS dialogs, console,
 * file chooser, getUserMedia, downloads, __IS_OFFLINE__ injection) and —
 * unlike the legacy root — an explicit unreachable-server error state with
 * Retry (D1/D2 remediation).
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebScreen(pageId: String, query: String) {
    val context = LocalContext.current
    val host = context as? WebViewHost
    val scope = rememberCoroutineScope()
    var webView by remember { mutableStateOf<WebView?>(null) }
    var baseUrl by remember { mutableStateOf(ServerConfig.cached(context)) }
    var resolving by remember { mutableStateOf(baseUrl == null) }
    var pageError by remember { mutableStateOf(false) }
    var pageLoading by remember { mutableStateOf(true) }
    var manualReload by remember { mutableIntStateOf(0) }

    // Initial backend discovery only when no cached winner exists.
    LaunchedEffect(Unit) {
        if (baseUrl == null) {
            baseUrl = runCatching { ServerConfig.resolve(context) }.getOrNull()
        }
        resolving = false
    }

    // Main-frame load failures (WebViewClient callback) → explicit error state.
    val errorTick = NativeWebBus.errorTick
    LaunchedEffect(errorTick) {
        if (errorTick > 0) {
            pageError = true
            pageLoading = false
        }
    }

    val reloadTick = NativeWebBus.reloadTick
    LaunchedEffect(webView, baseUrl, pageId, query, reloadTick, manualReload) {
        val pending = NativeWebBus.pendingBase
        if (pending != null) {
            baseUrl = pending
            NativeWebBus.pendingBase = null
        }
        val base = baseUrl ?: return@LaunchedEffect
        // ?page=<id> contract; the id and every query VALUE are URL-encoded (D10).
        val target = base.trimEnd('/') + "/?page=" + Uri.encode(pageId) +
            (if (query.isNotBlank()) "&" + encodeQueryValues(query) else "")
        pageError = false
        pageLoading = true
        webView?.loadUrl(target)
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
            AndroidView(
                factory = { ctx ->
                    createShellWebView(ctx, host).also { created ->
                        webView = created
                        NativeWebRegistry.webView = created
                    }
                },
                onRelease = { created ->
                    if (NativeWebRegistry.webView === created) NativeWebRegistry.webView = null
                    created.destroy()
                },
                update = { created ->
                    if (NativeWebRegistry.webView !== created) NativeWebRegistry.webView = created
                },
                modifier = Modifier.fillMaxSize(),
            )
            if (resolving || pageLoading) {
                CircularProgressIndicator()
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

/** Full-parity WebView: settings, bridges, clients — mirrors MainActivity.setupWebView. */
private fun createShellWebView(ctx: android.content.Context, host: WebViewHost?): WebView =
    WebView(ctx).apply {
        setBackgroundColor(AndroidColor.TRANSPARENT)
        setLayerType(View.LAYER_TYPE_HARDWARE, null)
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
            setOffscreenPreRaster(true)
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(this@apply, true)
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

private fun createShellWebViewClient(ctx: android.content.Context): WebViewClient =
    object : WebViewClient() {
        override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
            // Loading is surfaced by the caller via pageLoading; no per-page bar.
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            // Re-assert the connectivity flag: navigation wipes values the
            // NetworkMonitor collector injected into the previous document.
            val offline = !ZylodApp.instance.networkMonitor.isConnected.value
            view?.evaluateJavascript("window.__IS_OFFLINE__ = $offline", null)
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
                okhttp3.HttpUrl.Companion.toHttpUrlOrNull(base)?.let { ownHosts.add(it.host) }
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

        // Main-frame load failure = unreachable server → explicit error state
        // with Retry (D1). Sub-resource failures never take the page down.
        override fun onReceivedError(
            view: WebView?,
            request: WebResourceRequest?,
            error: WebResourceError?
        ) {
            if (request?.isForMainFrame == true) {
                val failingUrl = request.url.toString()
                if (!failingUrl.startsWith("file:///android_asset/")) {
                    view?.post { NativeWebBus.reportMainFrameError() }
                }
            }
        }
    }

private fun createShellWebChromeClient(ctx: android.content.Context, host: WebViewHost?): WebChromeClient =
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
