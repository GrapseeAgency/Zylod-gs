package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Coupon endpoints — the REAL routes under src/app/api/coupons plus the
 * loyalty-points balance under src/app/api/rewards (nested route.ts files):
 *
 *  - GET  api/coupons/my     (coupons/my/route.ts)    the signed-in buyer's
 *    voucher vault with a status filter (active, used, expired). The route
 *    merges claimed platform vouchers (userCoupons rows) and earned personal
 *    vouchers (coupons rows bound to this buyer) into one display shape,
 *    sorts newest-first and paginates. 401 when signed out.
 *  - GET  api/coupons        (coupons/route.ts)       the public platform
 *    campaign list (active, unexpired, page/limit). Anonymous callers get
 *    public rows only; a signed-in buyer additionally sees their own earned
 *    rows (userId set) — those are vault material, see [PlatformCouponDto].
 *  - POST api/coupons/claim  (coupons/claim/route.ts) collect a platform
 *    coupon into the vault. Body: { couponId?, code? }. 201 returns the
 *    created userCoupons row as data; 401 signed out; 403 a voucher bound to
 *    another buyer; 409 already collected or usage limit reached.
 *  - GET  api/coupons/earn  (coupons/earn/route.ts)  the Task 111 reward-tasks
 *    rail. PUBLIC route: guests get the raw active task rows; a signed-in
 *    buyer's rows additionally carry `claimed` (this buyer already earned
 *    the task) and `progress` (the server's REAL proof count vs the target —
 *    orders / reviews / wishlists / check-ins counted server-side).
 *  - POST api/coupons/earn  (coupons/earn/route.ts POST) claim a task
 *    reward. Body: { taskId }. 201 returns the created voucher as data (the
 *    exact userCoupons shape the vault renders); 403 arrives with the
 *    server's honest shortfall wording; 409 "already claimed"; 401 signed
 *    out. One claim per buyer per task — forever (the server enforces it).
 *  - GET  api/rewards        (rewards/route.ts)       loyalty points
 *    balance, tier and next-tier progress. Buyer-only (401 otherwise).
 *
 * Wire style is `{ success, data, pagination? }` — the shared [ApiEnvelope]
 * parses it (same approach as CartApi/OrdersApi/WalletApi). Money fields are
 * Prisma Float columns (schema.prisma coupons.discountPercent,
 * userCoupons.savingsBDT), so they arrive as JSON numbers and parse as
 * Double; dates arrive as ISO strings.
 *
 * POST api/coupons/validate (the checkout preview) is deliberately NOT on
 * this surface: it needs an orderAmount context the My Coupons screen does
 * not have — the checkout flow owns that endpoint.
 */
interface CouponsApi {

    /**
     * GET /api/coupons/my — the buyer's voucher vault, one status filter per
     * call (route caps limit at 50). status: "active" | "used" | "expired".
     */
    @GET("api/coupons/my")
    suspend fun my(
        @Query("status") status: String = "active",
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
    ): Response<ApiEnvelope<List<CouponVaultDto>>>

    /** GET /api/coupons — public platform campaigns, page/limit (cap 50). */
    @GET("api/coupons")
    suspend fun available(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): Response<ApiEnvelope<List<PlatformCouponDto>>>

    /**
     * POST /api/coupons/claim — collect a platform coupon by id (or by code)
     * into the caller's vault; the created userCoupons row comes back as
     * data. Error cases arrive as plain error bodies with 4xx status.
     */
    @POST("api/coupons/claim")
    suspend fun claim(@Body body: CouponClaimRequest): Response<ApiEnvelope<CouponVaultDto>>

    /** GET /api/rewards — loyalty points balance + tier (buyer-only). */
    @GET("api/rewards")
    suspend fun rewards(): Response<ApiEnvelope<RewardsDataDto>>

    /**
     * GET /api/coupons/earn — the active reward tasks. Public: guests get
     * bare rows; signed-in callers get `claimed` + `progress` per row.
     */
    @GET("api/coupons/earn")
    suspend fun earnTasks(): Response<ApiEnvelope<List<EarnTaskDto>>>

    /**
     * POST /api/coupons/earn — claim one task's voucher ({ taskId } only —
     * the route rejects unknown fields). 201 → the created userCoupons row
     * as data; 403/409 arrive as plain error bodies with the server's own
     * wording (the shortfall / already-claimed reason).
     */
    @POST("api/coupons/earn")
    suspend fun claimEarnTask(@Body body: EarnClaimRequest): Response<ApiEnvelope<CouponVaultDto>>
}

