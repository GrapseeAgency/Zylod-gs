package com.zylod.wholesale.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object OfflineSyncScheduler {

    private const val UNIQUE_WORK_NAME = "zylod_offline_sync"

    /**
     * Enqueues a queue-drain pass that runs as soon as a network connection
     * is available. Safe to call repeatedly: the unique-work name dedupes.
     *
     * t280 4-a#4: ExistingWorkPolicy.KEEP — REPLACE could CANCEL a drain that
     * was mid-POST (the execute() response never processed, the row stays
     * isSynced=false) and the re-enqueued drain POSTed the same money action
     * again; with the additive ingestion the server saw the order twice. KEEP
     * leaves a running/queued drain alone and drops the new request instead.
     * Per-row idempotency additionally rides eventId (worker + server dedupe).
     */
    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<OfflineSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }
}
