package com.zylod.wholesale.sync

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.zylod.wholesale.NativeMainActivity
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Drains the offline action queue (offline_sync_queue) to the resolved
 * backend: one POST per queued action to `/api/native/offline-sync`.
 *
 * - HTTP 2xx  -> action marked synced, then deleted by clearCompleted()
 * - HTTP 4xx  -> server rejected it; retryCount is bumped and the action is
 *                skipped once it exceeds [MAX_RETRIES] (kept, not deleted);
 *                401/403 are TRANSIENT (a signed-out period must not burn
 *                the retries of queued actions — t277-1b)
 * - IO error  -> transient; the worker retries with WorkManager backoff
 *
 * A notification on the orders channel confirms delivery to the user.
 *
 * t277-1b P0: the server base is read from ServerConfig.cached() FIRST —
 * this worker used to read "active_server_url"/"custom_server_url", keys
 * only the manual custom-server action writes, while ServerConfig persists
 * "native_base_url" — on every normal install the worker saw no key and
 * Result.failure()d, so the offline queue could NEVER drain and the unique
 * work was not even retried on the next connectivity edge. With no base at
 * all yet, Result.retry() keeps the work alive until resolve() lands.
 */
class OfflineSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = applicationContext.getSharedPreferences("zylod_config", Context.MODE_PRIVATE)
        // t277-1b P0: ServerConfig.cached() is the KEY ServerConfig.resolve()
        // actually writes ("native_base_url"); the legacy keys remain as a
        // fallback for installs that only ever used the manual custom-server
        // action. No base yet -> retry (resolve() may land any moment), never
        // failure() — failure killed the unique work until the next
        // offline->online edge, starving the queue indefinitely.
        val server = (ServerConfig.cached(applicationContext)
            ?: prefs.getString("active_server_url", null)
            ?: prefs.getString("custom_server_url", null))
            ?.trimEnd('/')
            ?: return@withContext Result.retry()

        val dao = ZylodApp.instance.database.syncQueueDao()
        val pending = dao.getPendingItems().filter { it.retryCount < MAX_RETRIES }
        if (pending.isEmpty()) {
            dao.clearCompleted()
            return@withContext Result.success()
        }

        var syncedCount = 0
        var hadTransientFailure = false

        // Replay as the signed-in user when the WebView mirrored a session
        // token into the encrypted store. EncryptedSharedPreferences throws
        // (rather than returning null) when the ciphertext is undecryptable —
        // e.g. after a device restore without its Keystore master key (D4).
        val authToken = runCatching {
            ZylodApp.instance.securePrefs.getString("auth_token", null)
        }.getOrNull()

        for (item in pending) {
            val body = JSONObject()
                .put("actionType", item.actionType)
                .put("entityType", item.entityType)
                .put("payloadJson", item.payloadJson)
                .put("clientCreatedAt", item.createdAt)
                .put("retryCount", item.retryCount)
                .toString()
                .toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("$server/api/native/offline-sync")
                .post(body)
                .apply {
                    if (!authToken.isNullOrBlank()) {
                        header("Authorization", "Bearer $authToken")
                    }
                }
                .build()

            try {
                httpClient.newCall(request).execute().use { response ->
                    when {
                        response.isSuccessful -> {
                            dao.updateItem(item.copy(isSynced = true))
                            syncedCount++
                        }
                        // t277-1b: 401/403 = the session is merely signed-out
                        // or expired — do NOT burn the retry budget (a queued
                        // order placed offline must survive a sign-out gap);
                        // the next drain after re-auth delivers it.
                        response.code == 401 || response.code == 403 -> hadTransientFailure = true
                        response.code in 400..499 -> {
                            dao.updateItem(item.copy(retryCount = item.retryCount + 1))
                        }
                        else -> hadTransientFailure = true
                    }
                }
            } catch (_: IOException) {
                hadTransientFailure = true
            }
        }

        dao.clearCompleted()

        // t279 — retention: rows that burned their whole retry budget MORE
        // than 7 days ago hold full action payloads (offline orders/RFQs with
        // PII) in Room forever otherwise — the drain skipped them but nothing
        // ever deleted them. Drop them at drain time (kept for a week so the
        // failure is still diagnosable in the sync-queue screen).
        runCatching {
            dao.purgeBurned(MAX_RETRIES, System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000)
        }

        if (syncedCount > 0) notifySynced(syncedCount)

        if (hadTransientFailure) Result.retry() else Result.success()
    }

    private fun notifySynced(count: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            applicationContext.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val intent = PendingIntent.getActivity(
            applicationContext,
            0,
            Intent(applicationContext, NativeMainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, ZylodApp.CHANNEL_ORDERS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Offline actions synced")
            // t277-1b honesty: the server persists these events for processing;
            // do not claim the business action itself already executed.
            .setContentText("$count queued action(s) delivered to the server for processing.")
            .setAutoCancel(true)
            .setContentIntent(intent)
            .build()

        NotificationManagerCompat.from(applicationContext).notify(NOTIFICATION_ID, notification)
    }

    companion object {
        private const val MAX_RETRIES = 5
        private const val NOTIFICATION_ID = 4001
    }
}
