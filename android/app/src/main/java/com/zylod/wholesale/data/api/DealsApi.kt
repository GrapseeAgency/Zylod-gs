package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * GET /api/deals — the NATIVE Hot Deals screen (v2.4.8 ownership row:
 * pageIds "flash-deals" / "daily-deals" / "hot-deals" / "deals" →
 * Destination.Deals, no longer WebView).
 *
 * Wire contract (src/app/api/deals/route.ts): ONE request returns page N of
 * BOTH sections plus per-section pagination meta — the same `skip/limit`
 * window is applied to flashDeals and dailyDeals:
 *
 *   { success,
 *     data: { flashDeals: [...], dailyDeals: [...] },
 *     pagination: { flash: { total, page, limit, totalPages },
 *                   daily: { total, page, limit, totalPages } } }
 *
 * so the screen tracks ONE page counter and stops auto-appending when the
 * page passes max(flash.totalPages, daily.totalPages).
 *
 * This is deliberately a SEPARATE model from the legacy [DealsData]/[DealDto]
 * pair (ZylodApi.flashDeals, home quick tiles): the screen needs the deal-row
 * id (stable LazyColumn keys), discount/stock/supplier fields and the
 * per-section pagination meta — none of which the legacy pair carries.
 * Prisma's Float columns (discountPercent, totalStock, soldCount) are typed
 * Double so a fractional stock figure never breaks parsing.
 */
interface DealsApi {
    @GET("api/deals")
    suspend fun deals(
        @Query("type") type: String = "all",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<DealsPageEnvelope>
}

/** Envelope of GET /api/deals — also the on-disk offline cache payload. */
@Serializable
data class DealsPageEnvelope(
    val success: Boolean = false,
    val data: DealsPageData? = null,
    val pagination: DealsPaginationDto? = null,
    val error: String? = null,
)

@Immutable
@Serializable
data class DealsPageData(
    val flashDeals: List<DealItemDto> = emptyList(),
    val dailyDeals: List<DealItemDto> = emptyList(),
)

@Serializable
data class DealsPaginationDto(
    val flash: DealsPageMetaDto? = null,
    val daily: DealsPageMetaDto? = null,
)

@Serializable
data class DealsPageMetaDto(
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
    val totalPages: Int = 1,
)

/**
 * One formatted deal row (deals/route.ts formatDeal). Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse.
 */
@Immutable
@Serializable
data class DealItemDto(
    val id: String? = null,
    val type: String? = null,
    val productId: String? = null,
    val productName: String? = null,
    val productSlug: String? = null,
    val productThumbnail: String? = null,
    val originalPrice: Double? = null,
    val dealPrice: Double? = null,
    val discountPercent: Double? = null,
    val moq: Int? = null,
    val unit: String? = null,
    val rating: Double? = null,
    val soldCount: Double? = null,
    val totalStock: Double? = null,
    val remainingStock: Double? = null,
    val supplierName: String? = null,
    val supplierId: String? = null,
    val supplierVerified: Boolean? = null,
    val categoryName: String? = null,
    val categorySlug: String? = null,
    val startAt: String? = null,
    val endAt: String? = null,
) {
    /**
     * Stable identity for LazyColumn keys and append-dedup: the deal-row id
     * (unique per FlashDeal/DailyDeal row), falling back to the product id.
     */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: productId?.takeIf(String::isNotBlank)
            ?: "deal-${hashCode()}"
}
