package com.zylod.wholesale.ui.finance

import com.zylod.wholesale.data.api.CommissionBookDto
import com.zylod.wholesale.data.api.CreditLineDto
import com.zylod.wholesale.data.api.CreditScoreDto
import com.zylod.wholesale.data.api.FailedPaymentRowDto
import com.zylod.wholesale.data.api.InvoiceRowDto
import com.zylod.wholesale.data.api.LegalDocumentDto
import com.zylod.wholesale.data.api.LegalFaqItemDto
import com.zylod.wholesale.data.api.OrderInvoiceDto
import com.zylod.wholesale.data.api.PaymentHistoryRowDto
import com.zylod.wholesale.data.api.PaymentMethodRowDto
import com.zylod.wholesale.data.api.PendingPaymentRowDto
import com.zylod.wholesale.data.api.SellerEarningsDto
import com.zylod.wholesale.data.api.WalletOverviewDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Shared models for the t257 credit/payments/invoices surfaces. Same
 * doctrine as [FinanceModels] (t256): NO Compose imports — this file owns
 * offline-cache keys + envelopes and pure-Kotlin text helpers only; the
 * screens own colors/fonts. [FinanceCacheStore] (the generic read/write
 * over SharedPreferences "zylod_config") is REUSED from FinanceModels.kt —
 * never redeclared.
 */
object CreditCacheKeys {
    /** The ONE prefs file the whole native shell uses (FinanceCacheKeys.PREFS twin). */
    const val PREFS = "zylod_config"

    /** Last successful GET api/credits/limit facility. */
    const val CREDIT_LIMIT = "native_credit_limit_cache"

    /** Last successful GET api/credits/score rating. */
    const val CREDIT_SCORE = "native_credit_score_cache"

    /** Last successful GET api/payments/history list, tagged with its status filter. */
    const val PAYMENT_HISTORY = "native_payment_history_cache"

    /** Last successful GET api/payments/pending merged list. */
    const val PENDING_PAYMENTS = "native_pending_payments_cache"

    /** Last successful GET api/payments/failed list. */
    const val FAILED_PAYMENTS = "native_failed_payments_cache"

    /** Last successful GET api/invoices list, tagged with its paymentStatus filter. */
    const val INVOICES = "native_invoices_cache"

    /** Prefix for the per-order tax-invoice caches: key + the order id. */
    const val INVOICE_DETAIL_PREFIX = "native_invoice_detail_cache_"

    /** Last successful GET api/finance/earnings payload. */
    const val SELLER_FINANCE = "native_seller_finance_cache"

    /** Last successful GET api/finance/commissions payload. */
    const val SELLER_COMMISSIONS = "native_seller_commissions_cache"

    /** Last successful GET api/wallet/balance (the apply-credits page). */
    const val APPLY_CREDITS = "native_apply_credits_cache"

    /** The payment hub's wallet overview + default method snapshot. */
    const val PAYMENT_HUB = "native_payment_hub_cache"

    /** Last successful GET api/legal/faq?docType=payment_terms rows. */
    const val PAYMENT_FAQ = "native_payment_faq_cache"

    /** Last successful GET api/legal/payment_terms document. */
    const val PAYMENT_TERMS = "native_payment_terms_cache"
}

/* ─── offline cache envelopes (the raw wire DTOs — offline render matches live) ─── */

/** Saved credit-line snapshot (GET api/credits/limit). */
@kotlinx.serialization.Serializable
data class CachedCreditLine(val line: CreditLineDto? = null)

/** Saved credit-score snapshot (GET api/credits/score). */
@kotlinx.serialization.Serializable
data class CachedCreditScoreCard(val score: CreditScoreDto? = null)

/** Saved payment-history snapshot, tagged with the status filter it belongs to. */
@kotlinx.serialization.Serializable
data class CachedPaymentHistory(
    val rows: List<PaymentHistoryRowDto> = emptyList(),
    val filter: String = "all",
)

/** Saved pending-clearances snapshot (GET api/payments/pending). */
@kotlinx.serialization.Serializable
data class CachedPendingPayments(val rows: List<PendingPaymentRowDto> = emptyList())

/** Saved failed-payments snapshot (GET api/payments/failed). */
@kotlinx.serialization.Serializable
data class CachedFailedPayments(val rows: List<FailedPaymentRowDto> = emptyList())

