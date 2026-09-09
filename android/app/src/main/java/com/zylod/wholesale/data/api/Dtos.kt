package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable

// Wire envelope used by 242/249 API routes: { success, data, pagination?, error? }
@Serializable
data class ApiEnvelope<T>(
    val success: Boolean = false,
    val data: T? = null,
    val pagination: Pagination? = null,
    val error: String? = null,
)

@Serializable
data class Pagination(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 1,
)

@Serializable
data class SupplierBrief(val companyName: String? = null)

@Serializable
data class CategoryBrief(val name: String? = null, val slug: String? = null)

@Serializable
data class CategoryDto(
    val id: String,
    val name: String,
    val slug: String? = null,
    val productCount: Int = 0,
    val supplierCount: Int = 0,
    val children: List<CategoryDto> = emptyList(),
)

@Serializable
data class ProductDto(
    val id: String,
    val name: String,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val thumbnailUrl: String? = null,
    val images: List<String> = emptyList(),
    val unit: String? = null,
    val moq: Int = 1,
    val soldCount: Int = 0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val supplier: SupplierBrief? = null,
    val category: CategoryBrief? = null,
)

@Serializable
data class DealDto(
    val productId: String? = null,
    val productName: String? = null,
    val dealPrice: Double? = null,
    val productThumbnail: String? = null,
    val product: ProductDto? = null,
) {
    val effectiveId: String? get() = productId ?: product?.id
    val effectiveName: String? get() = productName ?: product?.name
    val effectivePrice: Double get() = dealPrice ?: product?.basePrice ?: 0.0
    val effectiveImage: String? get() = productThumbnail ?: product?.thumbnailUrl
}

@Serializable
data class StatsDto(val productCount: Int = 0, val supplierCount: Int = 0)
