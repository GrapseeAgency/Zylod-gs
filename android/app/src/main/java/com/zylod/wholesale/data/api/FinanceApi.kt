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
import retrofit2.http.Query

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

    /* ─── trade credit (api/credits) ───────────────────────────────────── */

    /**
     * GET api/credits/limit — find-or-create the session buyer's ACTIVE
     * creditLines row (credits/limit/route.ts GET): a buyer with no row yet
     * gets one created server-side (৳250,000 limit), so a 200 ALWAYS carries
     * a real facility — the native gauge never renders a fabricated zero.
     * 401 'Authentication required' for guests.
     */
    @GET("api/credits/limit")
    suspend fun creditLimit(): Response<ApiEnvelope<CreditLineDto>>

    /**
     * POST api/credits/limit — the underwriting request (rate limit 10/min).
     * REQUIRED requestedLimit (the route parses it with parseFloat and
     * answers 400 'Invalid credit limit amount' on <=0/NaN) and reason.
     * Success 200 { success, message, data: CreditLimitRequestResultDto } —
     * the message text surfaces verbatim, the referenceId rides inline.
     */
    @POST("api/credits/limit")
    suspend fun requestCreditLimitIncrease(@Body body: CreditLimitRequestBody): Response<FinanceMutationEnvelope<CreditLimitRequestResultDto>>

    /**
     * GET api/credits/score — the computed commercial rating (score toward
     * maxScore 850, tier, risk rating + the 4 factor rows). 401 for guests.
     */
    @GET("api/credits/score")
    suspend fun creditScore(): Response<ApiEnvelope<CreditScoreDto>>

    /* ─── payments (api/payments) ──────────────────────────────────────── */

    /**
     * GET api/payments/history?status= — the payments rows on the caller's
     * orders (buyer OR supplier-side), take 50. `status` is an EXACT match
     * on the payments.status column and is SKIPPED when null/"all" — the
     * real wire values the web chips send are success | pending | failed.
     */
    @GET("api/payments/history")
    suspend fun paymentsHistory(@Query("status") status: String? = null): Response<ApiEnvelope<List<PaymentHistoryRowDto>>>

    /**
     * GET api/payments/pending — the MERGED clearance pipeline: pending
     * payments (type 'Order Payment Clearance', status 'pending_settlement')
     * + held escrow accounts (type 'Trade Assurance Escrow', status
     * 'held_in_escrow'), each with the server's own description line.
     */
    @GET("api/payments/pending")
    suspend fun paymentsPending(): Response<ApiEnvelope<List<PendingPaymentRowDto>>>

    /**
     * GET api/payments/failed — the failed gateway authorizations with the
     * route's HONEST reason (the stored gatewayResponse, or its verbatim
     * fallback 'Payment authorization failed at bank gateway. Insufficient
     * merchant limit or timeout.'). NO retry endpoint exists anywhere under
     * api/payments — the native screen never pretends to retry.
     */
    @GET("api/payments/failed")
    suspend fun paymentsFailed(): Response<ApiEnvelope<List<FailedPaymentRowDto>>>

    /* ─── invoices (api/invoices + api/orders/{id}/invoice) ───────────── */

    /**
     * GET api/invoices?status= — the commercial-invoice projection of the
     * caller's orders (admin: full book), take 40, with the derived
     * INV-/MUSHAK-6.3- numbers. `status` filters paymentStatus EXACTLY and
     * is skipped when null/"all" (wire values: paid | pending).
     */
    @GET("api/invoices")
    suspend fun invoices(@Query("status") status: String? = null): Response<ApiEnvelope<List<InvoiceRowDto>>>

    /**
     * GET api/invoices/{id} — the Mushak 6.3 tax document for an order id
     * (or orderNumber). Scoping is buyer-of-record, an admin, or a supplier
     * whose supplierProfiles.id owns a subOrder — EVERYONE else gets 404
     * 'Invoice not found' (the route deliberately answers 404, never 403,
     * so foreign ids are indistinguishable from missing ones).
     */
    @GET("api/invoices/{id}")
    suspend fun mushakInvoice(@Path("id") id: String): Response<ApiEnvelope<MushakInvoiceDto>>

    /**
     * GET api/orders/{id}/invoice — the purpose-built TAX INVOICE document
     * the web order-invoice page renders (server-computed VAT reference,
     * discount derivation, platform billing identity, buyer of record).
     * 404 'Order not found' / 403 'Not authorized to view this invoice'
     * (here the foreign-caller shape IS 403) / 401 for guests.
     */
    @GET("api/orders/{id}/invoice")
    suspend fun orderInvoice(@Path("id") id: String): Response<ApiEnvelope<OrderInvoiceDto>>

    /* ─── seller finance (api/finance) — SUPPLIER-SCOPED ───────────────── */

    /**
     * GET api/finance/earnings — requireUserType(['supplier']): a buyer
     * WITH a session gets 403 (error 'Supplier account required' or the
     * route's own auth.error text), a guest 401. The DTO mirrors the SUCCESS
     * shape only — the 403 gate lives in the SellerFinanceViewModel, which
     * must never render a zero-shaped revenue card from a role denial.
     */
    @GET("api/finance/earnings")
    suspend fun financeEarnings(): Response<ApiEnvelope<SellerEarningsDto>>

    /**
     * GET api/finance/commissions — the per-subOrder commission ledger with
     * the caller's REAL affiliate rate. NOTE: unlike earnings this route
     * authenticates WITHOUT a role gate — a buyer session parses as an
     * empty book (supplierId resolves to 'none'), so the screen renders it
     * only when the earnings call has already passed the supplier gate.
     */
    @GET("api/finance/commissions")
    suspend fun financeCommissions(): Response<ApiEnvelope<CommissionBookDto>>

    /* ─── public legal documents (api/legal) ───────────────────────────── */

    /**
     * GET api/legal/faq?docType= — the public legalFaqs rows the web
     * payment-terms / payment-faq pages render (docType=payment_terms for
     * both). Public: no Bearer required (the shared client may send one;
     * the route ignores it).
     */
    @GET("api/legal/faq")
    suspend fun legalFaqs(@Query("docType") docType: String? = null): Response<LegalFaqEnvelope>

    /**
     * GET api/legal/{docType} — a full legal document (payment_terms) with
     * its related FAQs; 404 'Legal document not found' when inactive/absent.
     */
    @GET("api/legal/{docType}")
    suspend fun legalDocument(@Path("docType") docType: String): Response<LegalDocumentEnvelope>
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

