package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Financial-instrument surfaces (t256) — the REAL endpoints behind the nine
 * native finance pageIds (bank-accounts, add-bank-account, credit-debit-cards,
 * add-card, payment-method, payment-methods-detail, add-payment-method,
 * transaction-history, transaction-detail). Every route was verified against
 * its src/app/api handler:
 *
 *  - GET api/bank-accounts (bank-accounts/route.ts, Bearer-authenticated):
 *    200 { success, data: [BankAccountDto] } — the session user's
 *    paymentMethods rows with type 'bank', projected onto the web's
 *    bankName/accountHolderName naming (branchName/routingNumber ride in the
 *    cardNetwork/expiry columns). A guest gets 401 → the honest sign-in gate.
 *  - POST api/bank-accounts (rate limit 10/min): REQUIRED bankName +
 *    accountNumber + accountHolderName — a miss is 400 with the REAL text
 *    "Bank name, account number, and holder name are required". isDefault
 *    demotes the user's other bank rows server-side. Success 200
 *    { success, message, data: BankAccountDto }.
 *  - DELETE api/bank-accounts/{id} (bank-accounts/[id]/route.ts): 404
 *    'Bank account not found' for a foreign id; success
 *    { success, message }. PATCH on the same file only flips isDefault
 *    (declared here for contract completeness, the way AddressesApi
 *    declares its unused DELETE — no native screen calls it).
 *  - GET api/cards (cards/route.ts): 200 { success, data: [CardDto] } —
 *    the user's type-in(card,debit,credit) rows; cardType arrives already
 *    labeled ('Debit Card' | 'Credit Card'), last4 is the tokenized PAN.
 *  - POST api/cards (rate limit 10/min): REQUIRED cardNumber + holderName +
 *    expiry — the FULL PAN is sent and the SERVER tokenizes it (only last4
 *    is stored; 400 "Card number, holder name, and expiry are required").
 *    Success 200 { success, message: 'Card added securely', data: CardDto }.
 *  - DELETE api/cards/{id} (cards/[id]/route.ts): 404 'Card not found';
 *    success { success, message }. PATCH flips isDefault only (declared,
 *    unused by native screens).
 *  - GET api/payment-methods (payment-methods/route.ts): 200
 *    { success, data: [PaymentMethodRowDto] } — the RAW db rows (all
 *    families: bKash/Nagad/Upay/Rocket wallets, debit/credit cards AND the
 *    'bank' rows the bank-accounts rail owns; the native list renders the
 *    wallet+card families and leaves bank rows to the bank-accounts page).
 *  - POST api/payment-methods (rate limit 10/min), two families:
 *      wallet (type bKash|Nagad|Upay|Rocket) — REQUIRES a Bangladeshi
 *      mobile accountNumber (^(\+8801|8801|01)[3-9]\d{8}$) and a label;
 *      card (type debit|credit) — REQUIRES the tokenized last4 ONLY
 *      (^\d{4}$, "Card must be tokenized"), a holderName, and an optional
 *      MM/YY expiry. A miss is 400 with the route's REAL error text.
 *      Success 201 { success, data: PaymentMethodRowDto }.
 *  - DELETE api/payment-methods/{id} (payment-methods/[id]/route.ts — the
 *    file's ONLY method, 38 lines): 404 'Payment method not found';
 *    success { success } — NO message field, unlike the other two rails.
 *    There is NO GET-by-id anywhere under payment-methods/ — the
 *    payment-methods-detail page resolves its row from this list.
 *  - GET api/payment-methods/mobile-banking (mobile-banking/route.ts):
 *    200 { success, data: [MobileBankingDto] } — a DISTINCT projection of
 *    the wallet rows (provider/accountType naming, no label). Declared for
 *    contract completeness; the native payment-methods list reads the raw
 *    rows route instead (one fetch shows both families).
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every response field is
 * nullable-with-default so shape drift degrades into the screen mappers
 * instead of failing the whole list's parse; every nested object is itself
 * @Serializable. All money-free routes here (no Prisma Float columns) —
 * the wallet transaction DTOs this batch renders live on [WalletApi] and
 * are NOT redeclared here.
 */
interface FinanceApi {

    /* ─── bank accounts (api/bank-accounts) ──────────────────────────────── */

    /** GET api/bank-accounts — the session user's bank rows. */
    @GET("api/bank-accounts")
    suspend fun bankAccounts(): Response<ApiEnvelope<List<BankAccountDto>>>

    /**
     * POST api/bank-accounts — create; the three required fields have NO
     * Kotlin default so they are always serialized (ReturnSubmitBody
     * shippingMethod convention); 400 text surfaces verbatim.
     */
    @POST("api/bank-accounts")
    suspend fun createBankAccount(@Body body: BankAccountCreateBody): Response<FinanceMutationEnvelope<BankAccountDto>>

    /** DELETE api/bank-accounts/{id} — remove (only your own bank row). */
    @DELETE("api/bank-accounts/{id}")
    suspend fun deleteBankAccount(@Path("id") id: String): Response<FinanceDeleteEnvelope>

    /** PATCH api/bank-accounts/{id} — default-switch only (declared, unused). */
    @PATCH("api/bank-accounts/{id}")
    suspend fun setDefaultBankAccount(@Path("id") id: String, @Body body: FinanceSetDefaultBody): Response<FinanceDeleteEnvelope>

    /* ─── cards (api/cards) ──────────────────────────────────────────────── */

    /** GET api/cards — the session user's card rows (tokenized last4). */
    @GET("api/cards")
    suspend fun cards(): Response<ApiEnvelope<List<CardDto>>>

    /** POST api/cards — create; FULL cardNumber sent, server tokenizes. */
    @POST("api/cards")
    suspend fun createCard(@Body body: CardCreateBody): Response<FinanceMutationEnvelope<CardDto>>

    /** DELETE api/cards/{id} — remove (only your own card row). */
    @DELETE("api/cards/{id}")
    suspend fun deleteCard(@Path("id") id: String): Response<FinanceDeleteEnvelope>

    /** PATCH api/cards/{id} — default-switch only (declared, unused). */
    @PATCH("api/cards/{id}")
    suspend fun setDefaultCard(@Path("id") id: String, @Body body: FinanceSetDefaultBody): Response<FinanceDeleteEnvelope>

    /* ─── payment methods (api/payment-methods) ──────────────────────────── */

    /** GET api/payment-methods — the RAW db rows (every family). */
    @GET("api/payment-methods")
    suspend fun paymentMethods(): Response<ApiEnvelope<List<PaymentMethodRowDto>>>

    /**
     * POST api/payment-methods — create. [PaymentMethodCreateBody.type] and
     * [PaymentMethodCreateBody.accountNumber] have NO Kotlin default (the
     * server needs both in BOTH families: a wallet phone or the tokenized
     * last4); the per-family requireds (label / holderName) are validated
     * client-side AND by the server's real 400 text.
     */
    @POST("api/payment-methods")
    suspend fun createPaymentMethod(@Body body: PaymentMethodCreateBody): Response<FinanceMutationEnvelope<PaymentMethodRowDto>>

    /** DELETE api/payment-methods/{id} — the [id] file's ONLY method. */
    @DELETE("api/payment-methods/{id}")
    suspend fun deletePaymentMethod(@Path("id") id: String): Response<FinanceDeleteEnvelope>

    /**
     * GET api/payment-methods/mobile-banking — the wallet rows' distinct
     * provider/accountType projection (declared for contract completeness;
     * the native list reads the raw-rows route above).
     */
    @GET("api/payment-methods/mobile-banking")
    suspend fun mobileBanking(): Response<ApiEnvelope<List<MobileBankingDto>>>
}

/* ─── bank accounts ──────────────────────────────────────────────────────── */

/**
 * One bank-account row (bank-accounts/route.ts:22-32 projection verbatim).
 * accountNumber arrives UNMASKED on this route — the native screens render
 * it masked (•••• + last4) like every financial surface.
 */
@Immutable
@Serializable
data class BankAccountDto(
    val id: String? = null,
    val bankName: String? = null,
    val accountNumber: String? = null,
    val accountHolderName: String? = null,
    val branchName: String? = null,
    val routingNumber: String? = null,
    val isDefault: Boolean = false,
    val verified: Boolean? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "bank-account-${hashCode()}"
}

/**
 * Outgoing POST api/bank-accounts body — the route's exact field set
 * (bank-accounts/route.ts:54). bankName/accountNumber/accountHolderName
 * have NO default (server-required, always serialized); the optional pair
 * is omitted (explicitNulls) when blank like the web's || undefined.
 */
@Immutable
@Serializable
data class BankAccountCreateBody(
    val bankName: String,
    val accountNumber: String,
    val accountHolderName: String,
    val branchName: String? = null,
    val routingNumber: String? = null,
    val isDefault: Boolean? = null,
)

/* ─── cards ──────────────────────────────────────────────────────────────── */

/**
 * One card row (cards/route.ts:25-34 projection verbatim) — cardType is
 * the server's display label ('Debit Card' | 'Credit Card'), last4 is the
 * tokenized PAN tail, expiry 'MM/YY'.
 */
@Immutable
@Serializable
data class CardDto(
    val id: String? = null,
    val cardType: String? = null,
    val brand: String? = null,
    val last4: String? = null,
    val holderName: String? = null,
    val expiry: String? = null,
    val isDefault: Boolean = false,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "card-${hashCode()}"
}

/**
 * Outgoing POST api/cards body — the route's exact field set
 * (cards/route.ts:55). cardNumber/holderName/expiry have NO default
 * (server-required, always serialized); cardNumber is the FULL PAN — the
 * server tokenizes to last4 before storing.
 */
@Immutable
@Serializable
data class CardCreateBody(
    val cardNumber: String,
    val holderName: String,
    val expiry: String,
    val cardType: String? = null,
    val brand: String? = null,
    val isDefault: Boolean? = null,
)

/* ─── payment methods ────────────────────────────────────────────────────── */

/**
 * One RAW paymentMethods db row (GET api/payment-methods returns the rows
 * verbatim — prisma `model paymentMethods`): the wallet rows carry a phone
 * in accountNumber, the card rows the tokenized last4, and the bank rows
 * (created by the bank-accounts rail) carry the full account — every
 * family's column set is nullable-tolerant here.
 */
@Immutable
@Serializable
data class PaymentMethodRowDto(
    val id: String? = null,
    val userId: String? = null,
    val type: String? = null,
    val label: String? = null,
    val accountNumber: String? = null,
    val holderName: String? = null,
    val expiry: String? = null,
    val cardNetwork: String? = null,
    val isDefault: Boolean = false,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "payment-method-${hashCode()}"
}

/**
 * Outgoing POST api/payment-methods body — the route's exact field set
 * (payment-methods/route.ts:42). type + accountNumber have NO default
 * (required in both families); label/holderName/expiry/cardNetwork are the
 * per-family optionals the route validates on its side.
 */
@Immutable
@Serializable
data class PaymentMethodCreateBody(
    val type: String,
    val accountNumber: String,
    val label: String? = null,
    val holderName: String? = null,
    val expiry: String? = null,
    val cardNetwork: String? = null,
)

/**
 * One mobile-banking row (mobile-banking/route.ts:24-32 projection
 * verbatim) — the wallet families under their provider/accountType naming.
 */
@Immutable
@Serializable
data class MobileBankingDto(
    val id: String? = null,
    val provider: String? = null,
    val accountNumber: String? = null,
    val accountType: String? = null,
    val isDefault: Boolean = false,
    val verified: Boolean? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "mobile-banking-${hashCode()}"
}

/* ─── shared envelopes / bodies ──────────────────────────────────────────── */

/**
 * POST response envelope for the finance create rails — the handlers add a
 * top-level `message` next to the standard { success, data } pair
 * (bank-accounts/cards/mobile-banking POSTs; the payment-methods POST
 * sends data without a message — nullable here).
 */
@Immutable
@Serializable
data class FinanceMutationEnvelope<T>(
    val success: Boolean = false,
    val message: String? = null,
    val data: T? = null,
    val error: String? = null,
)

/**
 * DELETE response envelope — { success, message } on the bank/card rails,
 * { success } on the payment-methods rail (no message). PATCH reuses it
 * (the bank/card PATCHes answer the same shape).
 */
@Immutable
@Serializable
data class FinanceDeleteEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

/**
 * PATCH body for the bank/card default-switch routes — the handlers read
 * exactly one field (body.isDefault truthiness). No default → always
 * serialized (ReturnSubmitBody convention).
 */
@Immutable
@Serializable
data class FinanceSetDefaultBody(
    val isDefault: Boolean,
)
