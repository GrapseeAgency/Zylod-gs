package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Rewards / referral / affiliate surfaces (t259) — the REAL routes behind
 * the nine native rewards pageIds (buyer-rewards, reward-points,
 * loyalty-points, loyalty-program, referral-program, referral-program-page,
 * referral-earnings, affiliate-program, affiliate-dashboard). Every route
 * was verified against its src/app/api handler:
 *
 *  - GET api/rewards (rewards/route.ts GET) — BUYER-SCOPED via
 *    requireUserType(['buyer']): a guest OR a supplier session gets 401
 *    with the route's auth.error text. The find-or-create buyerRewards row
 *    (so a 200 always carries a live balance), the tier computed from the
 *    server's own TIERS table (bronze 0 / silver 1000 / gold 5000 /
 *    platinum 15000 on totalEarned), the nextTier progress triple, the
 *    fixed 4-item redemption catalog (credit-50/100/250/500 wallet credit)
 *    and the last 50 rewardTransactions rows (points NEGATIVE on redeem —
 *    the sign is the ledger's own). NOTE: CouponsApi declares the SAME path
 *    with a minimal projection (rewards()/RewardsDataDto) for the coupon
 *    vault's points strip — NOT redeclared there; the native rewards screen
 *    needs the FULL book (redeemOptions + history), so this interface
 *    carries its own richer DTOs (distinct class names, same wire shape).
 *  - POST api/rewards (rewards/route.ts POST) — the catalog REDEMPTION.
 *    Rate limit 5/min 'rewards-catalog-redeem'; Zod STRICT { redeemId }.
 *    Errors: 401 first; 400 'Invalid redemption request' (zod) |
 *    'Invalid redemption option' (unknown id) | "Not enough points — you
 *    have X, this needs Y" (the REAL balance spelled out); 409
 *    "Not enough points — a concurrent redemption spent them first. You
 *    have X left." (the conditional-decrement race guard at the write).
 *    Success 200 { success, message: 'Redeemed ৳X Wallet Credit successfully',
 *    data: { redeemed, pointsSpent, walletBalanceAfter } } — the credit
 *    lands in the wallet WITH a walletTransactions ledger row server-side.
 *  - GET api/rewards/loyalty (rewards/loyalty/route.ts) — ANY authenticated
 *    account (it upserts 150 welcome points on first create, so suppliers
 *    see a real row too; only guests 401). Answers pointsBalance /
 *    totalEarned / totalRedeemed / tier / nextTier ('max' at platinum) /
 *    pointsNeededForNextTier / tierProgressPercent / cashValueBDT
 *    (10 points = ৳1, floored server-side).
 *  - GET api/referrals (referrals/route.ts) — find-or-create the caller's
 *    referral code (rewardPoints 500 per verified business): answers code,
 *    shareUrl, rewardPerReferral, totalInvited, successfulReferrals,
 *    totalPointsEarned (500 × the rewardGiven uses) and referralHistory
 *    (the referralUses rows newest-first, each with the referredUser
 *    projection { id, email, createdAt }).
 *  - POST api/referrals/claim (referrals/claim/route.ts, rate limit 10/min)
 *    — apply a FRIEND'S code: body { referralCode } (uppercased
 *    server-side). Errors: 401 first; 400 'referralCode is required' |
 *    'You cannot use your own referral code'; 404 'Invalid or inactive
 *    referral code'; 409 'You have already applied a referral code'.
 *    Success 201 { success, message: 'Referral code claimed! +300 Points
 *    and ৳200 voucher added to your account.', data: the created
 *    referralUses row } — the referrer gets +500 points, the caller +300
 *    points and a WELCOME-<code> voucher, all server-side.
 *  - GET api/affiliate (affiliate/route.ts GET) — enrollment STATUS, a
 *    THREE-shape answer parsed by [AffiliateStatusEnvelope]: not enrolled
 *    → 200 { enrolled: false, message: 'User is not yet enrolled in the
 *    affiliate program' } (NO success field, NO data); enrolled → 200
 *    { enrolled: true, data: { ...affiliateProfiles row, trackingLink,
 *    commissionPercent: '5%' } }; guest → 401 { error }.
 *  - POST api/affiliate (affiliate/route.ts POST, rate limit 5/min
 *    'affiliate-apply') — the JOIN, with NO request body. Already enrolled
 *    → 200 { success, message: 'Already enrolled', data: profile }; new →
 *    201 { success, message: 'Successfully enrolled in the Zylod Wholesale
 *    Affiliate Partner Program!', data: profile } (AFF-… code, 5% default
 *    rate, status 'active').
 *  - GET api/affiliate/dashboard (affiliate/dashboard/route.ts) — the
 *    conversion analytics: 404 'Affiliate profile not found' when the
 *    caller has no profile (the honest gate — no zero-shaped KPI cards
 *    from a missing enrollment), 401 for guests; 200 { success, data: {
 *    affiliateCode, trackingUrl, stats: { totalClicks, totalOrders,
 *    conversionRate ('12.5%'), commissionRate ('5%'), totalEarningsBDT,
 *    pendingPayoutBDT, paidPayoutBDT }, recentConversions: [] } }.
 *    recentConversions is ALWAYS the empty list (the route's own t220
 *    honesty fix — no per-conversion ledger exists server-side), so the
 *    native screen renders it as the honest empty state; the row DTO below
 *    mirrors the web component's expected fields so a future server
 *    population parses without a Kotlin change.
 *
 *  - t260 EXTENSION — VIP + daily-engagement surfaces. The t259 note below
 *    used to exclude check-in/spin because no t259 pageId hosted them; the
 *    twelve t260 pageIds DO, so the routes now live on this interface:
 *  - GET api/vip (vip/route.ts GET, 97 lines) — the ONLY vip route. PUBLIC
 *    by design: authenticateRequest is not gated, a guest session still
 *    gets the full tier ladder with currentTier 'standard' / totalSpend 0
 *    (an authed buyer's spend = the SUM of their PAID orders' totalAmount).
 *    data = { currentTier, totalSpendBDT, tiers: VIP_TIERS } where each
 *    tier row is { id, name, minSpendBDT, badge, color, benefits[] } —
 *    standard ৳0 Bronze #78716C / silver ৳100,000 Silver #94A3B8 /
 *    gold ৳500,000 Gold #F59E0B / platinum ৳2,000,000 Platinum #C62828,
 *    benefits verbatim from the route's const. NO next-tier object and NO
 *    per-user progress exist on the wire — the screen renders the ladder
 *    + the real spend, never an invented progress bar.
 *  - GET api/rewards/checkin (rewards/checkin/route.ts GET) — 401
 *    'Authentication required' for guests; 200 { success, data: {
 *    checkedInToday, currentStreak, todayReward, schedule: the 7-day
 *    STREAK_REWARDS ladder [50,75,100,150,200,300,500], history: the last
 *    30 dailyCheckins rows newest-first } }.
 *  - POST api/rewards/checkin (rewards/checkin/route.ts POST, rate limit
 *    10/min 'rewards-checkin', NO body) — the daily claim. 201 { success,
 *    message: 'Checked in! +<pointsAwarded> points awarded.', data: the
 *    created dailyCheckins row }; 409 { error: 'You have already checked
 *    in today! Come back tomorrow.', alreadyCheckedIn: true } (parsed via
 *    [CheckinSubmitEnvelope] so the flag rides along); 429 with the shared
 *    rate-limit { error: 'Too many requests. Try again in Ns.' }. The POST
 *    credits buyerRewards AND writes the earn ledger row server-side.
 *  - POST api/rewards/spin (rewards/spin/route.ts POST, rate limit 10/min
 *    'rewards-spin', NO body) — the lucky wheel. FREE (no cost field
 *    exists anywhere on the wire) with a hard 3/day cap: over the cap →
 *    429 { error: 'Daily spin limit reached (3/3). Come back tomorrow at
 *    00:00 AM!', spinsRemaining: 0 }. Success 200 { success, data: {
 *    prize: { id, label, type, value, weight }, segmentIndex,
 *    spinsRemaining, spinsToday } } — voucher/free-shipping prizes create
 *    a 7-day SPIN-… user coupon, points prizes credit buyerRewards, both
 *    server-side. The prize table itself is route-internal (no GET), so
 *    the screen shows the web component's own segment labels/colors.
 *  - GET api/rewards/spin-history (rewards/spin-history/route.ts GET) —
 *    401 guests; 200 with the counters OUTSIDE data: { success,
 *    data: [the last 50 spinWinResults rows newest-first], spinsToday,
 *    spinsRemaining: max(0, 3 - spinsToday) } — parsed by the dedicated
 *    [SpinHistoryEnvelope], NOT ApiEnvelope (whose data is a single object).
 *
 *  - api/rewards/history (the points-history pageId) remains undeclared —
 *    still no native screen calls it; the t259 ledger comes from the
 *    api/rewards GET above. api/mini-games (trivia/memory/box) likewise:
 *    none of the t260 pageIds re-hosts those three web games — the native
 *    mini-games hub composes the two GETs above instead, honestly labeled.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every response field is
 * nullable-with-default so shape drift degrades into the screen mappers;
 * bodies give their server-required fields NO Kotlin default (the
 * ReturnSubmitBody convention — always serialized). Money = Double
 * (affiliateProfiles Float columns, wallets.balance); POINTS are Int (the
 * buyerRewards/rewardTransactions Int columns).
 */