/* ─── trade credit (api/credits) ─────────────────────────────────────────── */

/**
 * data of GET api/credits/limit (credits/limit/route.ts:32-44 projection
 * verbatim). Money fields are Prisma Float columns → Double. The route is
 * find-or-create, so a 200 always carries a live facility row.
 */
@Immutable
@Serializable
data class CreditLineDto(
    val id: String? = null,
    val creditLimit: Double? = null,
    val usedCredit: Double? = null,
    val availableCredit: Double? = null,
    val currency: String? = null,
    val interestFreeGracePeriod: String? = null,
    val nextSettlementDate: String? = null,
    val status: String? = null,
) {
    /** Stable identity for the gauge's keyed content. */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "credit-line-${hashCode()}"
}

/**
 * Outgoing POST api/credits/limit body — the route's exact field set
 * (credits/limit/route.ts:64). requestedLimit + reason have NO Kotlin
 * default (always serialized, ReturnSubmitBody convention); the server
 * parseFloat()es the limit and 400s on <=0/NaN. bankSolvencyDocUrl is the
 * route's optional third field — omitted (explicitNulls) when blank.
 */
@Immutable
@Serializable
data class CreditLimitRequestBody(
    val requestedLimit: Double,
    val reason: String,
    val bankSolvencyDocUrl: String? = null,
)

