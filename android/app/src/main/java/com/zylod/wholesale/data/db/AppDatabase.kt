package com.zylod.wholesale.data.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.zylod.wholesale.data.model.OfflineProduct
import com.zylod.wholesale.data.model.SyncQueueItem

// t282: exportSchema on — the schema JSON (schemas/…AppDatabase/1.json) is
// committed so future entity changes get real migration tests instead of
// destructive fallbacks (the long-deferred scaffolding item, finally closed).
@Database(
    entities = [OfflineProduct::class, SyncQueueItem::class],
    version = 1,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun productDao(): ProductDao
    abstract fun syncQueueDao(): SyncQueueDao
}
