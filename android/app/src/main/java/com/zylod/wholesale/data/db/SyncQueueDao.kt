package com.zylod.wholesale.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.zylod.wholesale.data.model.SyncQueueItem

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM offline_sync_queue WHERE isSynced = 0 ORDER BY createdAt ASC")
    suspend fun getPendingItems(): List<SyncQueueItem>

    @Insert
    suspend fun enqueueItem(item: SyncQueueItem): Long

    @Update
    suspend fun updateItem(item: SyncQueueItem)

    @Query("DELETE FROM offline_sync_queue WHERE isSynced = 1")
    suspend fun clearCompleted()

    /** t279 — retention purge: burned rows (retryCount ≥ maxRetries, still
     *  unsynced) hold full action payloads (offline orders/RFQs with PII)
     *  forever otherwise; the drain skips them but never deletes them.
     *  Rows older than the cutoff are dropped at drain time. */
    @Query("DELETE FROM offline_sync_queue WHERE isSynced = 0 AND retryCount >= :maxRetries AND createdAt < :olderThanMillis")
    suspend fun purgeBurned(maxRetries: Int, olderThanMillis: Long)

    @Query("SELECT COUNT(*) FROM offline_sync_queue WHERE isSynced = 0")
    suspend fun getPendingCount(): Int
}