/**
 * data of the POST api/credits/limit success — status is always
 * 'under_review' and referenceId is the CRE-REQ-… token the screen shows
 * inline (no dialog, no fabricated confirmation).
 */
@Immutable
@Serializable
data class CreditLimitRequestResultDto(
    val requestedLimit: Double? = null,
    val status: String? = null,
    val referenceId: String? = null,
)

/** One credit-rating factor row (credits/score/route.ts factors[] shape). */
@Immutable
@Serializable
data class CreditFactorDto(
    val name: String? = null,
    val impact: String? = null,
    val description: String? = null,
)

/**
 * data of GET api/credits/score (credits/score/route.ts:26-42 verbatim):
 * score toward maxScore (850), the tier title, risk rating, the three
 * percentage/aggregate lines and the 4 factor rows.
 */
@Immutable
@Serializable
data class CreditScoreDto(
    val score: Int? = null,
    val maxScore: Int = 850,
    val tier: String? = null,
    val riskRating: String? = null,
    val repaymentTimeliness: String? = null,
    val tradeHistoryLength: String? = null,
    val creditUtilization: String? = null,
    val factors: List<CreditFactorDto> = emptyList(),
)

/* ─── payments (api/payments) ────────────────────────────────────────────── */

/**
 * One GET api/payments/history row (payments/history/route.ts:45-56
 * projection verbatim). orderTotal/orderStatus ride along from the related
 * order; paidAt is null while the payment is un-settled.
 */
@Immutable
@Serializable
data class PaymentHistoryRowDto(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val amount: Double? = null,
    val method: String? = null,
    val status: String? = null,
    val transactionId: String? = null,
    val paidAt: String? = null,
    val orderTotal: Double? = null,
    val orderStatus: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "payment-${hashCode()}"
}

/**
 * One GET api/payments/pending merged row (payments/pending/route.ts:44-67
 * verbatim): the two families are 'Order Payment Clearance' (status
 * 'pending_settlement') and 'Trade Assurance Escrow' (status
 * 'held_in_escrow', method always 'Escrow Vault'), description is the
 * server's own copy line.
 */
@Immutable
@Serializable
data class PendingPaymentRowDto(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val amount: Double? = null,
    val type: String? = null,
    val method: String? = null,
    val status: String? = null,
    val date: String? = null,
    val description: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "pending-${hashCode()}"
}

/**
 * One GET api/payments/failed row (payments/failed/route.ts:31-39 verbatim).
 * `reason` is the stored gatewayResponse or the route's honest fallback
 * copy — surfaced verbatim, never paraphrased.
 */
@Immutable
@Serializable
data class FailedPaymentRowDto(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val amount: Double? = null,
    val method: String? = null,
    val reason: String? = null,
    val date: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "failed-${hashCode()}"
}

/* ─── invoices (api/invoices + api/orders/{id}/invoice) ─────────────────── */

/**
 * One GET api/invoices row (invoices/route.ts:64-78 projection verbatim):
 * the INV- / MUSHAK-6.3- numbers are server-derived from the order, the
 * 5% VAT is server-computed, paymentStatus is the order's real column.
 */
@Immutable
@Serializable
data class InvoiceRowDto(
    val id: String? = null,
    val invoiceNumber: String? = null,
    val mushakNumber: String? = null,
    val orderNumber: String? = null,
    val date: String? = null,
    val dueDate: String? = null,
    val subtotal: Double? = null,
    val vatAmount: Double? = null,
    val shipping: Double? = null,
    val grandTotal: Double? = null,
    val paymentStatus: String? = null,
    val buyerName: String? = null,
    val itemsCount: Int = 0,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "invoice-${hashCode()}"
}

/** buyer block of the Mushak 6.3 document (invoices/[id]/route.ts:76-82). */
@Immutable
@Serializable
data class MushakBuyerBlockDto(
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val tin: String? = null,
)

