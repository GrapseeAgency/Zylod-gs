package com.zylod.wholesale

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.zylod.wholesale.bridge.DownloadBridge
import com.zylod.wholesale.bridge.WebAppBridge
import com.zylod.wholesale.sync.OfflineSyncScheduler
import com.zylod.wholesale.ui.BarcodeScannerActivity
import com.zylod.wholesale.util.DeepLinkParser
import com.zylod.wholesale.util.ParsedDeepLink
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity(), com.zylod.wholesale.bridge.WebViewHost {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var offlineBanner: View
    private lateinit var bridge: WebAppBridge
    private lateinit var downloadBridge: DownloadBridge
    private lateinit var prefs: SharedPreferences

    private val localAppUrl = "file:///android_asset/index.html"

    // Candidate backend endpoints for auto-discovery, injected per build type
    // so debug builds can probe personal/dev infrastructure while release
    // builds only ever touch production URLs.
    private val candidateEndpoints: List<String> = BuildConfig.SERVER_ENDPOINTS.toList()

    // Overall budget for endpoint discovery. All candidates are probed in
    // parallel; this caps total wait time before falling back to the bundled
    // offline shell (previously 6s x N sequential timeouts could add up to
    // ~36s of blank screen).
    private val probeBudgetMs = 6_500L

    private var activeServerUrl: String? = null
    private var probeJob: Job? = null
    private var pendingBarcodeCallback: String? = null

    // WebChromeClient state: file chooser + getUserMedia permission handoff
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingFileChooserCapture = false
    private var capturePhotoUri: Uri? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var pendingVoiceCallback: String? = null
    private var speechRecognizer: SpeechRecognizer? = null

    private val httpClient = OkHttpClient.Builder()
        // 6s window so a public ngrok tunnel (slower from far away /
        // from China) isn't skipped just because TLS+connect took >1.5s.
        // Local endpoints still answer in a few ms, so this doesn't delay
        // normal same-network use.
        .connectTimeout(6000, TimeUnit.MILLISECONDS)
        .readTimeout(6000, TimeUnit.MILLISECONDS)
        .build()

    // Receives the scanned code from BarcodeScannerActivity and hands it back
    // to the page as callback(success, code|null).
    private val barcodeLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val code = result.data?.getStringExtra(BarcodeScannerActivity.RESULT_BARCODE)
        val callback = pendingBarcodeCallback
        pendingBarcodeCallback = null
        if (callback != null) {
            val codeLiteral = code?.let { JSONObject.quote(it) } ?: "null"
            evaluateJavascript("$callback(${code != null}, $codeLiteral)")
        }
    }

    // Receives gallery/camera picks from the WebChromeClient file chooser.
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult
        val uris = when {
            result.resultCode == RESULT_OK && result.data?.data != null ->
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            // Camera capture: the result URI is the FileProvider target we
            // supplied, not the intent data.
            result.resultCode == RESULT_OK && capturePhotoUri != null ->
                arrayOf(capturePhotoUri!!)
            else -> null
        }
        callback.onReceiveValue(uris)
        capturePhotoUri = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("zylod_config", Context.MODE_PRIVATE)
        setContentView(createLayout())

        bridge = WebAppBridge(this)
        downloadBridge = DownloadBridge(this)
        setupWebView()
        setupSwipeRefresh()
        observeNetwork()
        requestNotificationPermissionIfNeeded()

        // Handle initial intent or auto-discover backend
        handleStartup(intent)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    // Now that the SPA pushes real history entries, canGoBack()
                    // covers page->page. Reaching here means the user is on the
                    // very first screen — background the app like a native app
                    // instead of flashing the dark bundled shell.
                    moveTaskToBack(true)
                }
            }
        })
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleStartup(intent)
    }

    override fun onPause() {
        webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        speechRecognizer?.destroy()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        when (requestCode) {
            REQUEST_WEB_PERMISSION -> {
                val request = pendingWebPermissionRequest ?: return
                pendingWebPermissionRequest = null
                // Grant only the web resources that were requested AND whose
                // underlying Android permission was approved.
                fun androidGranted(permission: String): Boolean {
                    val index = permissions.indexOf(permission)
                    return index >= 0 && grantResults.getOrNull(index) == PackageManager.PERMISSION_GRANTED
                }
                val allowed = mutableListOf<String>()
                if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                    androidGranted(Manifest.permission.CAMERA)
                ) {
                    allowed.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                }
                if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                    androidGranted(Manifest.permission.RECORD_AUDIO)
                ) {
                    allowed.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                }
                if (allowed.isNotEmpty()) request.grant(allowed.toTypedArray())
                else request.deny()
            }
            REQUEST_FILE_CAMERA -> launchFileChooser(includeCamera = granted)
            REQUEST_VOICE_PERMISSION -> {
                val callback = pendingVoiceCallback
                pendingVoiceCallback = null
                if (callback != null) {
                    if (granted) beginVoiceListening(callback)
                    else evaluateJavascript("$callback(false, 'Microphone permission is required for voice search')")
                }
            }
        }
    }

    private fun handleStartup(intent: Intent?) {
        val parsed = DeepLinkParser.parse(intent?.data)

        // A deep link can arrive while an earlier probe is still running;
        // cancel it so a slow stale result can't overwrite the newer navigation.
        probeJob?.cancel()
        probeJob = lifecycleScope.launch {
            val savedUrl = prefs.getString("custom_server_url", null)
            val endpoints = buildList {
                if (!savedUrl.isNullOrBlank()) add(savedUrl)
                addAll(candidateEndpoints)
            }

            val reachableEndpoint = findFirstReachableEndpoint(endpoints)

            withContext(Dispatchers.Main) {
                if (reachableEndpoint != null) {
                    activateServer(reachableEndpoint, parsed)
                } else {
                    // Fallback to bundled local asset app immediately with 0 delay
                    activeServerUrl = null
                    webView.loadUrl(localAppUrl)
                }
            }
        }
    }

    private fun activateServer(endpoint: String, parsed: ParsedDeepLink?) {
        activeServerUrl = endpoint
        // The sync worker reads this to know where to replay the offline queue.
        prefs.edit().putString("active_server_url", endpoint).apply()
        OfflineSyncScheduler.schedule(applicationContext)
        val targetUrl = if (parsed != null) buildPageUrl(endpoint, parsed) else endpoint
        webView.loadUrl(targetUrl)
    }

    /** Builds `endpoint/?page=...&<all deep-link params>`, URL-encoded. */
    private fun buildPageUrl(endpoint: String, parsed: ParsedDeepLink): String {
        val builder = Uri.parse(endpoint).buildUpon()
            .appendQueryParameter("page", parsed.targetPage)
        parsed.params.forEach { (key, value) ->
            builder.appendQueryParameter(key, value)
        }
        return builder.build().toString()
    }

    /**
     * Probes all endpoints in parallel, but resolves in priority order (the
     * order of [endpoints]): a fast lower-priority hit never wins over a
     * higher-priority endpoint that answers within the remaining budget.
     */
    private suspend fun findFirstReachableEndpoint(endpoints: List<String>): String? = coroutineScope {
        val deferreds = endpoints.distinct().map { url ->
            async(Dispatchers.IO) { if (isEndpointReachable(url)) url else null }
        }
        try {
            val deadline = System.nanoTime() + probeBudgetMs * 1_000_000L
            for (deferred in deferreds) {
                val remainingMs = (deadline - System.nanoTime()) / 1_000_000L
                if (remainingMs <= 0) break
                val hit = try {
                    withTimeout(remainingMs) { deferred.await() }
                } catch (_: TimeoutCancellationException) {
                    null
                }
                if (hit != null) return@coroutineScope hit
            }
            null
        } finally {
            // Stop the probes still in flight so the scope can return promptly.
            coroutineContext.cancelChildren()
        }
    }

    /**
     * Liveness probe — MUST stay consistent with ServerConfig.probe() (the
     * Compose shell) and the iOS probe: hit /api/app/version and accept ANY
     * HTTP response. Probing the bare host root with a 2xx-only rule used to
     * diverge from the native shells (a SPA root returning 404/HTML passed
     * here but failed there, and vice versa) — one contract, one definition.
     */
    private fun isEndpointReachable(url: String): Boolean = try {
        val probeUrl = url.trimEnd('/') + "/api/app/version"
        val request = Request.Builder()
            .url(probeUrl)
            .header("User-Agent", "ZylodNative/2.5.0")
            .build()
        httpClient.newCall(request).execute().use { true } // any response = alive
    } catch (_: Exception) {
        false
    }

    private fun requestNotificationPermissionIfNeeded() {
        // Sync-completion notifications are posted on API 33+, which requires
        // the runtime permission the manifest alone can't grant.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_NOTIFICATIONS
            )
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.setBackgroundColor(Color.parseColor("#0F172A"))
        // Force hardware-accelerated rendering for the WebView compositor.
        // Without this the page can fall back to software drawing, which is the
        // most common cause of janky/stuttery scrolling in a WebView.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = true

            // Debug builds load the dev stack over plain HTTP next to HTTPS
            // tunnels, so mixed content and file access stay permissive there.
            // Release builds are HTTPS-only: lock both down.
            if (BuildConfig.DEBUG) {
                allowFileAccess = true
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            } else {
                // file:///android_asset (offline shell) remains loadable —
                // allowFileAccess only governs arbitrary file:// URLs.
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }

            // Google Safe Browsing for loaded pages (API 26+).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }

            // The app ships its own responsive layout; the system
            // font-scale would otherwise break it (classic WebView bug).
            textZoom = 100

            userAgentString = "${userAgentString} ZylodAndroidNative/${BuildConfig.VERSION_NAME}"

            // Smoothness / scroll optimizations
            setSupportZoom(false)
            displayZoomControls = false
            loadWithOverviewMode = true
            useWideViewPort = true
            // Pre-raster the offscreen tiles so scrolling doesn't repaint each frame
            setOffscreenPreRaster(true)
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.addJavascriptInterface(bridge, "ZylodNativeBridge")
        webView.addJavascriptInterface(downloadBridge, "ZylodDownload")

        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            handleDownload(url, userAgent, contentDisposition, mimetype)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                // Re-assert the connectivity flag: navigation wipes values the
                // NetworkMonitor collector injected into the previous document.
                val offline = !ZylodApp.instance.networkMonitor.isConnected.value
                view?.evaluateJavascript("window.__IS_OFFLINE__ = $offline", null)
            }

            // Route non-web schemes (tel:, mailto:, sms:, intent:, market:, ...)
            // to matching apps, and off-origin http(s) links (social shares,
            // wa.me, t.me, ...) to the browser — the WebView must not try to
            // render them itself.
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                val scheme = uri.scheme?.lowercase() ?: return false

                if (scheme != "http" && scheme != "https") {
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: ActivityNotFoundException) {
                        Toast.makeText(this@MainActivity, "No app can open this link", Toast.LENGTH_SHORT).show()
                        true
                    }
                }

                val host = uri.host?.lowercase() ?: return false
                val ownHosts = mutableSetOf("zylod.com", "www.zylod.com")
                activeServerUrl?.toHttpUrlOrNull()?.let { ownHosts.add(it.host) }
                // Local dev origins always stay inside the app.
                if (host == "localhost" || host == "127.0.0.1" || host == "10.0.2.2") return false
                if (ownHosts.contains(host)) return false

                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: ActivityNotFoundException) {
                    false // No browser on the device — fall back to loading it.
                }
            }

            // ngrok's free domains show a browser-warning interstitial page to
            // browser-like requests. The WebView looks like a browser, so it
            // would show ngrok's page instead of the app. Adding the
            // ngrok-skip-browser-warning header to every request to an ngrok
            // host bypasses it. All other hosts load through the default path.
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val reqUrl = request?.url ?: return null
                val host = reqUrl.host ?: return null
                val isNgrok = host.endsWith(".ngrok-free.dev") ||
                    host.endsWith(".ngrok-free.app") ||
                    host.endsWith(".ngrok.io")
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
                    val response = httpClient.newCall(builder.build()).execute()
                    val contentType = response.header("Content-Type")
                    val mime = contentType?.substringBefore(";")?.trim()
                    val encoding = contentType?.substringAfter("charset=", "")
                        ?.trim()?.takeIf { it.isNotEmpty() }
                    val webResponse = WebResourceResponse(
                        mime,
                        encoding,
                        response.body?.byteStream()
                    )
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

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    val failingUrl = request.url.toString()
                    if (!failingUrl.startsWith("file:///android_asset/")) {
                        runOnUiThread {
                            Toast.makeText(this@MainActivity, "Server disconnected. Loading local shell.", Toast.LENGTH_SHORT).show()
                            webView.loadUrl(localAppUrl)
                        }
                    }
                }
            }
        }

        // The WebChromeClient supplies everything a desktop browser gives the
        // page for free: getUserMedia permission grants, <input type="file">
        // choosers (incl. camera capture), alert()/confirm() dialogs and
        // console logging. Without it those features silently do nothing.
        webView.webChromeClient = object : WebChromeClient() {

            override fun onPermissionRequest(request: PermissionRequest) {
                val requested = request.resources
                val needed = mutableListOf<String>()
                if (requested.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                    needed.add(Manifest.permission.CAMERA)
                }
                if (requested.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                    needed.add(Manifest.permission.RECORD_AUDIO)
                }
                val missing = needed.filter {
                    ContextCompat.checkSelfPermission(this@MainActivity, it) != PackageManager.PERMISSION_GRANTED
                }
                if (missing.isEmpty()) {
                    runOnUiThread { request.grant(requested) }
                } else {
                    pendingWebPermissionRequest = request
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        missing.toTypedArray(),
                        REQUEST_WEB_PERMISSION
                    )
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingWebPermissionRequest === request) {
                    pendingWebPermissionRequest = null
                    request.deny()
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val acceptTypes = fileChooserParams.acceptTypes.filter { it.isNotBlank() }
                val acceptsImages = acceptTypes.isEmpty() ||
                    acceptTypes.any { it.startsWith("image") || it == "*/*" }
                pendingFileChooserCapture = fileChooserParams.isCaptureEnabled() && acceptsImages

                if (pendingFileChooserCapture &&
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) !=
                    PackageManager.PERMISSION_GRANTED
                ) {
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.CAMERA),
                        REQUEST_FILE_CAMERA
                    )
                    return true
                }

                launchFileChooser(includeCamera = pendingFileChooserCapture)
                return true
            }

            override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok) { _, _ -> result.confirm() }
                    .setOnCancelListener { result.cancel() }
                    .show()
                return true
            }

            override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult): Boolean {
                AlertDialog.Builder(this@MainActivity)
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
        }
    }

    /** Builds and launches the gallery (+ optional camera) intent for the pending file chooser. */
    private fun launchFileChooser(includeCamera: Boolean) {
        val callback = filePathCallback ?: return

        // Permissive gallery intent: the accept list isn't retained across the
        // permission detour, so allow anything for plain pickers and images
        // when a camera capture was requested.
        val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (includeCamera) "image/*" else "*/*"
        }

        val cameraIntent = if (includeCamera) buildCameraCaptureIntent() else null

        val launchIntent = if (cameraIntent != null) {
            Intent.createChooser(galleryIntent, "Take photo or choose file").apply {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
            }
        } else {
            galleryIntent
        }

        try {
            fileChooserLauncher.launch(launchIntent)
        } catch (_: ActivityNotFoundException) {
            callback.onReceiveValue(null)
            filePathCallback = null
            Toast.makeText(this, "No file picker available on this device", Toast.LENGTH_SHORT).show()
        }
    }

    /** Camera target for capture-requesting file inputs, via FileProvider. */
    private fun buildCameraCaptureIntent(): Intent? = try {
        val dir = File(cacheDir, "captures").apply { mkdirs() }
        val photo = File(dir, "zylod_capture_${System.currentTimeMillis()}.jpg")
        val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", photo)
        capturePhotoUri = uri
        Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, uri)
            clipData = android.content.ClipData.newRawUri("photo", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
    } catch (_: Exception) {
        null
    }

    /** Downloads: DownloadManager for http(s), direct save for data:, fetch+bridge for blob:. */
    private fun handleDownload(url: String, userAgent: String, contentDisposition: String?, mimetype: String?) {
        val filename = URLUtil.guessFileName(url, contentDisposition, mimetype)
        when {
            url.startsWith("blob:") -> {
                // DownloadManager can't read blob: URLs; pull the bytes inside
                // the page and hand them to the native saver as a data URL.
                val mime = mimetype ?: "application/octet-stream"
                val script = """
                    (function(){
                      fetch(${JSONObject.quote(url)})
                        .then(function(r){ return r.blob(); })
                        .then(function(b){
                          var fr = new FileReader();
                          fr.onload = function(){ ZylodDownload.save(fr.result, ${JSONObject.quote(filename)}, ${JSONObject.quote(mime)}); };
                          fr.onerror = function(){ console.error('Zylod: blob read failed'); };
                          fr.readAsDataURL(b);
                        })
                        .catch(function(e){ console.error('Zylod: blob fetch failed: ' + e); });
                    })();
                """.trimIndent()
                webView.evaluateJavascript(script, null)
            }
            url.startsWith("data:") -> {
                downloadBridge.save(url, filename, mimetype ?: "application/octet-stream")
            }
            else -> {
                try {
                    val request = DownloadManager.Request(Uri.parse(url))
                        .setMimeType(mimetype)
                        .setTitle(filename)
                        .setDescription("Zylod download")
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
                    CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
                    request.addRequestHeader("User-Agent", userAgent)
                    (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                } catch (e: Exception) {
                    Toast.makeText(this, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun toastDownloadResult(saved: Boolean) {
        if (saved) {
            Toast.makeText(this, "Saved to Downloads", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Could not save the file", Toast.LENGTH_SHORT).show()
        }
    }

    override fun loadCustomUrl(url: String) {
        val cleanUrl = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "http://$url"
        } else {
            url
        }
        prefs.edit()
            .putString("custom_server_url", cleanUrl)
            .putString("active_server_url", cleanUrl)
            .apply()
        activeServerUrl = cleanUrl
        OfflineSyncScheduler.schedule(applicationContext)
        runOnUiThread {
            webView.loadUrl(cleanUrl)
        }
    }

    /** Launches the native scanner; result is delivered to [callbackJsFunction]. */
    override fun startBarcodeScanner(callbackJsFunction: String) {
        pendingBarcodeCallback = callbackJsFunction
        barcodeLauncher.launch(Intent(this, BarcodeScannerActivity::class.java))
    }

    /** Re-runs endpoint discovery — the offline shell's "retry" button. */
    override fun retryServerConnection() {
        handleStartup(intent)
    }

    /** Native speech recognition for the WebView (no Web Speech API in WebView). */
    override fun startVoiceRecognition(callbackJsFunction: String) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            evaluateJavascript("$callbackJsFunction(false, 'Voice recognition is not available on this device')")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingVoiceCallback = callbackJsFunction
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                REQUEST_VOICE_PERMISSION
            )
            return
        }
        beginVoiceListening(callbackJsFunction)
    }

    private fun beginVoiceListening(callbackJsFunction: String) {
        speechRecognizer?.destroy()
        val recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer = recognizer

        val listenIntent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }

        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                val literal = text?.let { JSONObject.quote(it) } ?: "null"
                evaluateJavascript("$callbackJsFunction(${text != null}, $literal)")
            }

            override fun onError(error: Int) {
                val message = voiceErrorMessage(error)
                evaluateJavascript("$callbackJsFunction(false, '${message.replace("'", "\\'")}')")
            }

            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        recognizer.startListening(listenIntent)
    }

    private fun voiceErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_NO_MATCH -> "No speech was heard — please try again"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech was heard — please try again"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required for voice search"
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording problem — please try again"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Voice recognition is busy — please try again"
        else -> "Voice recognition failed — please try again"
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
        swipeRefresh.setColorSchemeResources(R.color.primary_red, R.color.accent_blue)
    }

    private fun observeNetwork() {
        lifecycleScope.launch {
            var wasConnected = ZylodApp.instance.networkMonitor.isConnected.value
            ZylodApp.instance.networkMonitor.isConnected.collectLatest { connected ->
                offlineBanner.visibility = if (connected) View.GONE else View.VISIBLE
                evaluateJavascript("window.__IS_OFFLINE__ = ${!connected}")
                // Connectivity returned while the offline shell is showing —
                // try to reach the live server again automatically.
                if (connected && !wasConnected && activeServerUrl == null) {
                    handleStartup(intent)
                }
                wasConnected = connected
            }
        }
    }

    override fun evaluateJavascript(script: String) {
        runOnUiThread {
            webView.evaluateJavascript(script, null)
        }
    }

    override fun clearWebViewCache() {
        webView.clearCache(true)
        webView.clearHistory()
    }

    private fun createLayout(): View {
        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#0F172A"))

        swipeRefresh = SwipeRefreshLayout(this)
        webView = WebView(this)
        swipeRefresh.addView(webView)
        root.addView(swipeRefresh)

        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleLarge).apply {
            isIndeterminate = true
            visibility = View.GONE
            // Center in the layout so it doesn't render as a thin strip at the top
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER,
            )
        }
        root.addView(progressBar)

        offlineBanner = TextView(this).apply {
            text = "⚡ Local Mode: Operating on offline wholesale engine"
            setBackgroundColor(getColor(R.color.primary_dark))
            setTextColor(getColor(android.R.color.white))
            setPadding(32, 16, 32, 16)
            visibility = View.GONE
        }
        root.addView(offlineBanner)

        return root
    }

    companion object {
        private const val REQUEST_NOTIFICATIONS = 101
        private const val REQUEST_WEB_PERMISSION = 102
        private const val REQUEST_VOICE_PERMISSION = 103
        private const val REQUEST_FILE_CAMERA = 104
    }
}
