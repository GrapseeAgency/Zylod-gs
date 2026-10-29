package com.zylod.wholesale.ui.home

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.BannerDto
import com.zylod.wholesale.data.api.BannersData
import com.zylod.wholesale.data.api.CategoryDto
import com.zylod.wholesale.data.api.DealsData
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.StatsDto
import com.zylod.wholesale.data.api.ZylodApi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t233 — the NATIVE Home ViewModel (owner directive: every SPA page becomes
 * a Kotlin screen; the home tab root is the first one).
 *
 * Sections (one parallel burst, one shared memoized OkHttp/Retrofit client):
 *  - banners   GET api/banners?position=home_top (REAL banners table, public);
 *  - stats     product + supplier totals (count probes);
 *  - deals     GET api/deals?type=flash&limit=8;
 *  - categories GET api/categories (top level, 12);
 *  - featured  GET api/products?page=N — INFINITE APPEND driven by the
 *              screen's snapshotFlow (same contract as DealsScreen).
 *
 * OFFLINE (DealsViewModel degrade convention): on failure renderable data
 * survives — in-memory first, then the device-saved [HomeSnapshot] under
 * prefs "zylod_config"/"native_home_cache" — and the state flips `offline`
 * so the screen shows its saved banner. Nothing renderable at all → honest
 * error + Retry. Never a white screen.
 */
data class HomeUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val banners: List<BannerDto> = emptyList(),
    val categories: List<CategoryDto> = emptyList(),
    val deals: List<ProductDto> = emptyList(),
    val dealsRaw: List<com.zylod.wholesale.data.api.DealDto> = emptyList(),
    val products: List<ProductDto> = emptyList(),
    val stats: StatsDto? = null,
    val loadingMore: Boolean = false,
    val canLoadMore: Boolean = false,
    /** Visible rows are SAVED data, not a live fetch. */
    val offline: Boolean = false,
)

@Serializable
private data class HomeSnapshot(
    val banners: List<BannerDto> = emptyList(),
    val categories: List<CategoryDto> = emptyList(),
    val dealsRaw: List<com.zylod.wholesale.data.api.DealDto> = emptyList(),
    val products: List<ProductDto> = emptyList(),
    val stats: StatsDto? = null,
)

class HomeViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    private var api: ZylodApi? = null
    private var page = 0
    private var totalPages = 1

    /** Entry pull / retry. Silent refresh when data is already on screen. */
    fun refresh() {
        val hasData = _state.value.products.isNotEmpty() || _state.value.categories.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null) }
        viewModelScope.launch { fetchFirstPage() }
    }

    /** Auto-append (guarded: one fetch in flight, in-range pages only). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || s.error != null) return
        if (page == 0 || page >= totalPages) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch { fetchPage(page + 1, replace = false) }
    }

    private suspend fun <T> safeCall(block: suspend () -> T): T? =
        try {
            block()
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "home section call failed: ${e.message}")
            null
        }

    private suspend fun fetchFirstPage() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.create(baseUrl, appContext).also { api = it }

            var banners: ApiEnvelope<BannersData>? = null
            var categories: ApiEnvelope<List<CategoryDto>>? = null
            var deals: ApiEnvelope<DealsData>? = null
            var products: ApiEnvelope<List<ProductDto>>? = null
            var productTotal: ApiEnvelope<kotlinx.serialization.json.JsonElement>? = null
            var supplierTotal: ApiEnvelope<kotlinx.serialization.json.JsonElement>? = null

            coroutineScope {
                val b = async { safeCall { client.banners() } }
                val c = async { safeCall { client.categories() } }
                val d = async { safeCall { client.flashDeals() } }
                val p = async { safeCall { client.products(page = 1) } }
                val pt = async { safeCall { client.productCount() } }
                val st = async { safeCall { client.supplierCount() } }
                banners = b.await()
                categories = c.await()
                deals = d.await()
                products = p.await()
                productTotal = pt.await()
                supplierTotal = st.await()
            }

            if (categories == null && products == null) {
                degrade("Can't reach Zylod servers. Check your connection and retry.")
                return
            }
            if (categories?.success != true || products?.success != true) {
                degrade("Server error — the backend is unhealthy. Retry in a moment.")
                return
            }

            products?.pagination?.let {
                page = it.page
                totalPages = it.totalPages
            }
            val freshProducts = products?.data.orEmpty()
            val freshCategories = (categories?.data ?: emptyList()).take(12)
            val freshDeals = (deals?.data?.all ?: deals?.data?.flashDeals ?: emptyList()).take(8)
            val freshBanners = banners?.data?.banners.orEmpty()
            val freshStats = StatsDto(
                productCount = productTotal?.pagination?.total ?: 0,
                supplierCount = supplierTotal?.pagination?.total ?: 0,
            )

            _state.value = HomeUiState(
                loading = false,
                banners = freshBanners,
                categories = freshCategories,
                dealsRaw = freshDeals,
                products = freshProducts,
                stats = freshStats,
                canLoadMore = page < totalPages,
                offline = false,
            )
            persistSnapshot(freshBanners, freshCategories, freshDeals, freshProducts, freshStats)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "home refresh failed: ${e.message}")
            degrade("Network error while loading Home. Check your connection and retry.")
        }
    }

    private suspend fun fetchPage(pageNumber: Int, replace: Boolean) {
        try {
            val client = api ?: return
            // Non-2xx throws (bare ApiEnvelope return) — the catch below turns
            // it into the offline degrade, keeping visible rows mounted.
            val envelope = client.products(page = pageNumber)
            envelope.pagination?.let {
                page = it.page
                totalPages = it.totalPages
            }
            val incoming = envelope.data.orEmpty().filter { fresh -> fresh.id.isNotBlank() }
            // Append with key-dedup — server reshuffles can repeat an id and a
            // duplicate LazyColumn key is a hard crash (DealsViewModel rule).
            val merged = if (replace) incoming else {
                val seen = _state.value.products.mapTo(HashSet()) { it.id }
                _state.value.products + incoming.filter { seen.add(it.id) }
            }
            _state.value = _state.value.copy(
                loading = false,
                loadingMore = false,
                products = merged,
                canLoadMore = page < totalPages,
                offline = false,
            )
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            _state.update { it.copy(loadingMore = false, offline = true, canLoadMore = false) }
        }
    }

    private suspend fun degrade(message: String) {
        val snapshot = _state.value
        if (snapshot.products.isNotEmpty() || snapshot.categories.isNotEmpty()) {
            _state.value = snapshot.copy(loading = false, loadingMore = false, offline = true, canLoadMore = false)
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && (saved.products.isNotEmpty() || saved.categories.isNotEmpty())) {
            page = 1
            totalPages = 1
            _state.value = HomeUiState(
                loading = false,
                banners = saved.banners,
                categories = saved.categories,
                dealsRaw = saved.dealsRaw,
                products = saved.products,
                stats = saved.stats,
                canLoadMore = false,
                offline = true,
            )
        } else {
            _state.value = HomeUiState(loading = false, error = message)
        }
    }

    private fun persistSnapshot(
        banners: List<BannerDto>,
        categories: List<CategoryDto>,
        deals: List<com.zylod.wholesale.data.api.DealDto>,
        products: List<ProductDto>,
        stats: StatsDto,
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            runCatching {
                val raw = ApiClient.json.encodeToString(
                    HomeSnapshot.serializer(),
                    HomeSnapshot(banners, categories, deals, products, stats),
                )
                appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putString(KEY, raw).apply()
            }.onFailure { Log.w(TAG, "home cache write failed: ${it.message}") }
        }
    }

    private fun readSnapshot(): HomeSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(HomeSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "home cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodHome"
        const val PREFS = "zylod_config"
        const val KEY = "native_home_cache"
    }
}
