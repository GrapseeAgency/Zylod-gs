package com.zylod.wholesale.data.api

import kotlinx.serialization.Serializable

/*
 * Cart/wishlist/order DTOs — verified against cart/route.ts, cart/[itemId]/route.ts,
 * wishlist/route.ts and orders/create-direct/route.ts. The local persisted item
 * mirrors src/store/cart-store.ts CartItemData field-for-field (merge key
 * `productId::variantId`, tier-based calculatePrice).
 */

/** Local + server-mapped cart line item (cart-store.ts:4-23). */
@Serializable
data class CartItemData(
    val id: String,
    val productId: String,
    val productName: String,
    val productSlug: String = "",
    val productImage: String? = null,
    val variantId: String? = null,
    val variantName: String? = null,
    val variantValue: String? = null,
    val quantity: Int = 1,
    val unitPrice: Double = 0.0,
    val totalPrice: Double = 0.0,
    val moq: Int = 1,
    val maxOrderQty: Int? = null,
    val supplierId: String,
    val supplierName: String = "",
    val supplierSlug: String = "",
    val unit: String = "",
    val priceTiers: List<PriceTierDto> = emptyList(),
) {
    val mergeKey: String get() = "$productId::${variantId ?: "null"}"
}

/** cart-store.ts:43-56 — tier-priced total, ported verbatim. */
fun calculatePrice(item: CartItemData, quantity: Int): Double {
    var applicablePrice = item.unitPrice
    if (item.priceTiers.isNotEmpty()) {
        for (tier in item.priceTiers) {
            if (quantity >= tier.minQty && (tier.maxQty == null || quantity <= tier.maxQty)) {
                applicablePrice = tier.pricePerUnit
                break
            }
        }
    }
    return applicablePrice * quantity
}

/* ─── GET /api/cart (cart/route.ts:71-79) ─── */

@Serializable
data class ServerCartDto(
    val cartId: String? = null,
    val totalItems: Int = 0,
    val totalAmount: Double = 0.0,
    val suppliers: List<ServerCartSupplierDto> = emptyList(),
)

@Serializable
data class ServerCartSupplierDto(
    val supplierId: String? = null,
    val supplierName: String? = null,
    val subtotal: Double = 0.0,
    val items: List<ServerCartItemDto> = emptyList(),
)

@Serializable
data class ServerCartItemDto(
    val id: String,
    val productId: String? = null,
    val variantId: String? = null,
    val quantity: Int = 0,
    val supplierId: String? = null,
    val product: ServerCartProductDto? = null,
    val variant: ServerCartVariantDto? = null,
)

@Serializable
data class ServerCartProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val thumbnailUrl: String? = null,
    val moq: Int = 1,
    val unit: String? = null,
    val images: List<ProductImageDto> = emptyList(),
    val priceTiers: List<PriceTierDto> = emptyList(),
    val supplier: SupplierBrief? = null,
)

@Serializable
data class ServerCartVariantDto(
    val variantName: String? = null,
    val variantValue: String? = null,
    val priceOverride: Double? = null,
)

/**
 * Maps a server cart row into the local item shape. Field mapping mirrors
 * cart-store.ts syncWithApi (L160-185): unitPrice/totalPrice from basePrice ×
 * qty, supplierName from the supplier group, image from first product image.
 */
fun ServerCartItemDto.toCartItemData(supplierName: String): CartItemData? {
    val pid = productId ?: product?.id ?: return null
    val product = product
    val image = product?.images
        ?.filter { !it.imageUrl.isNullOrBlank() }
        ?.minByOrNull { it.sortOrder }?.imageUrl
        ?: product?.thumbnailUrl
    val qty = quantity
    val unitPrice = product?.basePrice ?: 0.0
    return CartItemData(
        id = id, // server cartItem id — real, so PUT/DELETE target it
        productId = pid,
        productName = product?.name.orEmpty(),
        productSlug = product?.slug.orEmpty(),
        productImage = image,
        variantId = variantId,
        variantName = variant?.variantName,
        variantValue = variant?.variantValue,
        quantity = qty,
        unitPrice = unitPrice,
        totalPrice = qty * unitPrice,
        moq = product?.moq ?: 1,
        maxOrderQty = null,
        supplierId = supplierId ?: product?.supplier?.companyName.orEmpty(),
        supplierName = supplierName,
        supplierSlug = "",
        unit = product?.unit ?: "piece",
        priceTiers = product?.priceTiers.orEmpty(),
    )
}

/* ─── GET /api/wishlist (cursor meta shape) ─── */

@Serializable
data class WishlistEnvelope(
    val success: Boolean = false,
    val data: List<WishlistItemDto> = emptyList(),
    val meta: CursorMeta? = null,
    val error: String? = null,
)

@Serializable
data class CursorMeta(val count: Int = 0, val hasMore: Boolean = false, val nextCursor: String? = null)

@Serializable
data class WishlistItemDto(
    val id: String? = null,
    val productId: String? = null,
    val product: ProductDto? = null,
)

/** POST /api/orders/create-direct response is the standard envelope. */
@Serializable
data class CreateDirectEnvelope(
    val success: Boolean = false,
    val data: CreateDirectData? = null,
    val error: String? = null,
)
