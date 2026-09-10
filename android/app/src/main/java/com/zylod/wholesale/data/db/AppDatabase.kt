package com.zylod.wholesale.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.zylod.wholesale.data.model.OfflineProduct
import com.zylod.wholesale.data.model.SyncQueueItem

@Database(
    entities = [OfflineProduct::class, SyncQueueItem::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun syncQueueDao(): SyncQueueDao
}