interface RewardsApi {

    /* ─── rewards book + catalog redemption (api/rewards) ─────────────────── */

    /**
     * GET api/rewards — the buyer's full rewards book (balance, tier,
     * next-tier progress, the 4-option redemption catalog, the last 50
     * ledger rows). 401 for guests AND non-buyer roles.
     */
    @GET("api/rewards")
    suspend fun rewardsBook(): Response<ApiEnvelope<RewardsBookDto>>

    /**
     * POST api/rewards — redeem a catalog option for wallet credit. The
     * route's verbatim 400/409 texts (with the real balance spelled out)
     * surface in the screen; success message + walletBalanceAfter render
     * inline and the book re-fetches so the balance/history move.
     */
    @POST("api/rewards")
    suspend fun redeem(@Body body: RewardsRedeemBody): Response<FinanceMutationEnvelope<RewardsRedeemResultDto>>

    /* ─── loyalty status (api/rewards/loyalty) ───────────────────────────── */

    /**
     * GET api/rewards/loyalty — the tier card payload (balance, tier,
     * progress to next, cash value). Any authenticated account; 401 guests.
     */
    @GET("api/rewards/loyalty")
    suspend fun loyalty(): Response<ApiEnvelope<LoyaltyStatusDto>>

    /* ─── referrals (api/referrals + api/referrals/claim) ────────────────── */

