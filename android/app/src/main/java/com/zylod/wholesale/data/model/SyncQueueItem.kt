package com.zylod.wholesale.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_sync_queue")
data class SyncQueueItem(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val actionType: String, // CREATE_ORDER, SAVE_WISHLIST, SUBMIT_RFQ
    val entityType: String,
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
    val retryCount: Int = 0,
    val isSynced: Boolean = false
)
