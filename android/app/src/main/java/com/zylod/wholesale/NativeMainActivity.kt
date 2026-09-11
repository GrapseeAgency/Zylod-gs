package com.zylod.wholesale

import android.Manifest
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.zylod.wholesale.bridge.DownloadBridge
import com.zylod.wholesale.bridge.WebViewHost
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.sync.OfflineSyncScheduler
import com.zylod.wholesale.ui.BarcodeScannerActivity
import com.zylod.wholesale.ui.nav.ZylodRoot
import com.zylod.wholesale.ui.theme.ZylodTheme
import com.zylod.wholesale.ui.web.NativeWebBus
import com.zylod.wholesale.ui.web.NativeWebRegistry
import com.zylod.wholesale.ui.web.NativeWebViewPool
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

/**
 * Native Compose entry (launcher from Phase 0 on). Hosts Tier 1 screens and
 * hands Tier 3 pageIds to the embedded WebView — see ARCHITECTURE.md.
 *
 * Implements [WebViewHost] so the embedded WebView gets the SAME native
 * capability set as the legacy shell (bridge, downloads, file chooser,
 * getUserMedia, scanner, voice, server settings) — the bridge is shared
 * infrastructure, not legacy-only (D2 remediation).
 */
class NativeMainActivity : FragmentActivity(), WebViewHost {

    private lateinit var downloadBridge: DownloadBridge
    private var pendingBarcodeCallback: String? = null
    private var pendingVoiceCallback: String? = null
    private var speechRecognizer: SpeechRecognizer? = null

    // WebChromeClient state: file chooser + getUserMedia permission handoff
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var capturePhotoUri: Uri? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null

    /** Receives the scanned code from BarcodeScannerActivity → callback(success, code|null). */
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

    /** Receives gallery/camera picks for the WebChromeClient file chooser. */
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

    private val voicePermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val callback = pendingVoiceCallback
        pendingVoiceCallback = null
        if (callback != null) {
            if (granted) beginVoiceListening(callback)
            else evaluateJavascript("$callback(false, 'Microphone permission is required for voice search')")
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchFileChooser(includeCamera = true)
        else filePathCallback?.onReceiveValue(null).also { filePathCallback = null }
    }

    private val webPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val request = pendingWebPermissionRequest
        pendingWebPermissionRequest = null
        if (request == null) return@registerForActivityResult
        // Grant only the web resources that were requested AND whose
        // underlying Android permission was approved (same rule as legacy).
        val allowed = mutableListOf<String>()
        if (request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
            grants[Manifest.permission.CAMERA] == true
        ) allowed.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
        if (request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
            grants[Manifest.permission.RECORD_AUDIO] == true
        ) allowed.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
        if (allowed.isNotEmpty()) request.grant(allowed.toTypedArray()) else request.deny()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        downloadBridge = DownloadBridge(this)
        setContent {
            ZylodTheme {
                ZylodRoot()
            }
        }
    }

    override fun onPause() {
        // Flush cookies so the web session survives process death (parity with
        // the legacy shell). Also pause the ATTACHED shell's timers/JS — the
        // legacy shell did this; the pooled shells pause at check-in, but the
        // visible one must not keep burning CPU while backgrounded.
        CookieManager.getInstance().flush()
        NativeWebRegistry.webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        NativeWebRegistry.webView?.onResume()
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        // Warm pooled shells are the first thing to go under memory pressure —
        // they are rebuilt+reloaded transparently on the next checkout.
        NativeWebViewPool.trim(level)
    }

    override fun onDestroy() {
        speechRecognizer?.destroy()
        super.onDestroy()
        NativeWebViewPool.reset()
    }

    // ----- WebViewHost: the embedded WebView's native capabilities -----

    override fun evaluateJavascript(script: String) {
        runOnUiThread {
            NativeWebRegistry.webView?.evaluateJavascript(script, null)
        }
    }

    override fun loadCustomUrl(url: String) {
        val cleanUrl = if (!url.startsWith("http://") && !url.startsWith("https://")) {
            "http://$url"
        } else {
            url
        }
        getSharedPreferences("zylod_config", Context.MODE_PRIVATE).edit()
            .putString("custom_server_url", cleanUrl)
            .putString("active_server_url", cleanUrl)
            .putString("native_base_url", cleanUrl) // keep ServerConfig caches in agreement
            .apply()
        OfflineSyncScheduler.schedule(applicationContext)
        NativeWebBus.requestReload(cleanUrl)
    }

    override fun retryServerConnection() {
        lifecycleScope.launch {
            val fresh = runCatching { ServerConfig.resolve(this@NativeMainActivity) }
                .getOrNull()
                ?: ServerConfig.cached(this@NativeMainActivity)
                ?: BuildConfig.SERVER_ENDPOINTS.toList().first()
            NativeWebBus.requestReload(fresh)
        }
    }

    override fun startBarcodeScanner(callbackJsFunction: String) {
        pendingBarcodeCallback = callbackJsFunction
        barcodeLauncher.launch(Intent(this, BarcodeScannerActivity::class.java))
    }

    override fun startVoiceRecognition(callbackJsFunction: String) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            evaluateJavascript("$callbackJsFunction(false, 'Voice recognition is not available on this device')")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pendingVoiceCallback = callbackJsFunction
            voicePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            return
        }
        beginVoiceListening(callbackJsFunction)
    }

    override fun clearWebViewCache() {
        NativeWebRegistry.webView?.apply {
            clearCache(true)
            clearHistory()
        }
    }

    // ----- WebChromeDelegate: page services delegated from WebScreen -----

    override fun onShowFileChooser(
        filePathCallback: ValueCallback<Array<Uri>>,
        fileChooserParams: WebChromeClient.FileChooserParams
    ): Boolean {
        this.filePathCallback?.onReceiveValue(null)
        this.filePathCallback = filePathCallback

        val acceptTypes = fileChooserParams.acceptTypes.filter { it.isNotBlank() }
        val acceptsImages = acceptTypes.isEmpty() ||
            acceptTypes.any { it.startsWith("image") || it == "*/*" }
        val capture = fileChooserParams.isCaptureEnabled() && acceptsImages

        if (capture &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            return true
        }

        launchFileChooser(includeCamera = capture)
        return true
    }

    override fun onWebPermissionRequest(request: PermissionRequest) {
        val requested = request.resources
        val needed = mutableListOf<String>()
        if (requested.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (requested.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            runOnUiThread { request.grant(requested) }
        } else {
            pendingWebPermissionRequest = request
            webPermissionLauncher.launch(missing.toTypedArray())
        }
    }

    override fun onWebPermissionRequestCanceled(request: PermissionRequest) {
        if (pendingWebPermissionRequest === request) {
            pendingWebPermissionRequest = null
            request.deny()
        }
    }

    /** Downloads: DownloadManager for http(s), direct save for data:, fetch+bridge for blob:. */
    override fun handleWebDownload(url: String, userAgent: String, contentDisposition: String?, mimetype: String?) {
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
                evaluateJavascript(script)
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

    // ----- internals (mirror the legacy shell's behavior) -----

    /** Builds and launches the gallery (+ optional camera) intent for the pending file chooser. */
    private fun launchFileChooser(includeCamera: Boolean) {
        val callback = filePathCallback ?: return

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
}
