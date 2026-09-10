package com.zylod.wholesale.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.zylod.wholesale.data.model.OfflineProduct
import kotlinx.coroutines.flow.Flow

@Dao
interface ProductDao {
    @Query("SELECT * FROM offline_products ORDER BY cachedAt DESC")
    fun getAllOfflineProducts(): Flow<List<OfflineProduct>>

    @Query("SELECT COUNT(*) FROM offline_products")
    suspend fun countAll(): Int

    @Query("SELECT * FROM offline_products WHERE id = :id LIMIT 1")
    suspend fun getProductById(id: String): OfflineProduct?

    @Query("SELECT * FROM offline_products WHERE title LIKE '%' || :query || '%'")
    suspend fun searchProducts(query: String): List<OfflineProduct>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(products: List<OfflineProduct>)

    @Query("DELETE FROM offline_products")
    suspend fun clearAll()
}
