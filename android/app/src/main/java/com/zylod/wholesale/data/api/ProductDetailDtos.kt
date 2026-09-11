package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable

/*
 * GET /api/products/[id] response shapes — verified against
 * src/app/api/products/[id]/route.ts:39-96 (include tree) and the mobile web
 * ApiProduct type (mobile-product-detail-page.tsx:34-49).
 */

@Serializable
data class PdpSupplierDto(
    val id: String,
    val companyName: String? = null,
    val slug: String? = null,
    val city: String? = null,
    val ratingAvg: Double = 0.0,
    val ratingCount: Int = 0,
    val verificationStatus: String? = null,
)

@Serializable
data class PdpCategoryDto(
    val id: String,
    val name: String? = null,
    val slug: String? = null,
    val parentId: String? = null,
)

@Serializable
data class PriceTierDto(
    val id: String? = null,
    val minQty: Int = 1,
    val maxQty: Int? = null,
    val pricePerUnit: Double = 0.0,
)

@Serializable
data class ProductVariantDto(
    val id: String,
    val variantName: String? = null,
    val variantValue: String? = null,
    val stockQuantity: Int = 0,
    val priceOverride: Double? = null,
)

@Serializable
data class ReviewBuyerDto(
    val id: String? = null,
    val buyerProfile: BuyerProfileBrief? = null,
)

@Serializable
data class ReviewDto(
    val id: String,
    val rating: Int = 0,
    val comment: String? = null,
    val images: List<String> = emptyList(),
    val verifiedPurchase: Boolean = false,
    val createdAt: String? = null,
    val buyer: ReviewBuyerDto? = null,
    val replies: List<ReviewDto> = emptyList(),
)

/**
 * Full product row. `images` reuses the list-layer ProductImageDto
 * ({id, imageUrl, sortOrder}) — identical wire shape.
 */
@Serializable
data class ProductDetailDto(
    val id: String,
    val name: String,
    val slug: String? = null,
    val description: String? = null,
    val brand: String? = null,
    val unit: String? = null,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val moq: Int = 1,
    val maxOrderQty: Int? = null,
    val stockQuantity: Int = 0,
    val thumbnailUrl: String? = null,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val soldCount: Int = 0,
    val isCustomizable: Boolean = false,
    val isActive: Boolean = true,
    val isApproved: Boolean = true,
    val supplier: PdpSupplierDto? = null,
    val category: PdpCategoryDto? = null,
    val images: List<ProductImageDto> = emptyList(),
    val priceTiers: List<PriceTierDto> = emptyList(),
    val variants: List<ProductVariantDto> = emptyList(),
    val reviews: List<ReviewDto> = emptyList(),
) {
    val galleryImages: List<String>
        get() = images.mapNotNull { it.imageUrl?.takeIf(String::isNotBlank) }
            .ifEmpty { listOfNotNull(thumbnailUrl?.takeIf(String::isNotBlank)) }
}

/** GET /api/products/[id]/specifications → data.groupedSpecifications (mobile PDP L83-95). */
@Serializable
data class SpecificationsDto(
    val groupedSpecifications: Map<String, List<SpecItemDto>> = emptyMap(),
)

@Serializable
data class SpecItemDto(val specName: String? = null, val specValue: String? = null)
