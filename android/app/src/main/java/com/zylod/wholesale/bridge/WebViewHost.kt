package com.zylod.wholesale.bridge

import android.webkit.PermissionRequest
import android.webkit.ValueCallback

/**
 * The native capabilities the WebView exposes to its host activity. BOTH shells
 * implement this — the legacy WebView [com.zylod.wholesale.MainActivity] and the
 * Compose [com.zylod.wholesale.NativeMainActivity] — so Tier 3 pages keep the
 * full native capability set (toasts, haptics, biometrics, offline queue,
 * scanner, voice, downloads, session mirroring) no matter which shell hosts
 * them (android/ARCHITECTURE.md §2: the bridge is shared infra, not legacy-only).
 */
interface WebViewHost : WebChromeDelegate {
    /** Runs [script] in the shell's active WebView. */
    fun evaluateJavascript(script: String)

    /** Persists and loads a user-supplied server URL (server settings page). */
    fun loadCustomUrl(url: String)

    /** Re-runs backend discovery (offline shell / error screen retry button). */
    fun retryServerConnection()

    /** Launches the native CameraX/MLKit scanner; result → [callbackJsFunction]. */
    fun startBarcodeScanner(callbackJsFunction: String)

    /** Native speech recognition; result → [callbackJsFunction]. */
    fun startVoiceRecognition(callbackJsFunction: String)

    fun clearWebViewCache()
}

/**
 * Chrome-level page services a host may provide. Defaults keep hosts that
 * don't support a capability (or the legacy activity, whose own ChromeClient
 * already handles everything) safe: the WebView falls back to stock behavior.
 */
interface WebChromeDelegate {
    /** Host handles <input type="file">; return false to use default handling. */
    fun onShowFileChooser(
        filePathCallback: ValueCallback<Array<android.net.Uri>>,
        fileChooserParams: android.webkit.WebChromeClient.FileChooserParams
    ): Boolean = false

    /** Host handles getUserMedia permission prompts; default denies. */
    fun onWebPermissionRequest(request: PermissionRequest) {
        request.deny()
    }

    fun onWebPermissionRequestCanceled(request: PermissionRequest) {}

    /** Host handles download requests (blob:/data:/http(s)); default no-op. */
    fun handleWebDownload(url: String, userAgent: String, contentDisposition: String?, mimetype: String?) = Unit
}
