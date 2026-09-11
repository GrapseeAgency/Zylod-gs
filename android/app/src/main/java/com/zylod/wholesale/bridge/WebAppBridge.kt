package com.zylod.wholesale.bridge

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.biometric.BiometricPrompt
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.model.OfflineProduct
import com.zylod.wholesale.data.model.SyncQueueItem
import com.zylod.wholesale.sync.OfflineSyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicInteger

/**
 * @param host the activity hosting the WebView (either shell). See
 *   [WebViewHost] — capability parity across the legacy and Compose shells.
 */
class WebAppBridge(private val host: WebViewHost) {

    private val activity: Activity get() = host as Activity

    private val vibrator = activity.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    private val scope = CoroutineScope(Dispatchers.IO)
    private val notificationIds = AtomicInteger(5000)

    @JavascriptInterface
    fun showToast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun triggerHapticFeedback() {
        triggerHaptic("IMPACT")
    }

    @JavascriptInterface
    fun triggerHaptic(type: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val duration = if (type == "SUCCESS") 80L else 35L
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(40)
        }
    }

    @JavascriptInterface
    fun loadLiveUrl(url: String) {
        activity.runOnUiThread {
            host.loadCustomUrl(url)
        }
    }

    @JavascriptInterface
    fun authenticateWithBiometrics(title: String, callbackJsFunction: String) {
        requestBiometricAuth(callbackJsFunction)
    }

    @JavascriptInterface
    fun getAppVersionCode(): Int {
        return BuildConfig.VERSION_CODE
    }

    @JavascriptInterface
    fun getAppVersionName(): String {
        return BuildConfig.VERSION_NAME
    }

    @JavascriptInterface
    fun isNativeAndroid(): Boolean {
        return true
    }

    /**
     * Web-initiated navigation: the page asks the NATIVE shell to change
     * screens (native bottom-bar parity — ZylodRoot.openPageRouted). Runs on
     * the JS bridge thread, so the host hop to the UI thread happens inside
     * NativeNavBus.
     */
    @JavascriptInterface
    fun openPage(pageId: String, params: String) {
        com.zylod.wholesale.ui.nav.NativeNavBus.openPage(pageId, params)
    }

    @JavascriptInterface
    fun isNetworkConnected(): Boolean {
        return ZylodApp.instance.networkMonitor.isConnected.value
    }

    /**
     * Mirrors the web session token into encrypted storage so the sync worker
     * can replay queued actions as the signed-in user. An empty token clears it.
     */
    @JavascriptInterface
    fun setAuthToken(token: String) {
        scope.launch {
            // EncryptedSharedPreferences can throw (AEADBadTagException after a
            // botched restore, disk full, …). A JS-triggered path must never
            // crash the app — report failure back to the page instead.
            runCatching {
                val editor = ZylodApp.instance.securePrefs.edit()
                val trimmed = token.trim()
                if (trimmed.isEmpty()) editor.remove("auth_token") else editor.putString("auth_token", trimmed)
                editor.apply()
            }.onFailure { e ->
                android.util.Log.w("ZylodBridge", "auth token mirror failed", e)
                activity.runOnUiThread {
                    host.evaluateJavascript("window.ZylodNativeBridge?.onTokenMirrorError?.()")
                }
            }
        }
    }

    /** Invokes callback(count) with the number of actions awaiting sync. */
    @JavascriptInterface
    fun getOfflineQueueCount(callbackJsFunction: String) {
        scope.launch {
            val count = try {
                ZylodApp.instance.database.syncQueueDao().getPendingCount()
            } catch (_: Exception) {
                0
            }
            host.evaluateJavascript("$callbackJsFunction($count)")
        }
    }

    /** Re-runs backend discovery (used by the offline shell's retry button). */
    @JavascriptInterface
    fun retryServerConnection() {
        activity.runOnUiThread {
            host.retryServerConnection()
        }
    }

    /** Stable per-install device identifier (created on first call). */
    @JavascriptInterface
    fun getDeviceId(): String {
        val prefs = activity.getSharedPreferences("zylod_config", Context.MODE_PRIVATE)
        val existing = prefs.getString("device_id", null)
        if (existing != null) return existing
        val id = java.util.UUID.randomUUID().toString()
        prefs.edit().putString("device_id", id).apply()
        return id
    }

    /**
     * Copies text via the native ClipboardManager. The WebView exposes no
     * navigator.clipboard on non-secure (http) origins.
     */
    @JavascriptInterface
    fun copyToClipboard(text: String): Boolean {
        return try {
            val manager = activity.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            manager.setPrimaryClip(android.content.ClipData.newPlainText("Zylod", text))
            true
        } catch (_: Exception) {
            false
        }
    }

    /** Native speech recognition — the WebView has no Web Speech API. */
    @JavascriptInterface
    fun startVoiceRecognition(callbackJsFunction: String) {
        activity.runOnUiThread {
            host.startVoiceRecognition(callbackJsFunction)
        }
    }

    /** Invokes callback(granted) with the native notification permission state. */
    @JavascriptInterface
    fun requestNativeNotificationPermission(callbackJsFunction: String) {
        val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        host.evaluateJavascript("$callbackJsFunction($granted)")
    }

    /** Posts a notification through the app's native channels. */
    @JavascriptInterface
    fun showNativeNotification(title: String, body: String, channelId: String?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val channel = when (channelId) {
            ZylodApp.CHANNEL_ESCROW -> ZylodApp.CHANNEL_ESCROW
            ZylodApp.CHANNEL_DEALS -> ZylodApp.CHANNEL_DEALS
            else -> ZylodApp.CHANNEL_ORDERS
        }

        val notification = NotificationCompat.Builder(activity, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(activity).notify(notificationIds.incrementAndGet(), notification)
    }

    /** Opens the native CameraX/MLKit scanner; result goes to callback(success, code|null). */
    @JavascriptInterface
    fun startBarcodeScanner(callbackJsFunction: String) {
        activity.runOnUiThread {
            host.startBarcodeScanner(callbackJsFunction)
        }
    }

    @JavascriptInterface
    fun requestBiometricAuth(callbackJsFunction: String) {
        activity.runOnUiThread {
            // androidx.biometric requires a FragmentActivity host. Both shells
            // qualify (legacy: AppCompatActivity; Compose: FragmentActivity) —
            // anything else degrades to a reported auth error, never a crash.
            val fragmentActivity = activity as? FragmentActivity
            if (fragmentActivity == null) {
                host.evaluateJavascript(
                    "$callbackJsFunction(false, 'Biometric authentication is not available here')"
                )
                return@runOnUiThread
            }
            val executor = ContextCompat.getMainExecutor(activity)
            val prompt = BiometricPrompt(
                fragmentActivity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        host.evaluateJavascript("$callbackJsFunction(true, null)")
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        host.evaluateJavascript("$callbackJsFunction(false, '${errString.toString().replace("'", "\\'")}')")
                    }
                }
            )

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("SafePay Biometric Verification")
                .setSubtitle("Confirm identity with fingerprint or face")
                .setNegativeButtonText("Cancel")
                .build()

            prompt.authenticate(promptInfo)
        }
    }

    @JavascriptInterface
    fun enqueueOfflineAction(actionType: String, entityType: String, payloadJson: String) {
        scope.launch {
            // Room/disk failures are data problems, not crashes: tell the page.
            runCatching {
                val item = SyncQueueItem(
                    actionType = actionType,
                    entityType = entityType,
                    payloadJson = payloadJson
                )
                ZylodApp.instance.database.syncQueueDao().enqueueItem(item)
                // Try to drain the queue right away when a connection is available;
                // otherwise the reconnect listener in ZylodApp picks it up.
                OfflineSyncScheduler.schedule(activity.applicationContext)
            }.onFailure { e ->
                android.util.Log.w("ZylodBridge", "offline enqueue failed", e)
                activity.runOnUiThread {
                    Toast.makeText(activity, "Could not save the operation for offline sync.", Toast.LENGTH_SHORT).show()
                }
                return@launch
            }
            activity.runOnUiThread {
                Toast.makeText(activity, "Operation saved offline. Will sync when connected.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Caches a JSON array of products (as returned by /api/products) into the
     * Room offline cache so [searchOfflineProducts] can serve them with no
     * connection. Invokes callback(count) when done.
     */
    @JavascriptInterface
    fun cacheOfflineProducts(productsJson: String, callbackJsFunction: String) {
        scope.launch {
            val dao = ZylodApp.instance.database.productDao()
            val count = try {
                val products = JSONArray(productsJson).toOfflineProducts()
                if (products.isNotEmpty()) {
                    dao.insertAll(products)
                    products.size
                } else {
                    0
                }
            } catch (_: Exception) {
                -1
            }
            host.evaluateJavascript("$callbackJsFunction($count)")
        }
    }

    /** Invokes callback(jsonArrayString) with cached products matching [query]. */
    @JavascriptInterface
    fun searchOfflineProducts(query: String, callbackJsFunction: String) {
        scope.launch {
            val json = try {
                val rows = ZylodApp.instance.database.productDao().searchProducts(query)
                JSONArray().apply {
                    rows.forEach { row ->
                        put(JSONObject().apply {
                            put("id", row.id)
                            put("name", row.title)
                            put("slug", row.slug)
                            put("priceBDT", row.priceBDT)
                            put("minOrderQuantity", row.minOrderQuantity)
                            put("supplierName", row.supplierName ?: JSONObject.NULL)
                            put("imageUrl", row.imageUrl ?: JSONObject.NULL)
                            put("categoryName", row.categoryName ?: JSONObject.NULL)
                            put("stock", row.stock)
                            put("unit", row.unit)
                        })
                    }
                }.toString()
            } catch (_: Exception) {
                "[]"
            }
            host.evaluateJavascript("$callbackJsFunction(${JSONObject.quote(json)})")
        }
    }

    /** Invokes callback(count) with the number of cached products. */
    @JavascriptInterface
    fun getOfflineProductCount(callbackJsFunction: String) {
        scope.launch {
            val count = try {
                ZylodApp.instance.database.productDao().countAll()
            } catch (_: Exception) {
                -1
            }
            host.evaluateJavascript("$callbackJsFunction($count)")
        }
    }

    @JavascriptInterface
    fun clearLocalAppCache() {
        scope.launch {
            runCatching {
                ZylodApp.instance.database.productDao().clearAll()
            }.onFailure { e ->
                android.util.Log.w("ZylodBridge", "local cache clear failed", e)
            }
            activity.runOnUiThread {
                host.clearWebViewCache()
                Toast.makeText(activity, "Local storage & product cache cleared.", Toast.LENGTH_SHORT).show()
            }
        }
    }
}

/** Maps /api/products rows onto the offline cache entity, tolerating shape drift. */
private fun JSONArray.toOfflineProducts(): List<OfflineProduct> {
    val result = mutableListOf<OfflineProduct>()
    for (i in 0 until length()) {
        val obj = optJSONObject(i) ?: continue
        val id = obj.optString("id")
        val title = obj.optString("name").ifEmpty { obj.optString("title") }
        if (id.isEmpty() || title.isEmpty()) continue
        val basePrice = obj.optDouble("basePrice", Double.NaN).takeIf { !it.isNaN() }
            ?: obj.optDouble("price", 0.0)
        val supplier = obj.optJSONObject("supplier")
        val category = obj.optJSONObject("category")
        result.add(
            OfflineProduct(
                id = id,
                title = title,
                slug = obj.optString("slug").ifEmpty { id },
                priceBDT = basePrice,
                minOrderQuantity = obj.optInt("moq", obj.optInt("minOrderQuantity", 1)),
                supplierName = supplier?.optString("companyName")?.ifEmpty { null }
                    ?: obj.optString("supplierName").ifEmpty { null },
                imageUrl = obj.optString("thumbnailUrl").ifEmpty { null }
                    ?: obj.optString("imageUrl").ifEmpty { null },
                categoryName = category?.optString("name")?.ifEmpty { null }
                    ?: obj.optString("categoryName").ifEmpty { null },
                stock = obj.optInt("stockQuantity", obj.optInt("stock", 0)),
                unit = obj.optString("unit").ifEmpty { "pcs" }
            )
        )
    }
    return result
}
