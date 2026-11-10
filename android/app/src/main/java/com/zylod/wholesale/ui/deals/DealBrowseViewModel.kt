package com.zylod.wholesale.ui.deals

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.DealItemDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistAddRequest
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t299 — DEAL BROWSE parity: the 14 DEAL_IDS pageIds that rendered the
 * generic pipeline (several with GROSSLY wrong endpoints — pre-order/
 * sample-orders/cross-border fetched `api/orders/my-orders`, the buyer's
 * ORDER LIST, under deal banners; clearance/seasonal-offers invented query
 * params; five fetched nothing) now render the web's GenericDealsPage
 * contract: GET api/deals?limit=20, BOTH lists merged, deduped by productId
 * (a product can run in both windows at once — the web's exact merge), the
 * DEAL_META banners verbatim, the deal card with the discount badge, the
 * t285 nowrap MOQ/claimed row and the honest "Only N left at deal price"
 * gate (stock 1..50).
 *
 * ONE VM serves all 14 pageIds keyed per pageId
 * (viewModel(key = "deal-browse-$pageId")). OFFLINE: the SHARED deals cache
 * (DealsCacheStore — the same key the Hot Deals tab's DealsViewModel owns
 * writes for) is the degrade source: one key, one writer, two honest
 * readers. HEARTS: PDP toggleWishlist convention (token gate → guest hint;
 * optimistic flip + wishlistApi rollback; markers from one GET
 * api/wishlist?limit=50 for signed-in sessions only).
 */
data class DealBrowseUiState(
    val loading: Boolean = true,
    val deals: List<DealItemDto> = emptyList(),
    val wishedIds: Set<String> = emptySet(),
    /** The visible rows are SAVED data (the shared deals cache), not a live fetch. */
    val offline: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved deals). */
    val error: String? = null,
    /** One-shot snackbar text (heart failures, guest-wall hint). */
    val toast: String? = null,
)

class DealBrowseViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(DealBrowseUiState())
    val state: StateFlow<DealBrowseUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    init {
        refresh()
    }

    /**
     * Entry pull / retry (t208 parity; the t242 guard lesson — only an
     * in-flight refresh WITH data on screen is a no-op).
     */
    fun refresh() {
        val s = _state.value
        if (loadJob?.isActive == true && s.deals.isNotEmpty()) return
        loadJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                // The web's exact call: /api/deals?limit=20 (the route merges
                // flash + daily into one payload; type=all is the accessor's
                // own default and the route's no-op).
                val response = ApiClient.dealsApi(base).deals(limit = 20)
                if (!response.isSuccessful) {
                    throw IllegalStateException("HTTP ${response.code()}")
                }
                val envelope = response.body()
                val data = envelope?.takeIf { it.success }?.data
                val merged = mergeDeals(
                    data?.flashDeals.orEmpty(),
                    data?.dailyDeals.orEmpty(),
                )
                _state.update {
                    it.copy(loading = false, deals = merged, offline = false, error = null)
                }
                if (SessionManager.token() != null) loadWishedIds(base)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "deal browse $pageId fetch failed: ${e.message}")
                val cached = DealsCacheStore.read(appContext)
                val merged = cached?.let { mergeDeals(it.data?.flashDeals.orEmpty(), it.data?.dailyDeals.orEmpty()) }
                if (!merged.isNullOrEmpty()) {
                    _state.update {
                        it.copy(loading = false, deals = merged, offline = true, error = null)
                    }
                } else {
                    _state.update {
                        it.copy(loading = false, error = "Could not load deals — check your connection and try again.")
                    }
                }
            }
        }
    }

    /**
     * The web's merge (generic-deals-page.tsx): flash first, daily second,
     * deduped by productId — one card per product even when it runs in both
     * windows. Key = the row's own productId ?: id (DealItemDto.effectiveId's
     * chain minus the product-embed fallback, which this route never sends).
     */
    private fun mergeDeals(flash: List<DealItemDto>, daily: List<DealItemDto>): List<DealItemDto> {
        val seen = HashSet<String>()
        val merged = ArrayList<DealItemDto>(flash.size + daily.size)
        for (d in flash + daily) {
            val key = d.productId ?: d.id ?: continue
            if (!seen.add(key)) continue
            merged.add(d)
        }
        return merged
    }

    /** Best-effort heart markers — a failure here never errors the grid. */
    private suspend fun loadWishedIds(base: String) {
        try {
            val response = ApiClient.wishlistApi(base).list(limit = 50)
            if (!response.isSuccessful) return
            val rows = response.body()?.takeIf { it.success }?.data.orEmpty()
            val ids = rows.mapNotNull { it.productId ?: it.product?.id }.toSet()
            if (ids.isNotEmpty()) {
                _state.update { it.copy(wishedIds = ids) }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "wishlist markers skipped: ${e.message}")
        }
    }

    fun toggleWishlist(productId: String) {
        if (SessionManager.token() == null) {
            _state.update { it.copy(toast = "Sign in to save products to your wishlist") }
            return
        }
        val had = productId in _state.value.wishedIds
        _state.update {
            it.copy(
                wishedIds = if (had) it.wishedIds - productId else it.wishedIds + productId,
            )
        }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = if (had) {
                    ApiClient.wishlistApi(base).remove(productId = productId)
                } else {
                    ApiClient.wishlistApi(base).add(WishlistAddRequest(productId = productId))
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(
                            wishedIds = if (had) it.wishedIds + productId else it.wishedIds - productId,
                            toast = "Could not update wishlist",
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        wishedIds = if (had) it.wishedIds + productId else it.wishedIds - productId,
                        toast = "Could not update wishlist",
                    )
                }
            }
        }
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    private companion object {
        const val TAG = "ZylodDealBrowse"
    }
}
