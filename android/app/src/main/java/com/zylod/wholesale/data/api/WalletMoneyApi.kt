package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Money-movement surfaces (t258) — the REAL wallet write/read routes behind
 * the four native money pageIds (add-money, withdraw, withdraw-money,
 * refund-to-wallet). Every route was verified against its src/app/api
 * handler; this is a SEPARATE interface from [FinanceApi] (t256) and
 * [WalletApi] (the read-only wallet overview/balance/transactions rail —
 * REUSED, never redeclared here) so the t256 file keeps its route set;
 * the accessor lives on ApiClient as walletMoneyApi().
 *
 *  - POST api/wallet/topup (topup/route.ts, rate limit 10/min
 *    'wallet-topup-claim') — the MANUAL top-up CLAIM. THE WALLET DOCTRINE
 *    (Task 118): a manual claim NEVER moves money. It creates ONE
 *    walletTopups row with status 'pending' (+ auditLogs
 *    'wallet_topup_claimed') and nothing else — no wallets mutation, no
 *    walletTransactions row. Only POST api/admin/topups/[id]/verify can
 *    flip pending → credited. Zod STRICT: amount coerce 10..100000,
 *    method bKash|Nagad|Rocket|Upay|bank_transfer, transactionReference
 *    ^[A-Za-z0-9\-_]{6,64}$ REQUIRED, senderNumber? ^[0-9+\-]{6,20}$,
 *    note? ≤300. 201 { success, data: { topupId, status: 'pending',
 *    reference, amount, message: 'Claim received. Your wallet balance does
 *    NOT change until a Zylod admin verifies the payment — the same rule as
 *    order payments.' } } — the message rides INSIDE data (no top-level
 *    message like the other mutation rails). Errors: 401 first, 400 the
 *    verbatim zod issue ("amount: Amount must be at least ৳10" style),
 *    409 duplicate reference across the WHOLE table ('This transaction
 *    reference was already submitted by you' | 'This transaction reference
 *    is already used by another claim' — the reference column is @@unique),
 *    429 the rate-limit body.
 *  - GET api/wallet/topup — the caller's OWN claims, newest first, take 50:
 *    { success, data: [ { id, provider, reference, amount, currency,
 *    status, gatewayTrxId, claimDetails, creditedAt, createdAt } ] }. The
 *    claimDetails column is a Prisma Json value ({method, submittedAt,
 *    senderNumber?, note?}) — parsed as an OPAQUE [JsonElement] so any
 *    shape drift degrades instead of failing the row. Statuses the admin
 *    rail really writes: pending | credited | rejected.
 *  - POST api/wallet/topup/initiate (topup/initiate/route.ts, rate limit
 *    10/min) — the GATEWAY leg. Starts a REAL gateway session; the wallet
 *    is credited ONLY by the verified callback/IPN, never here. Routing:
 *    bKash → direct bKash Tokenized Checkout; Nagad/Upay/Rocket/card →
 *    SSLCommerz EasyCheckout. SUCCESS SHAPE (mirrored exactly):
 *    { success: true, data: { redirectUrl, reference } } — reference is
 *    the server's WBD-TU-… token. Errors: 401 first; 400 'Amount must be
 *    between ৳10 and ৳100,000' or 'Unsupported method. Use bKash, Nagad,
 *    Upay, Rocket, or card.'; 503 'bKash is not configured' |
 *    'SSLCommerz is not configured' (honest gateway-missing verdict);
 *    502 the gateway's own error message.
 *  - GET api/wallet/withdraw (withdraw/route.ts, rate limit 60/min
 *    'wallet-withdraw-list') — the Task 107 PAYOUT RAIL view,
 *    SUPPLIER-ONLY: resolveSupplierProfile misses → 403 with the
 *    supplier-scope.ts verbatim body SUPPLIER_PROFILE_REQUIRED = { error:
 *    'Supplier profile required. Only registered suppliers can access
 *    seller data.' }. 200 { success, data: { balance, onHold, available,
 *    payouts: [ { id, amount, method, status, destination, reference,
 *    processedAt, createdAt } ] } } — payouts take 100, ordered
 *    status-asc (pending/processing first) then createdAt-desc; onHold is
 *    the supplier's own pending+processing sum, available = balance −
 *    onHold (the honest hold math, not a wallet debit).
 *  - POST api/wallet/withdraw (rate limit 10/min) — creates a PENDING
 *    sellerPayouts row; the wallet is UNTOUCHED until an admin completes
 *    it. Body: withdrawSchema (src/lib/payouts.ts) strict — amount
 *    positive AND ≥ 50 ('Minimum withdrawal is ৳50'), method
 *    bank|bKash|Nagad|Upay|Rocket, accountNumber 6..40, holderName
 *    2..80, bankName? ≤80. 201 { success, message:
 *    'Withdrawal request for ৳… submitted — an admin verifies it before
 *    any money leaves.', data: { payoutId, amount, status: 'pending',
 *    onHoldAfter, availableAfter } }. 400 the route's verbatim
 *    exceeds-available text (it spells out the real balance/hold
 *    numbers) or the zod issue; 404 'No wallet found for this account';
 *    403 the SUPPLIER_PROFILE_REQUIRED body.
 *  - GET api/wallet/refund (refund/route.ts) — the Task 140 honest refund
 *    ledger: the refunds the PLATFORM actually processed for this buyer
 *    (written by the admin rail POST api/admin/returns/[id]/refund after
 *    an approved return). The old self-service POST on this route was
 *    RETIRED — refunds are never self-claimed. 200 { success, data: [ {
 *    id, orderId, returnRequestId, amount, method, reference, status,
 *    note, createdAt } ], message: 'Refunds are processed by the platform
 *    once a return is approved — the money arrives through your chosen
 *    channel (bank transfer, mobile banking, or cash) and is documented
 *    here with its real transaction reference.' } — money fields are
 *    Prisma Float columns → Double; 401-first.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every response field is
 * nullable-with-default so shape drift degrades into the screen mappers;
 * bodies give their server-required fields NO Kotlin default (the
 * ReturnSubmitBody convention — always serialized).
 */
interface WalletMoneyApi {

    /* ─── manual top-up claims (api/wallet/topup) ────────────────────────── */

    /**
     * POST api/wallet/topup — the manual funding CLAIM (pending; NEVER a
     * credit). Success 201 with the doctrine message inside data.
     */
    @POST("api/wallet/topup")
    suspend fun submitTopupClaim(@Body body: TopupClaimBody): Response<FinanceMutationEnvelope<TopupClaimResultDto>>

    /** GET api/wallet/topup — the caller's own claims, newest first (take 50). */
    @GET("api/wallet/topup")
    suspend fun topupClaims(): Response<ApiEnvelope<List<TopupClaimDto>>>

    /* ─── gateway top-up sessions (api/wallet/topup/initiate) ────────────── */

    /**
     * POST api/wallet/topup/initiate — start the bKash Tokenized Checkout /
     * SSLCommerz EasyCheckout session. Success 200 { success, data: {
     * redirectUrl, reference } }; 503 when the gateway is not configured.
     */
    @POST("api/wallet/topup/initiate")
    suspend fun initiateTopup(@Body body: TopupInitiateBody): Response<TopupInitiateEnvelope>

    /* ─── payout rail (api/wallet/withdraw) — SUPPLIER-SCOPED ────────────── */

    /**
     * GET api/wallet/withdraw — balance / onHold / available + the payout
     * queue (take 100). A buyer session gets 403 (the gate lives in the
     * WithdrawViewModel — no zero-shaped balance card from a role denial).
     */
    @GET("api/wallet/withdraw")
    suspend fun payoutLedger(): Response<ApiEnvelope<PayoutLedgerDto>>

    /**
     * POST api/wallet/withdraw — the withdrawal REQUEST (a pending
     * sellerPayouts row + the hold; no wallet debit). 201 message
     * surfaces verbatim with payoutId + availableAfter.
     */
    @POST("api/wallet/withdraw")
    suspend fun requestWithdrawal(@Body body: WithdrawBody): Response<FinanceMutationEnvelope<PayoutRequestResultDto>>

    /* ─── processed refunds (api/wallet/refund) ──────────────────────────── */

    /**
     * GET api/wallet/refund — the buyer's REAL refund ledger (admin
     * rail-written rows with their real UTR / TxnID references), take 50,
     * newest first. The envelope's top-level `message` is the route's own
     * doctrine line (nullable — read defensively like every other field).
     */
    @GET("api/wallet/refund")
    suspend fun refunds(): Response<FinanceMutationEnvelope<List<RefundRowDto>>>
}

/* ─── top-up claims ──────────────────────────────────────────────────────── */

/**
 * Outgoing POST api/wallet/topup body — the route's exact field set
 * (topup/route.ts claimSchema). amount/method/transactionReference have NO
 * Kotlin default (server-required, always serialized); senderNumber/note
 * are omitted (explicitNulls) when blank like the web's || undefined.
 */
@Immutable
@Serializable
data class TopupClaimBody(
    val amount: Double,
    val method: String,
    val transactionReference: String,
    val senderNumber: String? = null,
    val note: String? = null,
)

/**
 * data of the POST api/wallet/topup success (topup/route.ts:184-196
 * verbatim). status is ALWAYS 'pending' — the money moves only at admin
 * verification — and message is the route's verbatim doctrine line,
 * carried INSIDE data (the screen must never invent a "balance added"
 * copy, so it renders exactly this).
 */
@Immutable
@Serializable
data class TopupClaimResultDto(
    val topupId: String? = null,
    val status: String? = null,
    val reference: String? = null,
    val amount: Double? = null,
    val message: String? = null,
)

/**
 * One GET api/wallet/topup row (topup/route.ts:215-227 projection
 * verbatim). claimDetails is the Prisma Json column — kept as an OPAQUE
 * [JsonElement] (nullable) so any admin-rail shape drift degrades instead
 * of failing the whole ledger's parse; the native screen renders the
 * row's top-level columns and never pretends to interpret the blob.
 */
@Immutable
@Serializable
data class TopupClaimDto(
    val id: String? = null,
    val provider: String? = null,
    val reference: String? = null,
    val amount: Double? = null,
    val currency: String? = null,
    val status: String? = null,
    val gatewayTrxId: String? = null,
    val claimDetails: JsonElement? = null,
    val creditedAt: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "topup-claim-${hashCode()}"
}

/* ─── gateway top-up initiate ────────────────────────────────────────────── */

/**
 * Outgoing POST api/wallet/topup/initiate body — the route's exact field
 * set (topup/initiate/route.ts:31-33). Both fields have NO Kotlin default
 * (server-required, always serialized).
 */
@Immutable
@Serializable
data class TopupInitiateBody(
    val amount: Double,
    val method: String,
)

/**
 * data of the POST api/wallet/topup/initiate success — the route's EXACT
 * shape mirrored (topup/initiate/route.ts:77 and :103 both answer
 * { success: true, data: { redirectUrl, reference } }): redirectUrl is
 * the gateway checkout page (bKash URL / SSLCommerz gatewayPageURL) and
 * reference the WBD-TU-… session token.
 */
@Immutable
@Serializable
data class TopupInitiateDataDto(
    val redirectUrl: String? = null,
    val reference: String? = null,
)

/**
 * Envelope of POST api/wallet/topup/initiate — success answers
 * { success, data: { redirectUrl, reference } }; EVERY error on this
 * route answers { error } (400 amount bounds / unsupported method, 503
 * gateway-not-configured, 502 the gateway's own message) with NO data,
 * so error is nullable-but-load-bearing here.
 */
@Immutable
@Serializable
data class TopupInitiateEnvelope(
    val success: Boolean = false,
    val data: TopupInitiateDataDto? = null,
    val error: String? = null,
)

/* ─── payout rail (supplier-scoped) ──────────────────────────────────────── */

/**
 * One sellerPayouts row as GET api/wallet/withdraw projects it
 * (withdraw/route.ts:135-144 verbatim). method is the NORMALIZED token
 * (bank→bank_transfer, bKash→bkash, …), destination is the server's
 * composed string, reference is the admin's transfer reference (null
 * until the payout completes), processedAt null while it waits.
 */
@Immutable
@Serializable
data class PayoutRowDto(
    val id: String? = null,
    val amount: Double? = null,
    val method: String? = null,
    val status: String? = null,
    val destination: String? = null,
    val reference: String? = null,
    val processedAt: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "payout-${hashCode()}"
}

/**
 * data of GET api/wallet/withdraw (withdraw/route.ts:129-146 verbatim):
 * the honest three-way split — balance, the supplier's own pending/
 * processing hold sum, and available = balance − onHold — plus the payout
 * queue (take 100, pending-first server ordering).
 */
@Immutable
@Serializable
data class PayoutLedgerDto(
    val balance: Double? = null,
    val onHold: Double? = null,
    val available: Double? = null,
    val payouts: List<PayoutRowDto> = emptyList(),
)

/**
 * Outgoing POST api/wallet/withdraw body — the withdrawSchema field set
 * (src/lib/payouts.ts). amount/method/accountNumber/holderName have NO
 * Kotlin default (server-required, always serialized); bankName is
 * omitted when null like the web's `bankName: method === 'bank' ?
 * bankName : undefined`.
 */
@Immutable
@Serializable
data class WithdrawBody(
    val amount: Double,
    val method: String,
    val accountNumber: String,
    val holderName: String,
    val bankName: String? = null,
)

/**
 * data of the POST api/wallet/withdraw success (withdraw/route.ts:87-100
 * verbatim): the created payout's id, its amount, status 'pending', and
 * the HONEST post-hold math the server computed (onHoldAfter /
 * availableAfter) — the screen shows these inline instead of pretending
 * the balance moved.
 */
@Immutable
@Serializable
data class PayoutRequestResultDto(
    val payoutId: String? = null,
    val amount: Double? = null,
    val status: String? = null,
    val onHoldAfter: Double? = null,
    val availableAfter: Double? = null,
)

/* ─── processed refunds ──────────────────────────────────────────────────── */

/**
 * One GET api/wallet/refund row (refund/route.ts:52-62 verbatim) — a
 * refunds row written by the ADMIN rail after an approved return. method
 * is the wire token (bank_transfer | mobile_banking | cash), reference
 * the real-world UTR / TxnID, note the admin's optional line.
 */
@Immutable
@Serializable
data class RefundRowDto(
    val id: String? = null,
    val orderId: String? = null,
    val returnRequestId: String? = null,
    val amount: Double? = null,
    val method: String? = null,
    val reference: String? = null,
    val status: String? = null,
    val note: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "refund-${hashCode()}"
}
