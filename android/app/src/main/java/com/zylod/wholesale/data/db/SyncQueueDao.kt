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

    @Query("SELECT COUNT(*) FROM offline_sync_queue WHERE isSynced = 0")
    suspend fun getPendingCount(): Int
}
