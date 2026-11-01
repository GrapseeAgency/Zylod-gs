package com.zylod.wholesale.ui.finance

import com.zylod.wholesale.data.api.PayoutLedgerDto
import com.zylod.wholesale.data.api.PayoutRowDto
import com.zylod.wholesale.data.api.RefundRowDto
import com.zylod.wholesale.data.api.TopupClaimDto

/**
 * Shared models for the t258 money-movement surfaces. Same doctrine as
 * [FinanceModels] (t256) and [CreditModels] (t257): NO Compose imports —
 * this file owns offline-cache keys + envelopes and pure-Kotlin token
 * lists/helpers only; the screens own colors/fonts. [FinanceCacheStore]
 * (the generic read/write over SharedPreferences "zylod_config") is
 * REUSED from FinanceModels.kt — never redeclared.
 */
object MoneyCacheKeys {
    /** The ONE prefs file the whole native shell uses (FinanceCacheKeys.PREFS twin). */
    const val PREFS = "zylod_config"

    /** Last successful GET api/wallet/topup claim ledger. */
    const val TOPUP_CLAIMS = "native_topup_claims_cache"

    /** Last successful GET api/wallet/withdraw payout rail payload. */
    const val PAYOUT_LEDGER = "native_payout_ledger_cache"

    /** Last successful GET api/wallet/refund processed-refund ledger. */
    const val REFUND_LEDGER = "native_refund_ledger_cache"
}

/* ─── offline cache envelopes (the raw wire DTOs — offline render matches live) ─── */

/** Saved top-up claim snapshot (GET api/wallet/topup). */
@kotlinx.serialization.Serializable
data class CachedTopupClaims(val rows: List<TopupClaimDto> = emptyList())

/** Saved payout-rail snapshot (GET api/wallet/withdraw). */
@kotlinx.serialization.Serializable
data class CachedPayoutLedger(val ledger: PayoutLedgerDto? = null)

/** Saved processed-refund snapshot (GET api/wallet/refund). */
@kotlinx.serialization.Serializable
data class CachedRefundLedger(val rows: List<RefundRowDto> = emptyList())

/* ─── the routes' REAL wire enums (chip lists use the exact tokens) ──────── */

/**
 * POST api/wallet/topup method chips — EXACTLY the five the claimSchema
 * enum whitelists (topup/route.ts:61); METHOD_TO_PROVIDER maps them to
 * the walletTopups.provider tokens server-side. Order mirrors the web
 * form's first four + the API's Upay.
 */
val TOPUP_CLAIM_METHODS = listOf(
    "bKash" to "Send Money / Payment",
    "Nagad" to "Send Money",
    "Rocket" to "DBBL mobile banking",
    "Upay" to "Upay mobile banking",
    "bank_transfer" to "BEFTN / RTGS / cash deposit",
)

/**
 * POST api/wallet/topup/initiate method chips — EXACTLY the five the
 * gateway route accepts (bKash direct Tokenized Checkout; Nagad/Upay/
 * Rocket/card via SSLCommerz EasyCheckout; topup/initiate/route.ts:59-81).
 */
val TOPUP_GATEWAY_METHODS = listOf("bKash", "Nagad", "Upay", "Rocket", "card")

/**
 * POST api/wallet/withdraw method chips — EXACTLY the five the
 * withdrawSchema METHODS tuple whitelists (src/lib/payouts.ts:13), with
 * the web form's labels (withdraw-money-page.tsx:204-207) plus the
 * schema's Upay.
 */
val PAYOUT_METHODS = listOf(
    "bank" to "Commercial Bank",
    "bKash" to "bKash Merchant",
    "Nagad" to "Nagad Wallet",
    "Upay" to "Upay Wallet",
    "Rocket" to "DBBL Rocket",
)

/**
 * The web bank-name <select> options (withdraw-money-page.tsx:238-242)
 * — sent verbatim as bankName when the payout method is bank.
 */
val PAYOUT_BANK_NAMES = listOf(
    "City Bank PLC",
    "BRAC Bank PLC",
    "Dutch-Bangla Bank (DBBL)",
    "Islami Bank Bangladesh PLC",
    "Eastern Bank PLC (EBL)",
)

/**
 * The web payout-row status labels (withdraw-money-page.tsx:33-38):
 * pending → "Pending verification", processing → "Processing",
 * completed → "Settled", failed → "Rejected" — anything else falls back
 * to the raw token (never a made-up label).
 */
fun payoutStatusLabel(status: String?): String = when (status?.trim()?.lowercase()) {
    "pending" -> "Pending verification"
    "processing" -> "Processing"
    "completed" -> "Settled"
    "failed" -> "Rejected"
    else -> status?.trim()?.takeIf(String::isNotEmpty) ?: "UNKNOWN"
}

/** True for the two statuses the hold math counts on (route + payouts.ts). */
fun payoutIsHold(status: String?): Boolean =
    status?.trim()?.lowercase() == "pending" || status?.trim()?.lowercase() == "processing"

/**
 * The refund row's method label map (refund-to-wallet-page.tsx:42-46
 * verbatim): bank_transfer → Bank transfer, mobile_banking → Mobile
 * banking, cash → Cash — an unknown token renders itself.
 */
fun refundMethodLabel(method: String?): String = when (method?.trim()?.lowercase()) {
    "bank_transfer" -> "Bank transfer"
    "mobile_banking" -> "Mobile banking"
    "cash" -> "Cash"
    else -> method?.trim()?.takeIf(String::isNotEmpty) ?: "—"
}

/**
 * The claim reference guard — the topup route's EXACT regex
 * (^[A-Za-z0-9\-_]{6,64}$) mirrored client-side so the buyer gets the
 * hint before the wire does; the server's real 400 text still surfaces
 * verbatim when it fires.
 */
val TOPUP_REFERENCE_REGEX = Regex("^[A-Za-z0-9\\-_]{6,64}$")

/** The claim route's amount bounds (Zod min 10 / max 100000). */
const val TOPUP_AMOUNT_MIN = 10.0
const val TOPUP_AMOUNT_MAX = 100_000.0

/** The payout route's minimum (withdrawSchema superRefine). */
const val WITHDRAW_AMOUNT_MIN = 50.0

/**
 * A top-up claim row's chip tint family: pending → amber, credited →
 * emerald, rejected/failed → rose, anything else → neutral. Mapped onto
 * theme roles by the screen (the web's claimChip map semantics).
 */
enum class TopupClaimTint { AMBER, EMERALD, ROSE, NEUTRAL }

fun topupClaimTint(status: String?): TopupClaimTint = when (status?.trim()?.lowercase()) {
    "pending" -> TopupClaimTint.AMBER
    "credited" -> TopupClaimTint.EMERALD
    "rejected", "failed" -> TopupClaimTint.ROSE
    else -> TopupClaimTint.NEUTRAL
}

/**
 * A payout row's chip tint family: pending/processing → amber,
 * completed → emerald, failed → rose, anything else → neutral (the
 * web's STATUS_STYLES semantics).
 */
enum class PayoutTint { AMBER, EMERALD, ROSE, NEUTRAL }

fun payoutTint(status: String?): PayoutTint = when (status?.trim()?.lowercase()) {
    "pending", "processing" -> PayoutTint.AMBER
    "completed" -> PayoutTint.EMERALD
    "failed" -> PayoutTint.ROSE
    else -> PayoutTint.NEUTRAL
}

/** Stable-key helper for the payout rows' LazyColumn keys. */
fun List<PayoutRowDto>.payoutStableKeys(): List<String> = map { it.stableKey }
