package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import java.util.Locale

/**
 * t279 — every Prisma Float column (moq/stockQuantity/soldCount/cart quantity)
 * can carry decimals (kg: 2.5 is a valid line). The legacy Phase-1 DTOs typed
 * these as Int, so one fractional value made kotlinx.serialization throw and
 * fail the WHOLE list parse (screen error state). They are all Double now;
 * display collapses whole values ("10") and keeps fractional ones ("2.5")
 * — the supplierCoreQty convention, shared by every non-suppliercore surface.
 */
fun Double?.apiQty(): String {
    if (this == null || isNaN()) return "—"
    if (this == toLong().toDouble()) return toLong().toString()
    return String.format(Locale.US, "%.2f", this).trimEnd('0').trimEnd('.')
}

/** Whole-value Int view of a Double qty (steppers/MOQ clamps — native steps
 * in whole units; ceil so a 2.5 MOQ clamps to 3 purchasable units). */
fun Double?.apiQtyInt(default: Int = 1): Int {
    if (this == null || isNaN()) return default
    return Math.ceil(this).toInt()
}

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
    val moq: Double = 1.0,
    // t262 — the wishlist/favorites product selects ship stockQuantity (the
    // web maps it into the stock badges); every other reader keeps the
    // defaulted 0.
    val stockQuantity: Double = 0.0,
    val soldCount: Double = 0.0,
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

// t233 — native Home banner rail: GET api/banners?position=home_top returns
// data as { banners: [...] } — only active, in-schedule rows, public fields.
@Immutable
@Serializable
data class BannerDto(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val imageUrl: String? = null,
    val linkPageId: String? = null,
    val linkParams: String? = null,
    val position: String? = null,
    val sortOrder: Int = 0,
)

@Serializable
data class BannersData(
    val banners: List<BannerDto> = emptyList(),
)