/** seller block of the Mushak 6.3 document (invoices/[id]/route.ts:83-88). */
@Immutable
@Serializable
data class MushakSellerBlockDto(
    val name: String? = null,
    val tin: String? = null,
    val bin: String? = null,
    val address: String? = null,
)

/** One item line of the Mushak 6.3 document (invoices/[id]/route.ts:89-95). */
@Immutable
@Serializable
data class MushakItemLineDto(
    val name: String? = null,
    val quantity: Double? = null,
    val unitPrice: Double? = null,
    val totalPrice: Double? = null,
    val unit: String? = null,
)

/**
 * data of GET api/invoices/{id} — the Mushak 6.3 commercial tax document
 * (invoices/[id]/route.ts:70-103 verbatim). vatRate arrives as the string
 * '5.0%'; paymentMethod falls back to the server's 'Trade Escrow'.
 */
@Immutable
@Serializable
data class MushakInvoiceDto(
    val id: String? = null,
    val invoiceNumber: String? = null,
    val mushakNumber: String? = null,
    val orderNumber: String? = null,
    val date: String? = null,
    val buyer: MushakBuyerBlockDto? = null,
    val seller: MushakSellerBlockDto? = null,
    val items: List<MushakItemLineDto> = emptyList(),
    val subtotal: Double? = null,
    val vatRate: String? = null,
    val vatAmount: Double? = null,
    val shippingCost: Double? = null,
    val grandTotal: Double? = null,
    val paymentStatus: String? = null,
    val paymentMethod: String? = null,
)

/** company (platform billing identity) block of GET api/orders/{id}/invoice. */
@Immutable
@Serializable
data class OrderInvoiceCompanyDto(
    val name: String? = null,
    val address: String? = null,
    val city: String? = null,
    val country: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val taxId: String? = null,
)

/** buyer-of-record block of GET api/orders/{id}/invoice (route.ts:117-124). */
@Immutable
@Serializable
data class OrderInvoiceBuyerDto(
    val name: String? = null,
    val businessName: String? = null,
    val address: String? = null,
    val city: String? = null,
    val district: String? = null,
    val country: String? = null,
)

