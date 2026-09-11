package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

//
// @Immutable on every wire model that reaches composition: Compose's default
// inference treats List<*>/nested models as UNSTABLE, which made every
// product card non-skippable — any ViewModel emission recomposed the whole
// visible grid mid-scroll. These models are replaced wholesale on update
// (never mutated in place), so the annotation is sound and cards become
// skippable again.
//

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

@Immutable
@Serializable
data class SupplierBrief(val companyName: String? = null)

@Immutable
@Serializable
data class CategoryBrief(val name: String? = null, val slug: String? = null)

@Immutable
@Serializable
data class CategoryDto(
    val id: String,
    val name: String,
    val slug: String? = null,
    val productCount: Int = 0,
    val supplierCount: Int = 0,
    val children: List<CategoryDto> = emptyList(),
)

@Immutable
@Serializable
data class ProductImageDto(
    val id: String? = null,
    val imageUrl: String? = null,
    val sortOrder: Int = 0,
)

@Immutable
@Serializable
data class ProductDto(
    val id: String,
    val name: String,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val thumbnailUrl: String? = null,
    val images: List<ProductImageDto> = emptyList(),
    val unit: String? = null,
    val moq: Int = 1,
    val soldCount: Int = 0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val supplier: SupplierBrief? = null,
    val category: CategoryBrief? = null,
) {
    // Real API: images are objects with relative imageUrl paths sorted by sortOrder.
    val firstImage: String?
        get() = images.filter { !it.imageUrl.isNullOrBlank() }.minByOrNull { it.sortOrder }?.imageUrl
            ?: thumbnailUrl
}

// /api/deals returns data as { flashDeals: [...], dailyDeals: [...] }
@Immutable
@Serializable
data class DealsData(
    val flashDeals: List<DealDto> = emptyList(),
    val dailyDeals: List<DealDto> = emptyList(),
) {
    val all: List<DealDto> get() = flashDeals + dailyDeals
}

@Immutable
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

@Immutable
@Serializable
data class StatsDto(val productCount: Int = 0, val supplierCount: Int = 0)