/**
 * One vault row of GET /api/coupons/my (the route's VaultCoupon shape) AND
 * the data of POST /api/coupons/claim (the created userCoupons row): the
 * claim route returns the exact same field set, so one DTO parses both.
 * Every field is optional-with-default so shape drift degrades gracefully
 * instead of failing the whole screen's parse — same doctrine as
 * [DealItemDto].
 */
@Immutable
@Serializable
data class CouponVaultDto(
    val id: String? = null,
    val code: String? = null,
    val title: String? = null,
    val discountStyle: String? = null, // percentage | fixed | free-shipping
    val discountLabel: String? = null,
    val status: String? = null, // active | used | expired
    val validUntil: String? = null,
    val savingsBDT: Double? = null,
    val minOrderBDT: Double? = null,
    val categoryLabel: String? = null,
    val categoryColor: String? = null,
    val claimedAt: String? = null,
) {
    /**
     * Stable identity for LazyColumn keys: the vault-row id (unique cuid per
     * userCoupons row, or the bound coupons row id for earned vouchers).
     */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: "vault-${hashCode()}"
}

/**
 * One row of GET /api/coupons — the route returns RAW coupons-table rows
 * (coupons/route.ts:32-46), so the shape is the Prisma model exactly:
 * discountPercent holds the percent for "percentage" and the flat taka
 * amount for "fixed" (the claim route builds its label the same way). A row
 * with userId set is an earned voucher bound to ONE buyer — the vault
 * already shows it, and "claiming" it would spend it (usedCount increments),
 * so the claim rail must treat it as non-claimable.
 */
@Immutable
@Serializable
data class PlatformCouponDto(
    val id: String? = null,
    val code: String? = null,
    val userId: String? = null,
    val discountType: String? = null, // percentage | fixed
    val discountPercent: Double? = null,
    val maxDiscount: Double? = null,
    val minOrderAmount: Double? = null,
    val validFrom: String? = null,
    val validUntil: String? = null,
    val usageLimit: Int? = null,
    val usedCount: Int? = null,
    val isActive: Boolean? = null,
) {
    /** Stable identity for LazyColumn keys: the coupons-row id. */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: "coupon-${hashCode()}"
}

/**
 * POST /api/coupons/claim body — the route rejects unknown fields, and
 * ApiClient.json drops nulls (explicitNulls = false), so a couponId-only
 * request serializes to exactly `{ "couponId": "..." }`.
 */
@Serializable
data class CouponClaimRequest(
    val couponId: String? = null,
    val code: String? = null,
)

/** data of GET /api/rewards (rewards/route.ts:51-68). */
@Immutable
@Serializable
data class RewardsDataDto(
    val balance: Int? = null,
    val totalEarned: Int? = null,
    val totalRedeemed: Int? = null,
    val tier: String? = null,
    val nextTier: RewardsNextTierDto? = null,
)

/** nextTier of GET /api/rewards (rewards/route.ts:58). */
@Immutable
@Serializable
data class RewardsNextTierDto(
    val tier: String? = null,
    val pointsNeeded: Int? = null,
    val progressPct: Int? = null,
)

/**
 * One row of GET /api/coupons/earn — the route returns RAW
 * couponEarningTasks rows for guests, enriched with `claimed` + `progress`
 * for the signed-in caller (coupons/earn/route.ts:36-68). Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole rail — same doctrine as [CouponVaultDto].
 */
@Immutable
@Serializable
data class EarnTaskDto(
    val id: String? = null,
    val type: String? = null, // first_order | review | wishlist | bulk | milestone | spin | checkin
    val title: String? = null,
    val description: String? = null,
    val rewardLabel: String? = null,
    val rewardBDT: Double? = null,
    val iconColor: String? = null,
    val targetCount: Int? = null,
    val isActive: Boolean? = null,
    /** Signed-in extras — absent (null) on guest rows. */
    val claimed: Boolean? = null,
    val progress: EarnProgressDto? = null,
)

/** progress of a signed-in GET /api/coupons/earn row (route's own shape). */
@Immutable
@Serializable
data class EarnProgressDto(
    val count: Int? = null,
    val required: Int? = null,
    val met: Boolean? = null,
)

/** POST /api/coupons/earn body — the route rejects everything but taskId. */
@Serializable
data class EarnClaimRequest(val taskId: String)