    /** GET api/referrals — the caller's code, stats and referral history. */
    @GET("api/referrals")
    suspend fun referrals(): Response<ApiEnvelope<ReferralsDataDto>>

    /**
     * POST api/referrals/claim — apply a friend's code. 400/404/409 with
     * the route's verbatim texts; 201 message + the created referralUses
     * row (the same shape the GET's history rows carry).
     */
    @POST("api/referrals/claim")
    suspend fun claimReferral(@Body body: ReferralClaimBody): Response<FinanceMutationEnvelope<ReferralUseRowDto>>

    /* ─── affiliate program (api/affiliate + api/affiliate/dashboard) ────── */

    /**
     * GET api/affiliate — the three-shape enrollment status (see
     * [AffiliateStatusEnvelope]).
     */
    @GET("api/affiliate")
    suspend fun affiliateStatus(): Response<AffiliateStatusEnvelope>

    /** POST api/affiliate — the join (NO body). 200 'Already enrolled' / 201. */
    @POST("api/affiliate")
    suspend fun joinAffiliate(): Response<AffiliateStatusEnvelope>

    /**
     * GET api/affiliate/dashboard — clicks/orders/conversion/payout
     * aggregates. 404 'Affiliate profile not found' when not enrolled.
     */
    @GET("api/affiliate/dashboard")
    suspend fun affiliateDashboard(): Response<ApiEnvelope<AffiliateDashboardDto>>

