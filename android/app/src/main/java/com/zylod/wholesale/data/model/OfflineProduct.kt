package com.zylod.wholesale.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_products")
data class OfflineProduct(
    @PrimaryKey val id: String,
    val title: String,
    val slug: String,
    val priceBDT: Double,
    val minOrderQuantity: Int,
    val supplierName: String?,
    val imageUrl: String?,
    val categoryName: String?,
    val stock: Int,
    val unit: String,
    val cachedAt: Long = System.currentTimeMillis()
)
