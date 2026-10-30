package com.zylod.wholesale.ui.deals

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.DealItemDto
import com.zylod.wholesale.data.api.DealsPageData
import com.zylod.wholesale.data.api.DealsPageEnvelope
import com.zylod.wholesale.data.api.DealsPaginationDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Native Hot Deals VM — GET /api/deals?type=all&page=N&limit=20 (v2.4.8
 * ownership row: pageIds flash-deals/daily-deals/hot-deals/deals render
 * natively).
 *
 *  - ONE page counter drives BOTH sections: the endpoint applies the same
 *    skip/limit window to flashDeals and dailyDeals in a single payload, so
 *    auto-append advances both at once and stops at
 *    max(pagination.flash.totalPages, pagination.daily.totalPages).
 *  - INFINITE SCROLL: [loadMore] is called by the screen's snapshotFlow when
 *    the last row comes within ~400px of the viewport end; it is fully
 *    guarded (no concurrent fetches, no out-of-range pages) and appends with
 *    key-dedup — server-side orderBy can reshuffle rows between pages, and a
 *    duplicate key would crash the LazyColumn.
 *  - OFFLINE (OrdersViewModel degrade convention): on failure, renderable
 *    data survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_deals_cache", written after
 *    EVERY successful page as the accumulated envelope JSON) — and the state
 *    flips to `offline` so the screen shows its saved-deals banner. With
 *    nothing renderable at all: the honest first-launch offline state
 *    (error != null), never a blank screen.
 */
data class DealsUiState(
    val loading: Boolean = true,
    val flashDeals: List<DealItemDto> = emptyList(),
    val dailyDeals: List<DealItemDto> = emptyList(),
    val loadingMore: Boolean = false,
    val canLoadMore: Boolean = false,
    /** The visible rows are SAVED data (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved deals). */
    val error: String? = null,
)

class DealsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(DealsUiState())
    val state: StateFlow<DealsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /** Last fetched page (0 = nothing fetched yet). Drives both sections. */
    private var page = 0
    private var flashTotalPages = 0
    private var dailyTotalPages = 0

    /** Entry pull / retry (OrdersScreen t208 parity: called on EVERY entry). */
    fun refresh() {
        if (_state.value.loading || _state.value.loadingMore) return
        // t216 silent-refresh convention: with data already on screen, never
        // blank it behind a spinner — refresh replaces it in place.
        val hasData = _state.value.flashDeals.isNotEmpty() || _state.value.dailyDeals.isNotEmpty()
        _state.value = _state.value.copy(loading = !hasData, offline = false, error = null)
        viewModelScope.launch { fetch(pageNumber = 1, replace = true) }
    }

    /** Auto-append (robust guard: one fetch in flight, in-range pages only). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || s.error != null) return
        if (page == 0 || page >= maxOf(flashTotalPages, dailyTotalPages)) return
        _state.value = s.copy(loadingMore = true)
        viewModelScope.launch { fetch(pageNumber = page + 1, replace = false) }
    }

    private suspend fun fetch(pageNumber: Int, replace: Boolean) {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.dealsApi(base).deals(type = "all", page = pageNumber, limit = PAGE_LIMIT)
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load deals (HTTP ${response.code()})"
                degrade(message)
                return
            }
            val body = response.body()
            val data = body?.takeIf { it.success }?.data
            if (data == null) {
                degrade("Could not load deals")
                return
            }

            body.pagination?.flash?.totalPages?.let { flashTotalPages = it }
            body.pagination?.daily?.totalPages?.let { dailyTotalPages = it }

            val flash = if (replace) data.flashDeals else _state.value.flashDeals + data.flashDeals
            val daily = if (replace) data.dailyDeals else _state.value.dailyDeals + data.dailyDeals
            val (dedupedFlash, dedupedDaily) = dedupe(flash, daily)

            page = pageNumber
            _state.value = DealsUiState(
                loading = false,
                flashDeals = dedupedFlash,
                dailyDeals = dedupedDaily,
                canLoadMore = page < maxOf(flashTotalPages, dailyTotalPages),
                offline = false,
            )
            persistCache(dedupedFlash, dedupedDaily, body.pagination)
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            degrade("Network error while loading deals. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache; with neither, the first-launch offline state.
     * canLoadMore=false stops the scroll trigger from re-firing into a dead
     * network on every frame.
     */
    private suspend fun degrade(message: String) {
        val hasData = _state.value.flashDeals.isNotEmpty() || _state.value.dailyDeals.isNotEmpty()
        if (hasData) {
            _state.value = _state.value.copy(
                loading = false,
                loadingMore = false,
                offline = true,
                canLoadMore = false,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) { DealsCacheStore.read(appContext) }
        val data = cached?.data
        if (data != null && (data.flashDeals.isNotEmpty() || data.dailyDeals.isNotEmpty())) {
            _state.value = DealsUiState(
                loading = false,
                flashDeals = data.flashDeals,
                dailyDeals = data.dailyDeals,
                canLoadMore = false, // offline — nothing more to append
                offline = true,
            )
        } else {
            _state.value = DealsUiState(loading = false, error = message)
        }
    }

    /**
     * Key-dedup across the appended window: deals are ordered by
     * discountPercent server-side, so live reshuffles can repeat an id on a
     * later page — a duplicate LazyColumn key is a hard crash.
     */
    private fun dedupe(flash: List<DealItemDto>, daily: List<DealItemDto>): Pair<List<DealItemDto>, List<DealItemDto>> {
        val seen = HashSet<String>(flash.size + daily.size)
        val f = flash.filter { seen.add("f/${it.stableKey}") }
        val d = daily.filter { seen.add("d/${it.stableKey}") }
        return f to d
    }

    /**
     * Persist the ACCUMULATED rows as the wire envelope JSON — the saved
     * deals match what the user actually scrolled through, not just page 1.
     */
    private fun persistCache(flash: List<DealItemDto>, daily: List<DealItemDto>, pagination: DealsPaginationDto?) {
        val envelope = DealsPageEnvelope(
            success = true,
            data = DealsPageData(flashDeals = flash, dailyDeals = daily),
            pagination = pagination,
        )
        viewModelScope.launch(Dispatchers.IO) {
            DealsCacheStore.write(appContext, envelope)
        }
    }

    private companion object {
        const val PAGE_LIMIT = 20
    }
}

/**
 * On-device saved deals — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the key the owner brief fixed:
 * "native_deals_cache". Payload = the last accumulated /api/deals envelope,
 * so the offline render is byte-consistent with the online one.
 */
object DealsCacheStore {
    private const val TAG = "ZylodDeals"
    private const val PREFS = "zylod_config"
    const val KEY = "native_deals_cache"

    fun read(context: Context): DealsPageEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(DealsPageEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "deals cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: DealsPageEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(DealsPageEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "deals cache write failed: ${it.message}") }
    }
}
