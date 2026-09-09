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
import com.zylod.wholesale.MainActivity
import com.zylod.wholesale.ZylodApp
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
 *                skipped once it exceeds [MAX_RETRIES] (kept, not deleted)
 * - IO error  -> transient; the worker retries with WorkManager backoff
 *
 * A notification on the orders channel confirms delivery to the user.
 */
class OfflineSyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = applicationContext.getSharedPreferences("zylod_config", Context.MODE_PRIVATE)
        val server = prefs.getString("active_server_url", null)
            ?: prefs.getString("custom_server_url", null)
            ?: return@withContext Result.failure()

        val dao = ZylodApp.instance.database.syncQueueDao()
        val pending = dao.getPendingItems().filter { it.retryCount < MAX_RETRIES }
        if (pending.isEmpty()) {
            dao.clearCompleted()
            return@withContext Result.success()
        }

        var syncedCount = 0
        var hadTransientFailure = false

        // Replay as the signed-in user when the WebView mirrored a session
        // token into the encrypted store.
        val authToken = ZylodApp.instance.securePrefs.getString("auth_token", null)

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
            Intent(applicationContext, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, ZylodApp.CHANNEL_ORDERS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Offline actions synced")
            .setContentText("$count queued action(s) delivered to the server.")
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
