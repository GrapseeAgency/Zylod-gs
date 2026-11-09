package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * t282 — the POINTS LEDGER + REDEMPTION rail (SPA pageIds "points-history"
 * and "redeem-points" — both were WebView-forwarded in t281 with the
 * registry note "typed ui/rewards port noted for later"; this is that port).
 *
 * Every route verified against its src/app/api handler:
 *
 *  - GET api/rewards/history?type=&page=&limit= (rewards/history/route.ts) —
 *    AUTHENTICATED. The FULL rewardTransactions ledger of the caller
 *    (earning, redemptions, expirations), newest-first, paginated
 *    { page, limit, total, totalPages }. [type] filters 'earn' | 'redeem'
 *    when non-blank (the web ledger's three tabs: '' / earn / redeem).
 *    Rows are the raw prisma rewardTransactions columns — points NEGATIVE
 *    on redeem rows (the sign IS the data; the UI renders '+' for earn,
 *    the raw negative for redeem exactly like points-history-page.tsx).
 *    Envelope { success, data, pagination }.
 *    NOT redeclared on RewardsApi: that interface's RewardsBookDto already
 *    embeds the last 50 rows for the book screen; the ledger screen needs
 *    the PAGINATED route with the type filter — a different wire call.
 *
 *  - POST api/rewards/redeem body { pointsToRedeem, rewardType } (rewards/
 *    redeem/route.ts, Task 143 doctrine) — AUTHENTICATED, rate-limited
 *    10/min. rewardType 'voucher' | 'wallet_credit'. 10 points = ৳1
 *    (floor); a voucher is a REAL single-use coupon (code POINTS-<value>-
 *    <rand>, 30 days, min order = 3 × value) that lands in the coupon
 *    vault; wallet_credit moves ৳ with a full ledger row. 201
 *    { success, message: 'Redeemed N points successfully!', data:
 *    { pointsRedeemed, cashValueBDT, coupon: {id, code, discountValue}|null,
 *    walletBalanceAfter: Int|null } }. Errors verbatim: 400
 *    'Insufficient point balance — you have X points, this redemption needs
 *    Y' / the zod text; 409 'Insufficient point balance — a concurrent
 *    redemption spent your points. You have X left.'; 401 auth.
 *    NOT redeclared on RewardsApi: that interface's POST api/rewards is the
 *    FIXED-CATALOG redemption ({ redeemId } — credit-50/100/250/500); THIS
 *    is the free-amount redemption the redeem-points page drives. Different
 *    body, different semantics, one interface each.
 *
 * Balance for the redeem screen comes from the EXISTING
 * RewardsApi.loyalty() (LoyaltyStatusDto.pointsBalance) — the same call the
 * web redeem page makes (fetch('/api/rewards/loyalty') → data.data.
 * pointsBalance). Nothing redeclared.
 *
 * WIRE NOTES (dc74841 lesson): nullable-with-default everywhere; the POST
 * body carries its server-required fields with NO Kotlin default (always
 * serialized); money/points are the raw Ints the route emits (points are
 * whole numbers end-to-end).
 */
interface PointsLedgerApi {

    /**
     * GET api/rewards/history — the caller's paginated points ledger.
     * [type] '' | 'earn' | 'redeem' (blank sends no param, the All tab).
     */
    @GET("api/rewards/history")
    suspend fun history(
        @Query("type") type: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<PointsLedgerEnvelope>

    /**
     * POST api/rewards/redeem — exchange points for a voucher or wallet
     * credit (10 pts = ৳1). [rewardType] 'voucher' | 'wallet_credit'.
     */
    @POST("api/rewards/redeem")
    suspend fun redeem(@Body body: PointsRedeemBody): Response<PointsRedeemEnvelope>
}

/* ─── GET api/rewards/history ────────────────────────────────────────────── */

/** Envelope of GET api/rewards/history — data + the route's pagination. */
@Immutable
@Serializable
data class PointsLedgerEnvelope(
    val success: Boolean = false,
    val data: List<PointsLedgerRowDto> = emptyList(),
    val pagination: Pagination? = null,
    val error: String? = null,
)

/**
 * One rewardTransactions row as the ledger answers it — [points] is
 * NEGATIVE on redemptions (the sign is the ledger's own), [description] is
 * the server-written line ('Redeemed N points for ৳X Voucher', order-earn
 * lines, check-in/spin bonuses).
 */
@Immutable
@Serializable
data class PointsLedgerRowDto(
    val id: String? = null,
    val buyerId: String? = null,
    val type: String? = null,
    val points: Int = 0,
    val description: String? = null,
    val relatedEntityId: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "points-row-${hashCode()}"

    /** The web's isEarn test — type === 'earn' drives the green/amber split. */
    val isEarn: Boolean get() = type == "earn"
}

/* ─── POST api/rewards/redeem ────────────────────────────────────────────── */

/**
 * Outgoing POST api/rewards/redeem body — { pointsToRedeem, rewardType }.
 * No Kotlin defaults: both fields are server-required (zod strict) and are
 * ALWAYS serialized.
 */
@Immutable
@Serializable
data class PointsRedeemBody(
    val pointsToRedeem: Int,
    val rewardType: String,
)

/** 201 envelope — [data] carries the issued instrument (coupon XOR wallet). */
@Immutable
@Serializable
data class PointsRedeemEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val data: PointsRedeemDataDto? = null,
    val error: String? = null,
)

/**
 * data of the 201 — coupon is the REAL issued voucher {id, code,
 * discountValue} for rewardType 'voucher'; walletBalanceAfter rides for
 * 'wallet_credit' (null otherwise, exactly like the route).
 */
@Immutable
@Serializable
data class PointsRedeemDataDto(
    val pointsRedeemed: Int = 0,
    val cashValueBDT: Int = 0,
    val coupon: PointsRedeemCouponDto? = null,
    val walletBalanceAfter: Int? = null,
)

/** The issued coupon inside a voucher redemption — the REAL spendable code. */
@Immutable
@Serializable
data class PointsRedeemCouponDto(
    val id: String? = null,
    val code: String? = null,
    val discountValue: Int = 0,
)
