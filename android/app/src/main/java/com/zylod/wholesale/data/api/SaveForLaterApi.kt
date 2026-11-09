package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * t282 — SAVE-FOR-LATER (SPA pageId "save-for-later"), closing the
 * WishlistApi.kt t259 NON-DECLARATION note verbatim: "the routes stay
 * undeclared UNTIL a native pageId actually renders them". That pageId now
 * exists — the typed ui.wishlist.SaveForLaterScreen — so the real routes are
 * declared here (in their own file, never re-declared onto WishlistApi):
 *
 *  - GET api/save-for-later — AUTHENTICATED (401 otherwise). data is the RAW
 *    savedForLater rows (id/userId/productId/variantId/quantity/movedFrom/
 *    createdAt/updatedAt — NOT a shaped projection) + product select
 *    {id, name, slug, basePrice, currency, unit, moq, stockQuantity,
 *    ratingAvg, reviewCount, thumbnailUrl, isActive, supplier
 *    {companyName, verificationStatus}, priceTiers take 3 (minQty asc)} +
 *    meta { count }. Newest-first (createdAt desc). NOTE the web component
 *    (save-for-later-page.tsx) reads `data.items` — a field this envelope
 *    has NEVER carried — so the web page renders empty on every load; the
 *    native reads the REAL `data` array.
 *  - DELETE api/save-for-later/{itemId} — owner-scoped deleteMany by ROW id
 *    (the web page's per-row Remove + Clear-All loop + the web's Move-to-Cart
 *    follow-up delete). 200 { success, message: 'Item removed' }.
 *
 * DELIBERATE NON-DECLARATIONS (still true after t282):
 *  - POST api/save-for-later ({ productId, variantId?, quantity, movedFrom })
 *    — the route is real but NO native surface saves a cart line for later
 *    yet (the native cart has no per-line "Save for later" action; the
 *    aforesaid skip-doctrine keeps it undeclared until one does).
 *  - GET api/save-for-later/{itemId} does not exist server-side (the item
 *    route is DELETE-only) — the "save-for-later-detail" pageId keeps its
 *    existing registry row untouched.
 *  - Move-to-Cart goes through the EXISTING CartApi.addItem (CommerceApis.kt
 *    — POST api/cart {productId, quantity}; the server resolves the supplier
 *    itself, exactly what the web page sends). One cart write surface, never
 *    redeclared.
 *
 * WIRE NOTES (dc74841 lesson): nullable-with-default everywhere so shape
 * drift degrades into the screen mappers; timestamps ISO verbatim; money raw
 * Double; MOQ/stock Double (apiQty renders).
 */
interface SaveForLaterApi {

    /** GET api/save-for-later — the signed-in buyer's saved-for-later rows. */
    @GET("api/save-for-later")
    suspend fun list(): Response<SaveForLaterEnvelope>

    /** DELETE api/save-for-later/{itemId} — remove one row by ROW id. */
    @DELETE("api/save-for-later/{itemId}")
    suspend fun remove(@Path("itemId") itemId: String): Response<WishlistMessageEnvelope>
}

/* ─── GET api/save-for-later ─────────────────────────────────────────────── */

/** Envelope of GET api/save-for-later — data = raw rows, meta = { count }. */
@Immutable
@Serializable
data class SaveForLaterEnvelope(
    val success: Boolean = false,
    val data: List<SaveForLaterRowDto> = emptyList(),
    val meta: SaveForLaterMetaDto? = null,
    val error: String? = null,
)

/** { count } — the list route's only meta field. */
@Immutable
@Serializable
data class SaveForLaterMetaDto(val count: Int = 0)

/**
 * One RAW savedForLater row as the GET answers it (the route ships the
 * prisma row verbatim — no shaping): quantity is the qty saved from the
 * cart, movedFrom is the surface it was saved from ('cart' by convention).
 */
@Immutable
@Serializable
data class SaveForLaterRowDto(
    val id: String? = null,
    val userId: String? = null,
    val productId: String? = null,
    val variantId: String? = null,
    val quantity: Double = 1.0,
    val movedFrom: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val product: SaveForLaterProductDto? = null,
) {
    /** Stable identity for keyed collections (row id, product id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: productId?.takeIf(String::isNotBlank)
            ?: "save-for-later-${hashCode()}"

    /** The productId a row tap routes to (row productId → product id). */
    val effectiveProductId: String?
        get() = productId?.takeIf(String::isNotBlank) ?: product?.id?.takeIf(String::isNotBlank)

    /**
     * The quantity Move-to-Cart sends: the saved qty, never below the
     * product's MOQ (the cart route validates MOQ on the write).
     */
    val moveQty: Double
        get() {
            val moq = product?.moq?.takeIf { it > 0.0 } ?: 1.0
            return if (quantity >= moq) quantity else moq
        }
}

/** The product select the save-for-later list nests on every row. */
@Immutable
@Serializable
data class SaveForLaterProductDto(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val basePrice: Double = 0.0,
    val currency: String? = null,
    val unit: String? = null,
    val moq: Double = 1.0,
    val stockQuantity: Double = 0.0,
    val ratingAvg: Double = 0.0,
    val reviewCount: Int = 0,
    val thumbnailUrl: String? = null,
    val isActive: Boolean? = null,
    val supplier: SaveForLaterSupplierDto? = null,
    val priceTiers: List<PriceTierDto> = emptyList(),
) {
    /** The web's hasBulkPricing — any tier row present (take 3 on this route). */
    val hasBulkPricing: Boolean get() = priceTiers.isNotEmpty()
}

/** The supplier projection inside the save-for-later product select. */
@Immutable
@Serializable
data class SaveForLaterSupplierDto(
    val companyName: String? = null,
    val verificationStatus: String? = null,
) {
    /** The web's isVerified gate (PDP + storefront vocabulary). */
    val isVerified: Boolean
        get() = verificationStatus == "APPROVED" || verificationStatus == "VERIFIED"
}
