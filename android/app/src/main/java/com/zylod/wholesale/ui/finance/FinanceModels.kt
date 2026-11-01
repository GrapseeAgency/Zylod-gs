package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.BankAccountDto
import com.zylod.wholesale.data.api.CardDto
import com.zylod.wholesale.data.api.PaymentMethodRowDto
import com.zylod.wholesale.data.api.WalletTransactionDetailDto
import com.zylod.wholesale.data.api.WalletTransactionDto
import kotlinx.serialization.KSerializer

/**
 * Shared helpers for the t256 financial-instrument surfaces (bank accounts,
 * cards, payment methods, wallet transaction history/detail). NO Compose
 * imports here — this file owns wire-adjacent state (offline cache keys +
 * envelopes) and pure Kotlin text helpers only, exactly like
 * ui/wallet/WalletFormat.kt's doctrine. The screens own colors/fonts.
 *
 * OFFLINE CACHE doctrine (AddressBookViewModel/LogisticsCacheStore
 * convention): every list/detail surface saves its last successful payload
 * into SharedPreferences "zylod_config" under its own key, and renders
 * that snapshot (with an honest offline banner) when the network fails —
 * never a fabricated placeholder row.
 */
object FinanceCacheKeys {
    /** The ONE prefs file the whole native shell uses. */
    const val PREFS = "zylod_config"

    /** Last successful GET api/bank-accounts list. */
    const val BANK_ACCOUNTS = "native_bank_accounts_cache"

    /** Last successful GET api/cards list. */
    const val CARDS = "native_cards_cache"

    /** Last successful GET api/payment-methods list (raw rows, both families). */
    const val PAYMENT_METHODS = "native_payment_methods_cache"

    /** Last successful GET api/wallet/transactions history (per filter). */
    const val TRANSACTION_HISTORY = "native_transaction_history_cache"

    /** Prefix for the per-transaction detail caches: key + the tx id. */
    const val TRANSACTION_DETAIL_PREFIX = "native_tx_detail_cache_"
}

/** Saved bank-accounts snapshot (the raw wire DTOs — offline render matches live). */
@kotlinx.serialization.Serializable
data class CachedBankAccounts(val rows: List<BankAccountDto> = emptyList())

/** Saved cards snapshot (the raw wire DTOs). */
@kotlinx.serialization.Serializable
data class CachedCards(val rows: List<CardDto> = emptyList())

/** Saved payment-methods snapshot (the raw db rows, every family). */
@kotlinx.serialization.Serializable
data class CachedPaymentMethods(val rows: List<PaymentMethodRowDto> = emptyList())

/**
 * Saved transaction-history snapshot — the accumulated rows plus the type
 * filter they were fetched under, so a degraded render only reuses a cache
 * that matches the chip the user is actually looking at.
 */
@kotlinx.serialization.Serializable
data class CachedTransactionHistory(
    val rows: List<WalletTransactionDto> = emptyList(),
    val total: Int = 0,
    val filter: String = "all",
)

/** Saved per-transaction detail snapshot (the raw wire DTO). */
@kotlinx.serialization.Serializable
data class CachedTransactionDetail(val detail: WalletTransactionDetailDto? = null)

/**
 * On-device saved finance payloads — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the [FinanceCacheKeys] keys.
 * Generic read/write over the caller's serializer (AddressCacheStore
 * convention).
 */
object FinanceCacheStore {
    private const val TAG = "ZylodFinance"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(FinanceCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "finance cache read failed ($key): ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(FinanceCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "finance cache write failed ($key): ${it.message}") }
    }
}

/* ─── payment-method families (payment-methods/route.ts:44-45) ───────────── */

/** The wire's mobile-wallet family — EXACT casing the route whitelists. */
val MOBILE_WALLET_TYPES = listOf("bKash", "Nagad", "Upay", "Rocket")

/** The wire's card family — EXACT values the route whitelists. */
val CARD_FAMILY_TYPES = listOf("debit", "credit")

/** The bank-accounts rail's family (GET api/bank-accounts where-clause). */
const val BANK_FAMILY_TYPE = "bank"

/** Case-insensitive family probes over the raw rows' type column. */
fun isMobileWalletType(type: String?): Boolean =
    type?.trim()?.lowercase() in setOf("bkash", "nagad", "upay", "rocket")

fun isCardFamilyType(type: String?): Boolean =
    type?.trim()?.lowercase() in setOf("card", "debit", "credit")

fun isBankFamilyType(type: String?): Boolean =
    type?.trim()?.lowercase() == BANK_FAMILY_TYPE

/* ─── Bangladeshi mobile validation (payment-methods/route.ts:50 mirror) ─── */

/**
 * The route's EXACT regex, mirrored client-side so the buyer gets the hint
 * before the wire does — the server's real 400 text still surfaces verbatim
 * when it fires.
 */
val BD_MOBILE_REGEX = Regex("^(\\+8801|8801|01)[3-9]\\d{8}$")

/** True when the (whitespace-stripped) value passes the route's phone shape. */
fun isValidBdMobile(accountNumber: String): Boolean =
    BD_MOBILE_REGEX.matches(accountNumber.replace(Regex("\\s+"), ""))

/* ─── display helpers (pure text, main-thread friendly) ──────────────────── */

/**
 * "•••• 1234" — the financial-surface mask. Values of ≤ 4 chars are ALREADY
 * tokenized last4 tails on the wire (the card rails) and render as-is.
 */
fun maskAccountTail(accountNumber: String?): String {
    val value = accountNumber?.trim().orEmpty()
    if (value.isEmpty()) return ""
    if (value.length <= 4) return value
    return "•••• ${value.takeLast(4)}"
}

/** Digit-groups for the card-number field's live display: "4111 1111 1111 1234". */
fun groupCardDigits(raw: String): String =
    raw.filter(Char::isDigit).chunked(4).joinToString(" ")

/**
 * MM/YY live-format for expiry fields: keeps digits only, inserts the
 * slash after the month, hard-caps at 4 digits. Not a validation — the
 * honest MM/YY check is [isValidExpiry].
 */
fun formatExpiryInput(raw: String): String {
    val digits = raw.filter(Char::isDigit).take(4)
    return if (digits.length <= 2) digits else "${digits.take(2)}/${digits.drop(2)}"
}

/** The payment-methods route's expiry shape: ^(0[1-9]|1[0-2])\/\d{2}$ mirrored. */
private val EXPIRY_REGEX = Regex("^(0[1-9]|1[0-2])/\\d{2}$")

/** True when the value is a real "MM/YY" pair (month 01-12). */
fun isValidExpiry(expiry: String): Boolean = EXPIRY_REGEX.matches(expiry.trim())

/**
 * The card row's label — the server already sends 'Debit Card' /
 * 'Credit Card' in cardType (cards/route.ts:27); when a shape drift drops
 * it, fall back to the honest type token instead of inventing a label.
 */
fun cardTypeLabel(cardType: String?): String =
    cardType?.takeIf(String::isNotBlank) ?: "Card"