/** One item line of the order tax invoice (orders/[id]/invoice route.ts:88-98). */
@Immutable
@Serializable
data class OrderInvoiceItemDto(
    val id: String? = null,
    val productName: String? = null,
    val productImage: String? = null,
    val variant: String? = null,
    val quantity: Double? = null,
    val unitPrice: Double? = null,
    val total: Double? = null,
    val supplier: String? = null,
) {
    /** Stable identity for the items table keys (line id, index fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "invoice-item-${hashCode()}"
}

/**
 * data of GET api/orders/{id}/invoice — the TAX INVOICE document the web
 * order-invoice page renders (route.ts:110-133 verbatim). tax is the 15%
 * regulatory REFERENCE line (never summed into grandTotal); discount is
 * the honest server derivation (never a phantom); grandTotal is the
 * amount ACTUALLY charged.
 */
@Immutable
@Serializable
data class OrderInvoiceDto(
    val invoiceNumber: String? = null,
    val orderNumber: String? = null,
    val orderDate: String? = null,
    val invoiceDate: String? = null,
    val status: String? = null,
    val company: OrderInvoiceCompanyDto? = null,
    val buyer: OrderInvoiceBuyerDto? = null,
    val items: List<OrderInvoiceItemDto> = emptyList(),
    val subtotal: Double? = null,
    val shipping: Double? = null,
    val tax: Double? = null,
    val discount: Double? = null,
    val grandTotal: Double? = null,
    val paymentMethod: String? = null,
    val paymentStatus: String? = null,
)

/* ─── seller finance (api/finance) — supplier-scoped success shapes ─────── */

/** One recentSales row of GET api/finance/earnings (route.ts:87-90). */
@Immutable
@Serializable
data class RecentSaleDto(
    val total: Double? = null,
    val date: String? = null,
)

/**
 * data of GET api/finance/earnings (earnings/route.ts:76-92 verbatim).
 * commissionRate arrives as the string '3.0%'; totalPaidOut is the payout
 * LEDGER sum; availablePayout is wallet balance minus on-hold requests.
 * This DTO mirrors the SUCCESS shape only — a buyer's 403 never parses
 * into it, so a zero-shaped revenue card can never render from a role
 * denial (the gate lives in the VM).
 */
@Immutable
@Serializable
data class SellerEarningsDto(
    val grossGMV: Double? = null,
    val netEarnings: Double? = null,
    val platformCommission: Double? = null,
    val availablePayout: Double? = null,
    val onHoldForPayouts: Double? = null,
    val pendingEscrow: Double? = null,
    val totalPaidOut: Double? = null,
    val totalOrders: Int = 0,
    val commissionRate: String? = null,
    val currency: String? = null,
    val recentSales: List<RecentSaleDto> = emptyList(),
)

/**
 * One GET api/finance/commissions row (commissions/route.ts:45-55
 * verbatim): ratePercent is the caller's REAL affiliate rate rendered as
 * a string ('5.0%'), status is 'settled' | 'in_escrow' from the subOrder
 * status, subOrderNumber is the supplierProfiles id tail.
 */
@Immutable
@Serializable
data class CommissionItemDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val subOrderNumber: String? = null,
    val grossAmount: Double? = null,
    val ratePercent: String? = null,
    val commissionAmount: Double? = null,
    val netPayout: Double? = null,
    val status: String? = null,
    val date: String? = null,
) {
    /** Stable identity for keyed collections (row id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "commission-${hashCode()}"
}

/** data of GET api/finance/commissions (commissions/route.ts:63-68). */
@Immutable
@Serializable
data class CommissionBookDto(
    val totalGross: Double? = null,
    val totalCommissions: Double? = null,
    val items: List<CommissionItemDto> = emptyList(),
)

/* ─── public legal documents (api/legal) ─────────────────────────────────── */

/**
 * One legalFaqs row as the web payment-faq / payment-terms pages consume
 * it (faq/route.ts returns the full rows; these are the rendered fields).
 */
@Immutable
@Serializable
data class LegalFaqItemDto(
    val id: String? = null,
    val category: String? = null,
    val questionEn: String? = null,
    val answerEn: String? = null,
    val sortOrder: Int = 0,
    val isActive: Boolean = true,
) {
    /** Stable identity for the accordion keys. */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "legal-faq-${hashCode()}"
}

/**
 * The legalDocuments row fields the payment-terms page renders
 * (legal/[docType]/route.ts returns the full row; this is the tolerant
 * projection — contentEn is the whole policy body).
 */
@Immutable
@Serializable
data class LegalDocumentDto(
    val id: String? = null,
    val docType: String? = null,
    val titleEn: String? = null,
    val contentEn: String? = null,
    val version: String? = null,
    val updatedAt: String? = null,
)

/** data.document + data.faqs of GET api/legal/{docType} (route.ts:38-49). */
@Immutable
@Serializable
data class LegalDocumentPayloadDto(
    val document: LegalDocumentDto? = null,
    val faqs: List<LegalFaqItemDto> = emptyList(),
)

/** Envelope of GET api/legal/faq — { success, data: [...], total }. */
@Immutable
@Serializable
data class LegalFaqEnvelope(
    val success: Boolean = false,
    val data: List<LegalFaqItemDto> = emptyList(),
    val total: Int = 0,
    val error: String? = null,
)

/** Envelope of GET api/legal/{docType} — { success, data: { document, faqs } }. */
@Immutable
@Serializable
data class LegalDocumentEnvelope(
    val success: Boolean = false,
    val data: LegalDocumentPayloadDto? = null,
    val error: String? = null,
)
