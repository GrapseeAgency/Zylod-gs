package com.zylod.wholesale.ui.wallet

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletBalanceDto
import com.zylod.wholesale.data.api.WalletCacheEnvelope
import com.zylod.wholesale.data.api.WalletTransactionDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Native Wallet VM — GET /api/wallet/balance + GET /api/wallet/transactions
 * (wallet/balance/route.ts + wallet/transactions/route.ts; both require auth).
 *
 *  - ONE fetch window = balance + page N of the history, in flight together;
 *    the pair degrades as a unit (a half-fresh wallet is harder to render
 *    honestly than a saved one).
 *  - INFINITE SCROLL: [loadMore] is called by the screen's snapshotFlow when
 *    the last row comes within ~400px of the viewport end; it is fully
 *    guarded (no concurrent fetches, no out-of-range pages) and appends with
 *    key-dedup — server-side orderBy createdAt can reshuffle rows between
 *    pages, and a duplicate key would crash the LazyColumn.
 *  - AUTH (OrdersViewModel convention): wallet data is per-user, so an
 *    absent token short-circuits to `needsAuth` without a network call, and
 *    a 401 (the shared OkHttp authenticator already tried one refresh) moves
 *    the screen to the sign-in state with rendered data CLEARED — a stale
 *    balance must never survive a dead session.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_wallet_cache", written after
 *    EVERY successful page as the accumulated envelope JSON) — and the state
 *    flips to `offline` so the screen shows its saved-wallet banner. With
 *    nothing renderable at all: the honest first-launch offline state
 *    (error != null), never a blank screen.
 */
data class WalletUiState(
    val loading: Boolean = true,
    val balance: WalletBalanceDto? = null,
    val transactions: List<WalletTransactionDto> = emptyList(),
    val txTotal: Int = 0,
    val loadingMore: Boolean = false,
    val canLoadMore: Boolean = false,
    /** The visible rows are SAVED data (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved wallet). */
    val error: String? = null,
)

class WalletViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(WalletUiState())
    val state: StateFlow<WalletUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /** Last fetched history page (0 = nothing fetched yet). */
    private var page = 0
    private var totalPages = 1

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to the
        // sign-in state instead of a stale (possibly someone else's) balance.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = WalletUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry pull / retry (called on EVERY entry — the VM survives on the
     * saved back stack, so a topup made elsewhere shows up at once).
     * Same guard doctrine as DealsViewModel.refresh(): only a refresh already
     * in flight WITH data on screen is a no-op (t216 silent-refresh
     * convention — never blank visible data behind a spinner).
     */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = WalletUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        val hasData = s.balance != null || s.transactions.isNotEmpty()
        if (s.loadingMore) return
        if (s.loading && hasData) return // a refresh already in flight with data on screen
        _state.value = s.copy(loading = !hasData, offline = false, error = null, needsAuth = false)
        viewModelScope.launch { fetch(pageNumber = 1, replace = true) }
    }

    /** Same hook as OrdersViewModel.retry() — screens may bind either name. */
    fun retry() = refresh()

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
            Log.i("ZylodWallet", "fetch page=$pageNumber replace=$replace")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.walletApi(base)
            // ONE window: balance + page N of the history, in flight together
            // (tiny payloads); either failure degrades the whole pair.
            val (balanceResp, txResp) = coroutineScope {
                val balanceCall = async { api.balance() }
                val txCall = async { api.transactions(page = pageNumber, limit = PAGE_LIMIT) }
                balanceCall.await() to txCall.await()
            }

            // 401: the shared authenticator has already attempted one token
            // refresh by the time a 401 reaches this layer → real end of
            // session (or a non-buyer account) → sign-in state, data cleared.
            if (balanceResp.code() == 401 || txResp.code() == 401) {
                Log.w("ZylodWallet", "wallet 401 — session ended")
                _state.value = WalletUiState(loading = false, needsAuth = true)
                return
            }
            if (!balanceResp.isSuccessful || !txResp.isSuccessful) {
                val message = parseErrorBody(
                    balanceResp.errorBody() ?: txResp.errorBody(),
                ).error?.takeIf(String::isNotBlank)
                    ?: "Could not load wallet (HTTP ${balanceResp.code()})"
                Log.w("ZylodWallet", "wallet error: $message")
                degrade(message)
                return
            }
            val balance = balanceResp.body()?.takeIf { it.success }?.data
            val txData = txResp.body()?.takeIf { it.success }?.data
            Log.i("ZylodWallet", "wallet http=${balanceResp.code()} txs=${txData?.transactions?.size ?: -1}")
            if (balance == null || txData == null) {
                degrade("Could not load wallet")
                return
            }

            txData.totalPages.let { totalPages = it }
            val appended = if (replace) txData.transactions
            else _state.value.transactions + txData.transactions
            val deduped = dedupe(appended)

            page = pageNumber
            _state.value = WalletUiState(
                loading = false,
                balance = balance,
                transactions = deduped,
                txTotal = txData.total,
                canLoadMore = page < totalPages,
                offline = false,
            )
            persistCache(balance, deduped, txData.total)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w("ZylodWallet", "fetch failed: ${e.message}")
            degrade("Network error while loading your wallet. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache; with neither, the first-launch offline state.
     * canLoadMore=false stops the scroll trigger from re-firing into a dead
     * network on every frame.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.balance != null || s.transactions.isNotEmpty()) {
            _state.value = s.copy(
                loading = false,
                loadingMore = false,
                offline = true,
                canLoadMore = false,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) { WalletCacheStore.read(appContext) }
        val renderable = cached?.takeIf { it.balance != null || it.transactions.isNotEmpty() }
        if (renderable != null) {
            _state.value = WalletUiState(
                loading = false,
                balance = renderable.balance,
                transactions = renderable.transactions,
                txTotal = renderable.total,
                canLoadMore = false, // offline — nothing more to append
                offline = true,
            )
            page = 0 // loadMore must never fire against a dead network
        } else {
            _state.value = WalletUiState(loading = false, error = message)
        }
    }

    /**
     * Key-dedup across the appended window: history is ordered by createdAt
     * server-side, so live inserts can repeat an id on a later page — a
     * duplicate LazyColumn key is a hard crash.
     */
    private fun dedupe(txs: List<WalletTransactionDto>): List<WalletTransactionDto> {
        val seen = HashSet<String>(txs.size)
        return txs.filter { seen.add(it.stableKey) }
    }

    /**
     * Persist the ACCUMULATED rows as the cache envelope JSON — the saved
     * wallet matches what the user actually scrolled through, not just page 1.
     */
    private fun persistCache(balance: WalletBalanceDto, txs: List<WalletTransactionDto>, total: Int) {
        val envelope = WalletCacheEnvelope(
            success = true,
            balance = balance,
            transactions = txs,
            total = total,
        )
        viewModelScope.launch(Dispatchers.IO) {
            WalletCacheStore.write(appContext, envelope)
        }
    }

    private companion object {
        const val PAGE_LIMIT = 20
    }
}

/**
 * On-device saved wallet — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the key the owner brief fixed:
 * "native_wallet_cache". Payload = the last accumulated balance + history
 * envelope, so the offline render is consistent with the online one.
 */
object WalletCacheStore {
    private const val TAG = "ZylodWallet"
    private const val PREFS = "zylod_config"
    const val KEY = "native_wallet_cache"

    fun read(context: Context): WalletCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(WalletCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "wallet cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: WalletCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(WalletCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "wallet cache write failed: ${it.message}") }
    }
}