    /* ─── t260: vip tier ladder (api/vip) ─────────────────────────────────── */

    /**
     * GET api/vip — the platform's REAL tier ladder + the caller's current
     * tier and lifetime PAID spend. Public (guests get 'standard'/0); 500
     * 'Internal server error' on the route's own failure path.
     */
    @GET("api/vip")
    suspend fun vipMatrix(): Response<ApiEnvelope<VipDataDto>>

    /* ─── t260: daily check-in (api/rewards/checkin) ──────────────────────── */

    /**
     * GET api/rewards/checkin — today's claim state, the streak, the
     * server's 7-day reward schedule and the last 30 check-in rows.
     * 401 'Authentication required' for guests.
     */
    @GET("api/rewards/checkin")
    suspend fun checkinStatus(): Response<ApiEnvelope<CheckinStatusDto>>

    /**
     * POST api/rewards/checkin — claim today's check-in (NO body; the
     * route reads nothing from the request). 201 message + row; 409
     * 'You have already checked in today! …' with alreadyCheckedIn; 429
     * rate-limit text — all parsed via [CheckinSubmitEnvelope].
     */
    @POST("api/rewards/checkin")
    suspend fun checkinSubmit(): Response<CheckinSubmitEnvelope>

    /* ─── t260: lucky wheel (api/rewards/spin + spin-history) ─────────────── */

    /**
     * POST api/rewards/spin — one free wheel turn (NO body). 200 prize
     * result; 429 daily-cap / rate-limit text; 401 guests. The screen
     * renders the server's prize verbatim — never a pre-picked animation.
     */
    @POST("api/rewards/spin")
    suspend fun spinSubmit(): Response<ApiEnvelope<SpinResultDto>>

    /**
     * GET api/rewards/spin-history — the last 50 spinWinResults rows PLUS
     * the top-level spinsToday / spinsRemaining counters (see
     * [SpinHistoryEnvelope]). Doubles as the spin screen's status probe
     * (exactly what the web spin-win component calls first).
     */
    @GET("api/rewards/spin-history")
    suspend fun spinHistory(): Response<SpinHistoryEnvelope>
}

/* ─── rewards book (GET api/rewards) ─────────────────────────────────────── */

/**
 * data of GET api/rewards (rewards/route.ts:51-68, the FULL projection —
 * CouponsApi's RewardsDataDto keeps its minimal strip). Points columns are
 * Int on the wire; `tier` is the server's TIERS token (bronze | silver |
 * gold | platinum).
 */
@Immutable
@Serializable
data class RewardsBookDto(
    val balance: Int? = null,
    val totalEarned: Int? = null,
    val totalRedeemed: Int? = null,
    val tier: String? = null,
    val nextTier: RewardsTierProgressDto? = null,
    val redeemOptions: List<RewardsRedeemOptionDto> = emptyList(),
    val history: List<RewardsHistoryRowDto> = emptyList(),
)

/**
 * nextTier of GET api/rewards (rewards/route.ts:58) — null at platinum
 * (the server answers nextTier: null there; progressToNext is 100).
 */
@Immutable
@Serializable
data class RewardsTierProgressDto(
    val tier: String? = null,
    val pointsNeeded: Int? = null,
    val progressPct: Int? = null,
)

/**
 * One GET api/rewards redeemOptions row (rewards/route.ts:44-49 verbatim)
 * — the fixed wallet-credit catalog; `id` is the POST redeemId wire token
 * (credit-50 | credit-100 | credit-250 | credit-500), points the cost,
 * value the BDT credited.
 */