/** Saved invoices snapshot, tagged with the paymentStatus filter it belongs to. */
@kotlinx.serialization.Serializable
data class CachedInvoices(
    val rows: List<InvoiceRowDto> = emptyList(),
    val filter: String = "all",
)

/** Saved per-order tax-invoice snapshot (GET api/orders/{id}/invoice). */
@kotlinx.serialization.Serializable
data class CachedInvoiceDetail(val detail: OrderInvoiceDto? = null)

/** Saved seller-earnings snapshot (GET api/finance/earnings — supplier sessions only). */
@kotlinx.serialization.Serializable
data class CachedSellerFinance(val earnings: SellerEarningsDto? = null)

/** Saved commission-book snapshot (GET api/finance/commissions). */
@kotlinx.serialization.Serializable
data class CachedCommissions(val book: CommissionBookDto? = null)

/** Saved wallet-balance snapshot (GET api/wallet/balance — apply-credits). */
@kotlinx.serialization.Serializable
data class CachedApplyCreditsBalance(val balance: com.zylod.wholesale.data.api.WalletBalanceDto? = null)

/** Saved payment-hub snapshot (wallet overview + the default method row). */
@kotlinx.serialization.Serializable
data class CachedPaymentHub(
    val wallet: WalletOverviewDto? = null,
    val defaultMethod: PaymentMethodRowDto? = null,
)

/** Saved payment-FAQ snapshot (GET api/legal/faq?docType=payment_terms). */
@kotlinx.serialization.Serializable
data class CachedPaymentFaqs(val rows: List<LegalFaqItemDto> = emptyList())

/** Saved payment-terms document snapshot (GET api/legal/payment_terms). */
@kotlinx.serialization.Serializable
data class CachedPaymentTermsDocument(val document: LegalDocumentDto? = null)

/* ─── filter chip lists (the routes' REAL wire values) ──────────────────── */

/**
 * GET api/payments/history status chips — EXACTLY the four the web
 * payment-history page renders (payment-history-page.tsx:74-79): `all` is
 * the route's skip token; success/pending/failed are the exact
 * payments.status values the where-clause matches.
 */
val PAYMENT_HISTORY_FILTERS = listOf(
    "all" to "All Payments",
    "success" to "Completed",
    "pending" to "Pending",
    "failed" to "Failed",
)

/**
 * GET api/invoices paymentStatus chips — EXACTLY the three the web
 * invoice-management page renders (invoice-management-page.tsx:176-180):
 * `all` is the route's skip token; paid/pending are the exact
 * orders.paymentStatus values the where-clause matches.
 */
val INVOICE_STATUS_FILTERS = listOf(
    "all" to "All Invoices",
    "paid" to "Settled / Paid",
    "pending" to "Unpaid / Invoiced",
)

/** The pending route's two real row families (payments/pending/route.ts). */
const val PENDING_TYPE_CLEARANCE = "Order Payment Clearance"
const val PENDING_TYPE_ESCROW = "Trade Assurance Escrow"

/* ─── pure text helpers (main-thread friendly, like WalletFormat) ────────── */

/** ISO instants on the money wire: "2024-05-05T10:00:00.000Z". */
private val moneyIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private val moneyDateFormat = SimpleDateFormat("MMM d, yyyy", Locale.US)

/**
 * Absolute short-date text ("Jan 5, 2025") for invoice/payment dates —
 * same parser contract as WalletFormat.formatRelativeDate: unparsable or
 * blank input yields "" so the caller can drop the segment instead of
 * inventing one.
 */
fun formatMoneyDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { moneyIsoParser.parse(iso) }.getOrNull() ?: return ""
    return moneyDateFormat.format(parsed)
}

/**
 * The credit gauge's utilization fraction (0f..1f) — used vs limit, guarded
 * against a zero/absent limit (never NaN, never >1).
 */
fun creditUtilizationFraction(used: Double?, limit: Double?): Float {
    val usedValue = used ?: 0.0
    val limitValue = limit ?: 0.0
    if (limitValue <= 0.0) return 0f
    return (usedValue / limitValue).toFloat().coerceIn(0f, 1f)
}

/**
 * The score dial's fraction toward maxScore (0f..1f) — guarded against a
 * zero/absent maxScore (never NaN).
 */
fun creditScoreFraction(score: Int?, maxScore: Int?): Float {
    val max = maxScore ?: 0
    if (max <= 0) return 0f
    return ((score ?: 0).toDouble() / max).toFloat().coerceIn(0f, 1f)
}
