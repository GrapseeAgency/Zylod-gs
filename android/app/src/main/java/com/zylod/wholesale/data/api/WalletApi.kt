package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Wallet endpoints — the REAL GET routes under src/app/api/wallet/**:
 *
 *  - GET api/wallet                     (wallet/route.ts)          overview + 5 recent rows
 *  - GET api/wallet/balance             (wallet/balance/route.ts)  available/escrow/inflow/outflow breakdown
 *  - GET api/wallet/transactions        (wallet/transactions/route.ts)  paged history (type/search/page/limit)
 *  - GET api/wallet/transactions/{id}   (wallet/transactions/[id]/route.ts)  one transaction detail
 *
 * Wire style is `{ success, data }` — the shared [ApiEnvelope] parses it
 * (same approach as CartApi/OrdersApi). Every money field is a Prisma Float
 * column (schema.prisma `wallets.balance`, `walletTransactions.amount` etc.),
 * so they arrive as JSON numbers and parse as Double — a fractional amount
 * never breaks the screen.
 *
 * The POST routes (topup, topup/initiate, withdraw, refund, gateway
 * callbacks/ipn) are deliberately NOT here: they belong to the add-money /
 * withdraw money flows, not to this read-only surface.
 */
interface WalletApi {

    /** GET /api/wallet — find-or-create wallet with its 5 most recent transactions. */
    @GET("api/wallet")
    suspend fun overview(): ApiEnvelope<WalletOverviewDto>

    /** GET /api/wallet/balance — available/escrow/inflow/outflow aggregate breakdown. */
    @GET("api/wallet/balance")
    suspend fun balance(): ApiEnvelope<WalletBalanceDto>

    /**
     * GET /api/wallet/transactions — history, newest first
     * (route skips type filter when `type == "all"`/absent; null sends no param).
     */
    @GET("api/wallet/transactions")
    suspend fun transactions(
        @Query("type") type: String? = null,
        @Query("search") search: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
    ): ApiEnvelope<WalletTransactionsDataDto>

    /** GET /api/wallet/transactions/{id} — one transaction, server-verified owner. */
    @GET("api/wallet/transactions/{id}")
    suspend fun transaction(@Path("id") id: String): ApiEnvelope<WalletTransactionDetailDto>
}

/** data of GET /api/wallet (wallet/route.ts:60-78). */
@Immutable
@Serializable
data class WalletOverviewDto(
    val id: String? = null,
    val balance: Double? = null,
    val currency: String? = null,
    val escrowBalance: Double? = null,
    val totalDeposits: Double? = null,
    val totalWithdrawals: Double? = null,
    val recentTransactions: List<WalletRecentTransactionDto> = emptyList(),
)

/**
 * recentTransactions[] row of GET /api/wallet — NOTE the date field is named
 * `date` here (wallet/route.ts:75) while the full history uses `createdAt`
 * (transactions/route.ts:53); two different wire names for the same column.
 */
@Immutable
@Serializable
data class WalletRecentTransactionDto(
    val id: String? = null,
    val type: String? = null,
    val amount: Double? = null,
    val balanceAfter: Double? = null,
    val description: String? = null,
    val date: String? = null,
)

/** data of GET /api/wallet/balance (wallet/balance/route.ts:55-70). */
@Immutable
@Serializable
data class WalletBalanceDto(
    val availableBalance: Double? = null,
    val currency: String? = null,
    val heldInEscrow: Double? = null,
    val releasedEscrow: Double? = null,
    val totalInflow: Double? = null,
    val totalOutflow: Double? = null,
    val totalDeposits: Double? = null,
    val totalWithdrawals: Double? = null,
    val totalPayments: Double? = null,
    val totalRefunds: Double? = null,
    val totalCashback: Double? = null,
)

/** data of GET /api/wallet/transactions (wallet/transactions/route.ts:43-61). */
@Immutable
@Serializable
data class WalletTransactionsDataDto(
    val transactions: List<WalletTransactionDto> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 20,
    val totalPages: Int = 1,
)

/**
 * One history row (wallet/transactions/route.ts:46-55). Every field is
 * optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse — same doctrine as [DealItemDto].
 */
@Immutable
@Serializable
data class WalletTransactionDto(
    val id: String? = null,
    val type: String? = null,
    val amount: Double? = null,
    val balanceAfter: Double? = null,
    val description: String? = null,
    val relatedEntityId: String? = null,
    val createdAt: String? = null,
    val status: String? = null,
) {
    /**
     * Stable identity for LazyColumn keys and append-dedup: the transaction
     * id (unique cuid per walletTransactions row).
     */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: "wallet-tx-${hashCode()}"
}

/** data of GET /api/wallet/transactions/{id} (wallet/transactions/[id]/route.ts:29-47). */
@Immutable
@Serializable
data class WalletTransactionDetailDto(
    val id: String? = null,
    val type: String? = null,
    val amount: Double? = null,
    val balanceAfter: Double? = null,
    val description: String? = null,
    val relatedEntityId: String? = null,
    val createdAt: String? = null,
    val status: String? = null,
    val fee: Double? = null,
    val currency: String? = null,
    val referenceNumber: String? = null,
    val paymentMethod: String? = null,
)

/**
 * On-device saved wallet — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the key the owner brief fixed:
 * "native_wallet_cache". Payload = the last successful balance + accumulated
 * history, so the offline render is consistent with the online one.
 */
@Serializable
data class WalletCacheEnvelope(
    val success: Boolean = false,
    val balance: WalletBalanceDto? = null,
    val transactions: List<WalletTransactionDto> = emptyList(),
    val total: Int = 0,
    val error: String? = null,
)
