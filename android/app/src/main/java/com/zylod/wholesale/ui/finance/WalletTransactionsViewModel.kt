package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletTransactionDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Wallet-transactions VM — the paged history of GET api/wallet/transactions
 * through the EXISTING [com.zylod.wholesale.data.api.WalletApi] (t256 does
 * NOT redeclare wallet endpoints; transaction(id) on the same interface
 * feeds the transaction-detail page). Payload of record for the native
 * transaction-history pageId.
 *
 *  - PAGING: page/limit=20 with [loadMore] append + stable-key dedup (the
 *    WalletViewModel convention — server-side createdAt ordering can
 *    reshuffle rows between pages and a duplicate LazyColumn key is a
 *    crash).
 *  - TYPE FILTER: the route's REAL contract — `type` is an exact match on
 *    the walletTransactions.type column (deposit | withdrawal | payment |
 *    refund | cashback) and is SKIPPED when "all"/absent. The screen's
 *    chips send those exact wire values; "All" sends "all" (the route's
 *    documented skip token). There are no "credit"/"debit" wire values —
 *    credit/debit is a client-side DERIVATION (WalletFormat
 *    walletTxIsCredit), not a filter the server supports, so no such chip.
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 (the
 *    shared OkHttp authenticator already tried one refresh) → needsAuth
 *    with rendered data cleared.
 *  - OFFLINE (WalletViewModel degrade convention): on failure, renderable
 *    rows survive — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config", "native_transaction_history_cache",
 *    written after every successful page, tagged with the filter it was
 *    fetched under — a cache never renders under a different chip).
 */
data class WalletTransactionsUiState(
    val loading: Boolean = true,
    val transactions: List<WalletTransactionDto> = emptyList(),
    val txTotal: Int = 0,
    /** The active type filter — the wire value ("all" = the skip token). */
    val filter: String = FILTER_ALL,
    val loadingMore: Boolean = false,
    val canLoadMore: Boolean = false,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
) {
    companion object {
        /** The route's documented skip token for the type param. */
        const val FILTER_ALL = "all"
    }
}

class WalletTransactionsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(WalletTransactionsUiState())
    val state: StateFlow<WalletTransactionsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var page = 0
    private var totalPages = 1
    private var activeFilter = WalletTransactionsUiState.FILTER_ALL

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (WalletViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = WalletTransactionsUiState(
                        loading = false,
                        filter = activeFilter,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /**
     * Entry pull / retry (called on EVERY entry — the VM survives on the
     * saved back stack, so money moved elsewhere shows up at once). Guard
     * doctrine: only a refresh already in flight WITH data on screen is a
     * no-op (t216 silent-refresh convention).
     */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = WalletTransactionsUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        val s = _state.value
        val hasData = s.transactions.isNotEmpty()
        if (s.loadingMore) return
        if (s.loading && hasData) return
        _state.value = s.copy(
            loading = !hasData,
            offline = false,
            error = null,
            needsAuth = false,
            filter = activeFilter,
        )
        viewModelScope.launch { fetch(pageNumber = 1, replace = true) }
    }

    /** Same hook as OrdersViewModel.retry() — screens may bind either name. */
    fun retry() = refresh()

    /**
     * Type chip tap — swaps the filter and re-fetches page 1 (the route
     * filters server-side by the exact type value; "all" is the skip
     * token). Same-filter taps are no-ops.
     */
    fun setFilter(type: String) {
        if (type == activeFilter) return
        activeFilter = type
        if (SessionManager.token() == null) {
            _state.value = WalletTransactionsUiState(
                loading = false,
                filter = activeFilter,
                needsAuth = true,
            )
            return
        }
        _state.value = WalletTransactionsUiState(loading = true, filter = activeFilter)
        viewModelScope.launch { fetch(pageNumber = 1, replace = true) }
    }

    /** Auto-append (robust guard: one fetch in flight, in-range pages only). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || s.error != null || s.needsAuth) return
        if (page == 0 || page >= totalPages) return
        _state.value = s.copy(loadingMore = true)
        viewModelScope.launch { fetch(pageNumber = page + 1, replace = false) }
    }

    private suspend fun fetch(pageNumber: Int, replace: Boolean) {
        try {
            Log.i(TAG, "fetch page=$pageNumber replace=$replace filter=$activeFilter")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            // The EXISTING WalletApi — not redeclared (t256 contract).
            val response = ApiClient.walletApi(base).transactions(
                type = activeFilter.takeIf { it != WalletTransactionsUiState.FILTER_ALL },
                page = pageNumber,
                limit = PAGE_LIMIT,
            )
            if (response.code() == 401) {
                Log.w(TAG, "transactions 401 — session ended")
                _state.value = WalletTransactionsUiState(
                    loading = false,
                    filter = activeFilter,
                    needsAuth = true,
                )
                return
            }
            val payload = response.body()
            val data = payload?.data
            if (!response.isSuccessful || payload?.success != true || data == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your transaction history (HTTP ${response.code()})."
                Log.w(TAG, "transactions error: $message")
                degrade(message)
                return
            }

            data.totalPages.let { totalPages = it }
            val appended = if (replace) data.transactions
            else _state.value.transactions + data.transactions
            val deduped = dedupe(appended)

            page = pageNumber
            _state.value = WalletTransactionsUiState(
                loading = false,
                transactions = deduped,
                txTotal = data.total,
                filter = activeFilter,
                canLoadMore = page < totalPages,
                offline = false,
            )
            persistCache(deduped, data.total)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading your transaction history. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache ONLY when it was fetched under the same filter;
     * with neither, the first-launch offline state. canLoadMore=false
     * stops the scroll trigger re-firing into a dead network.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.transactions.isNotEmpty()) {
            _state.value = s.copy(
                loading = false,
                loadingMore = false,
                offline = true,
                canLoadMore = false,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(
                appContext,
                FinanceCacheKeys.TRANSACTION_HISTORY,
                CachedTransactionHistory.serializer(),
            )
        }
        val usable = cached?.takeIf { it.filter == activeFilter && it.rows.isNotEmpty() }
        if (usable != null) {
            _state.value = WalletTransactionsUiState(
                loading = false,
                transactions = usable.rows,
                txTotal = usable.total,
                filter = activeFilter,
                canLoadMore = false, // offline — nothing more to append
                offline = true,
            )
            page = 0 // loadMore must never fire against a dead network
        } else {
            _state.value = WalletTransactionsUiState(
                loading = false,
                filter = activeFilter,
                error = message,
            )
        }
    }

    /**
     * Key-dedup across the appended window: history is ordered by createdAt
     * server-side, so live inserts can repeat an id on a later page — a
     * duplicate LazyColumn key is a hard crash (WalletViewModel convention).
     */
    private fun dedupe(txs: List<WalletTransactionDto>): List<WalletTransactionDto> {
        val seen = HashSet<String>(txs.size)
        return txs.filter { seen.add(it.stableKey) }
    }

    /** Persist the ACCUMULATED rows, tagged with the filter they belong to. */
    private fun persistCache(txs: List<WalletTransactionDto>, total: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                FinanceCacheKeys.TRANSACTION_HISTORY,
                CachedTransactionHistory.serializer(),
                CachedTransactionHistory(rows = txs, total = total, filter = activeFilter),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
        const val PAGE_LIMIT = 20
    }
}

/**
 * The type chips' REAL wire values (schema.prisma walletTransactions.type
 * comment + the route's exact-match filter): deposit | withdrawal |
 * payment | refund | cashback, with "all" as the route's skip token.
 */
val WALLET_TX_FILTERS = listOf(
    "all" to "All",
    "deposit" to "Deposit",
    "withdrawal" to "Withdrawal",
    "payment" to "Payment",
    "refund" to "Refund",
    "cashback" to "Cashback",
)