@Immutable
@Serializable
data class RewardsRedeemOptionDto(
    val id: String? = null,
    val label: String? = null,
    val points: Int? = null,
    val type: String? = null,
    val value: Int? = null,
) {
    /** Stable identity for keyed collections (option id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "redeem-option-${hashCode()}"
}

/**
 * One GET api/rewards history row (rewards/route.ts:60-66 verbatim) — a
 * rewardTransactions row; points is NEGATIVE on redeem (the ledger's own
 * sign), type the earn | redeem | expire token.
 */
@Immutable
@Serializable
data class RewardsHistoryRowDto(
    val id: String? = null,
    val type: String? = null,
    val points: Int? = null,
    val description: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "reward-tx-${hashCode()}"
}

/**
 * Outgoing POST api/rewards body — the route's exact field set
 * (rewards/route.ts:95 Zod strict { redeemId }). redeemId has NO Kotlin
 * default (server-required, always serialized).
 */
@Immutable
@Serializable
data class RewardsRedeemBody(
    val redeemId: String,
)

/**
 * data of the POST api/rewards success (rewards/route.ts:190 verbatim):
 * redeemed is the option label, pointsSpent the cost, walletBalanceAfter
 * the REAL wallet balance after the credit (null only if the wire shape
 * drifts — the screen renders it verbatim, never a fabricated number).
 */
@Immutable
@Serializable
data class RewardsRedeemResultDto(
    val redeemed: String? = null,
    val pointsSpent: Int? = null,
    val walletBalanceAfter: Double? = null,
)

/* ─── t260: vip tier ladder (GET api/vip) ────────────────────────────────── */

/**
 * data of GET api/vip (vip/route.ts:85-92 verbatim). totalSpendBDT is the
 * SUM of the buyer's PAID orders' totalAmount (0 for a guest — the route
 * answers guests too, so null only on shape drift). currentTier is the
 * route's token (standard | silver | gold | platinum).
 */
@Immutable
@Serializable
data class VipDataDto(
    val currentTier: String? = null,
    val totalSpendBDT: Double? = null,
    val tiers: List<VipTierDto> = emptyList(),
)

/**
 * One GET api/vip tiers row (vip/route.ts:10-64 VIP_TIERS verbatim):
 * badge is the display token (Bronze…Platinum), color the route's hex
 * ('#F59E0B'…), benefits the verbatim privilege list. minSpendBDT is a
 * plain number on the wire → Double.
 */
@Immutable
@Serializable
data class VipTierDto(
    val id: String? = null,
    val name: String? = null,
    val minSpendBDT: Double? = null,
    val badge: String? = null,
    val color: String? = null,
    val benefits: List<String> = emptyList(),
) {
    /** Stable identity for keyed collections (tier id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "vip-tier-${hashCode()}"
}

/* ─── t260: daily check-in (GET/POST api/rewards/checkin) ────────────────── */

/**
 * data of GET api/rewards/checkin (rewards/checkin/route.ts:47-56
 * verbatim). todayReward = schedule[min(currentStreak, 6)] (the NEXT
 * claim's amount); schedule is the server's own 7-day ladder — the grid
 * renders it, never a client copy.
 */
@Immutable
@Serializable
data class CheckinStatusDto(
    val checkedInToday: Boolean = false,
    val currentStreak: Int? = null,
    val todayReward: Int? = null,
    val schedule: List<Int> = emptyList(),
    val history: List<CheckinRowDto> = emptyList(),
)

/**
 * One dailyCheckins row — BOTH the GET history rows and the POST 201 data
 * carry this shape (rewards/checkin/route.ts data: checkin). checkinDate
 * is the route's YYYY-MM-DD token; pointsAwarded the credited points.
 */
@Immutable
@Serializable
data class CheckinRowDto(
    val id: String? = null,
    val userId: String? = null,
    val checkinDate: String? = null,
    val streakCount: Int? = null,
    val pointsAwarded: Int? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "checkin-${hashCode()}"
}

/**
 * POST api/rewards/checkin response — TWO wire shapes land here: the 201
 * { success, message, data } and the 409 { error, alreadyCheckedIn: true }
 * (NO success field → default false; the screen branches on success and
 * surfaces error verbatim). 429 rate-limit answers { error } only.
 */
@Immutable
@Serializable
data class CheckinSubmitEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val data: CheckinRowDto? = null,
    val error: String? = null,
    val alreadyCheckedIn: Boolean = false,
)

/* ─── t260: lucky wheel (POST api/rewards/spin, GET spin-history) ────────── */

/**
 * prize of the POST api/rewards/spin success (rewards/spin/route.ts:12-20
 * PRIZE_SEGMENTS row verbatim): type is the route's token (fixed |
 * points | free-shipping), value the BDT/points magnitude, weight the
 * server's odds weight (displayed nowhere — kept for shape fidelity).
 */
@Immutable
@Serializable
data class SpinPrizeDto(
    val id: String? = null,
    val label: String? = null,
    val type: String? = null,
    val value: Double? = null,
    val weight: Int? = null,
)

/**
 * data of the POST api/rewards/spin success (rewards/spin/route.ts:132-140
 * verbatim): the WON prize (rendered verbatim — the native screen runs no
 * fake wheel animation ahead of it), its segmentIndex (highlights the
 * matching table row), and the REAL remaining/today counters.
 */
@Immutable
@Serializable
data class SpinResultDto(
    val prize: SpinPrizeDto? = null,
    val segmentIndex: Int? = null,
    val spinsRemaining: Int? = null,
    val spinsToday: Int? = null,
)

/**
 * One spinWinResults row as GET api/rewards/spin-history serves it
 * (schema.prisma spinWinResults): prizeValue Float → Double, spinDate the
 * YYYY-MM-DD token, couponId set only for voucher/free-shipping wins.
 */
@Immutable
@Serializable
data class SpinRowDto(
    val id: String? = null,
    val userId: String? = null,
    val prizeType: String? = null,
    val prizeLabel: String? = null,
    val prizeValue: Double? = null,
    val couponId: String? = null,
    val spinsToday: Int? = null,
    val spinDate: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "spin-${hashCode()}"
}

/**
 * Envelope of GET api/rewards/spin-history — the route puts the counters
 * OUTSIDE data (spin-history/route.ts:27-32: { success, data: [...rows],
 * spinsToday, spinsRemaining }), so the generic ApiEnvelope (single-object
 * data) cannot express it. 401 answers { error }.
 */
@Immutable
@Serializable
data class SpinHistoryEnvelope(
    val success: Boolean = false,
    val data: List<SpinRowDto> = emptyList(),
    val spinsToday: Int? = null,
    val spinsRemaining: Int? = null,
    val error: String? = null,
)

/* ─── loyalty status (GET api/rewards/loyalty) ───────────────────────────── */

/**
 * data of GET api/rewards/loyalty (rewards/loyalty/route.ts:54-66
 * verbatim). nextTier is the server's string token — 'max' at platinum;
 * cashValueBDT is floor(pointsBalance / 10) server-side (10 points = ৳1).
 */
@Immutable
@Serializable
data class LoyaltyStatusDto(
    val pointsBalance: Int? = null,
    val totalEarned: Int? = null,
    val totalRedeemed: Int? = null,
    val tier: String? = null,
    val nextTier: String? = null,
    val pointsNeededForNextTier: Int? = null,
    val tierProgressPercent: Int? = null,
    val cashValueBDT: Int? = null,
)

/* ─── referrals (api/referrals + api/referrals/claim) ────────────────────── */

/**
 * data of GET api/referrals (referrals/route.ts:53-64 verbatim). The code
 * is the find-or-create ZY-… token, shareUrl the register deep link the
 * web's Copy button writes to the clipboard, totalPointsEarned the 500 ×
 * rewardGiven-uses math the route performs.
 */
@Immutable
@Serializable
data class ReferralsDataDto(
    val code: String? = null,
    val shareUrl: String? = null,
    val rewardPerReferral: Int? = null,
    val totalInvited: Int? = null,
    val successfulReferrals: Int? = null,
    val totalPointsEarned: Int? = null,
    val referralHistory: List<ReferralUseRowDto> = emptyList(),
)

/**
 * One referralUses row as BOTH the GET's history rows and the POST
 * referrals/claim success data carry it (referrals/route.ts:19-28 include;
 * referrals/claim/route.ts:53-59 create): the use row plus the
 * referredUser projection { id, email, createdAt }.
 */
@Immutable
@Serializable
data class ReferralUseRowDto(
    val id: String? = null,
    val referralCodeId: String? = null,
    val referredUserId: String? = null,
    val rewardGiven: Boolean = false,
    val createdAt: String? = null,
    val referredUser: ReferredUserDto? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "referral-use-${hashCode()}"
}

/** The referredUser projection the referrals GET nests on every use row. */
@Immutable
@Serializable
data class ReferredUserDto(
    val id: String? = null,
    val email: String? = null,
    val createdAt: String? = null,
)

/**
 * Outgoing POST api/referrals/claim body — the route's exact field set
 * (referrals/claim/route.ts:24-25). referralCode has NO Kotlin default
 * (server-required, always serialized); the route uppercases it
 * server-side, the screen trims only.
 */
@Immutable
@Serializable
data class ReferralClaimBody(
    val referralCode: String,
)

/* ─── affiliate program (api/affiliate + api/affiliate/dashboard) ────────── */

/**
 * Envelope of GET/POST api/affiliate — the route answers THREE shapes
 * (affiliate/route.ts:24-38 and :61-84): not-enrolled 200
 * { enrolled: false, message } (NO success field — default false here and
 * the screen must branch on [enrolled], never on success), enrolled 200
 * { enrolled: true, data: profile }, and the POST success
 * { success, message, data: profile }. 401 answers { error }.
 */
@Immutable
@Serializable
data class AffiliateStatusEnvelope(
    val enrolled: Boolean = false,
    val success: Boolean = false,
    val message: String? = null,
    val data: AffiliateProfileDto? = null,
    val error: String? = null,
)

/**
 * The affiliateProfiles row as GET/POST api/affiliate project it
 * (affiliate/route.ts:31-38): the raw columns PLUS the server-composed
 * trackingLink (https://zylod.com/?aff=<code>) and the display-form
 * commissionPercent ('5%'). Money columns (totalEarnings / pendingPayout /
 * paidPayout) are Prisma Float → Double.
 */
@Immutable
@Serializable
data class AffiliateProfileDto(
    val id: String? = null,
    val userId: String? = null,
    val affiliateCode: String? = null,
    val commissionRate: Double? = null,
    val commissionPercent: String? = null,
    val trackingLink: String? = null,
    val totalClicks: Int? = null,
    val totalOrders: Int? = null,
    val totalEarnings: Double? = null,
    val pendingPayout: Double? = null,
    val paidPayout: Double? = null,
    val status: String? = null,
    val createdAt: String? = null,
)

/**
 * data of GET api/affiliate/dashboard (affiliate/dashboard/route.ts:28-48
 * verbatim): the identity pair (code + trackingUrl), the KPI stats block
 * and the ALWAYS-EMPTY recentConversions list (the route's t220 honesty
 * fix — no per-conversion ledger exists; the screen renders the honest
 * empty state the web renders).
 */
@Immutable
@Serializable
data class AffiliateDashboardDto(
    val affiliateCode: String? = null,
    val trackingUrl: String? = null,
    val stats: AffiliateStatsDto? = null,
    val recentConversions: List<AffiliateConversionDto> = emptyList(),
)

/**
 * stats of GET api/affiliate/dashboard (affiliate/dashboard/route.ts:33-41
 * verbatim): counters as Int, the RATES as the server's display strings
 * ('12.5%' conversion, '5%' commission) and the money columns as Double.
 */
@Immutable
@Serializable
data class AffiliateStatsDto(
    val totalClicks: Int? = null,
    val totalOrders: Int? = null,
    val conversionRate: String? = null,
    val commissionRate: String? = null,
    val totalEarningsBDT: Double? = null,
    val pendingPayoutBDT: Double? = null,
    val paidPayoutBDT: Double? = null,
)

/**
 * One recentConversions row — the shape the web affiliate-dashboard
 * component reads (orderNumber / orderAmount / commissionBDT / date /
 * status). The route serves [] today (its own t220 honesty fix); the DTO
 * exists so a future server population parses without a Kotlin change, and
 * the screen's loop over it simply renders nothing while it stays empty.
 */
@Immutable
@Serializable
data class AffiliateConversionDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val orderAmount: Double? = null,
    val commissionBDT: Double? = null,
    val date: String? = null,
    val status: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "affiliate-conversion-${hashCode()}"
}
