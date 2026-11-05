package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierCoreApi
import com.zylod.wholesale.data.api.SupplierCoreListingEnvelope
import com.zylod.wholesale.data.api.SupplierCoreListingPagination
import com.zylod.wholesale.data.api.SupplierCoreListingProduct
import com.zylod.wholesale.data.api.SupplierCorePublicSupplier
import com.zylod.wholesale.data.api.SupplierCorePublicSupplierEnvelope
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t269 — Supplier Listing VM (pageId "supplier-listing"): the PUBLIC
 * supplier storefront lens. GET api/suppliers/{id} (suppliers/[id]/route.ts)
 * for the profile + GET api/products?supplierId=&page=&limit=
 * (products/route.ts) for the paginated listings — NO not-seller gate, both
 * routes answer guests (the Bearer header is simply ignored).
 *
 *  - SUPPLIER ID: parsed from the query ("supplierId=abc" wins, then "id=abc"
 *    — the web's pageParams.supplierId || pageParams.id fallback chain).
 *    Blank id → the honest "no supplier selected" landing state, no fetch,
 *    no fabricated data.
 *  - 404: an unknown id renders the SERVER'S OWN parsed error text.
 *  - PAGINATION: page 1 loads with the profile; loadMore() appends page+1
 *    with an id-dedupe guard (a retried append can never double rows) and
 *    the control hides once page >= totalPages.
 *  - OFFLINE: in-memory snapshot first, then the saved cache under the
 *    SUPPLIER-KEYED prefs key
 *    "native_supplier_core_supplier-listing_<supplierId>_cache" — supplier
 *    A's cached page can never render on supplier B's page.
 *  - t216 silent refresh never blanks visible data behind a spinner.
 */
data class SupplierListingUiState(
    val loading: Boolean = true,
    /** A silent re-pull with data already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    /** The parsed query supplier id — blank = the honest landing state. */
    val supplierId: String = "",
    val profile: SupplierCorePublicSupplier? = null,
    val products: List<SupplierCoreListingProduct> = emptyList(),
    /** Committed client-side category filter — "all" shows every row. */
    val activeCategory: String = "all",
    /** Last committed products page (1-based). */
    val page: Int = 1,
    val totalPages: Int = 1,
    /** The pagination block's total (the header count). */
    val total: Int = 0,
    /** An in-flight loadMore() append. */
    val loadingMore: Boolean = false,
    /** Products fetch failed while the profile renders — banner + retry. */
    val productsError: String? = null,
    /** The server's parsed 404 text — the honest "no such supplier" state. */
    val notFoundMessage: String? = null,
    /** Set only when nothing is renderable (no network AND no saved page). */
    val error: String? = null,
    /** The visible data is the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible data came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
)

class SupplierListingViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierListingUiState())
    val state: StateFlow<SupplierListingUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /**
     * Entry pull — re-parses the supplier id on EVERY entry (the VM survives
     * the back stack); a DIFFERENT id resets the page (per-supplier cache
     * key), a blank id lands on the honest empty state without a fetch.
     */
    fun refresh(query: String) {
        val supplierId = parseSupplierId(query)
        if (supplierId != _state.value.supplierId) {
            _state.value = SupplierListingUiState(
                supplierId = supplierId,
                loading = supplierId.isNotBlank(),
            )
        } else if (supplierId.isBlank()) {
            _state.update { it.copy(loading = false) }
        }
        if (supplierId.isBlank()) return
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() {
        if (fetchJob?.isActive == true) return
        if (_state.value.supplierId.isBlank()) return
        startLoad()
    }

    /** Category chip — client-side filter over the loaded rows (web parity). */
    fun setCategory(category: String) {
        _state.update { it.copy(activeCategory = category) }
    }

    /** Append the next products page (id-dedupe safe, guarded like the web). */
    fun loadMore() {
        val s = _state.value
        if (fetchJob?.isActive == true || s.loadingMore) return
        if (s.supplierId.isBlank() || s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        fetchJob = viewModelScope.launch {
            try {
                Log.i(TAG, "load more supplier products page=${s.page + 1}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)
                val response = api.supplierListingProducts(
                    supplierId = s.supplierId,
                    page = s.page + 1,
                    limit = PAGE_SIZE,
                )
                if (!response.isSuccessful) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load more products (HTTP ${response.code()})"
                    Log.w(TAG, "load more error: $message")
                    _state.update { it.copy(loadingMore = false, productsError = message) }
                    return@launch
                }
                val body: SupplierCoreListingEnvelope? = response.body()
                if (body == null || !body.success) {
                    _state.update {
                        it.copy(loadingMore = false, productsError = "Could not load more products")
                    }
                    return@launch
                }
                val rows = body.data
                val pagination = body.pagination
                _state.update { current ->
                    // t230 web parity — the append is id-dedupe safe: a retry
                    // after a partial failure can never double a row.
                    val seen = current.products.mapNotNull { it.id }.toHashSet()
                    val deduped = rows.filter { row ->
                        val id = row.id
                        id == null || id !in seen
                    }
                    current.copy(
                        loadingMore = false,
                        products = current.products + deduped,
                        page = pagination?.page ?: (s.page + 1),
                        totalPages = pagination?.totalPages ?: current.totalPages,
                        total = pagination?.total ?: current.total,
                        productsError = null,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "load more failed: ${e.message}")
                _state.update {
                    it.copy(
                        loadingMore = false,
                        productsError = "Network error while loading more products. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private fun startLoad() {
        fetchJob?.cancel()
        val hasData = _state.value.profile != null || _state.value.products.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasData,
                refreshing = hasData,
                error = null,
                offline = false,
                offlineFromCache = false,
                notFoundMessage = null,
            )
        }
        fetchJob = viewModelScope.launch { fetchFirstPage() }
    }

    /** Profile first (it mounts alone), then the FIRST products page. */
    private suspend fun fetchFirstPage() {
        val s = _state.value
        try {
            Log.i(TAG, "fetch supplier listing supplierId=${s.supplierId}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api: SupplierCoreApi = ApiClient.supplierCoreApi(base)

            val profileResponse = api.supplierPublic(s.supplierId)
            // HONEST 404 — an unknown supplier id; the server's own error
            // text is the state (never invented copy).
            if (profileResponse.code() == 404) {
                val message = parseErrorBody(profileResponse.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Supplier not found"
                Log.i(TAG, "no such supplier (http=404)")
                _state.value = SupplierListingUiState(
                    loading = false,
                    supplierId = s.supplierId,
                    notFoundMessage = message,
                )
                return
            }
            if (!profileResponse.isSuccessful) {
                degrade("Could not load this supplier (HTTP ${profileResponse.code()})")
                return
            }
            val profileBody: SupplierCorePublicSupplierEnvelope? = profileResponse.body()
            val profile = profileBody?.takeIf { it.success }?.data
            if (profile == null) {
                degrade("Could not load this supplier")
                return
            }
            // Mount the profile immediately — the products round-trip below
            // must not blank it (web renders the two independently).
            _state.update {
                it.copy(loading = false, profile = profile)
            }

            val productsResponse = api.supplierListingProducts(
                supplierId = s.supplierId,
                page = 1,
                limit = PAGE_SIZE,
            )
            if (!productsResponse.isSuccessful) {
                val message = parseErrorBody(productsResponse.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load products (HTTP ${productsResponse.code()})"
                Log.w(TAG, "supplier products error: $message")
                _state.update { it.copy(refreshing = false, productsError = message) }
                return
            }
            val productsBody: SupplierCoreListingEnvelope? = productsResponse.body()
            if (productsBody == null || !productsBody.success) {
                _state.update {
                    it.copy(refreshing = false, productsError = "Could not load products")
                }
                return
            }
            val rows = productsBody.data
            val pagination = productsBody.pagination
            _state.value = _state.value.copy(
                refreshing = false,
                products = rows,
                page = pagination?.page ?: 1,
                totalPages = pagination?.totalPages ?: 1,
                total = pagination?.total ?: rows.size,
                productsError = null,
                error = null,
                offline = false,
                offlineFromCache = false,
            )
            persistCache(profile, rows, pagination)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "supplier listing fetch failed: ${e.message}")
            degrade("Network error while loading this supplier. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory snapshot
     * first, then the SUPPLIER-KEYED saved cache; with neither, the first-
     * launch offline state. The snapshot is mapped on the MAIN thread after
     * the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.profile != null || _state.value.products.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val supplierId = _state.value.supplierId
        val cached = withContext(Dispatchers.IO) {
            SupplierListingCacheStore.read(appContext, supplierId)
        }
        if (cached != null && (cached.profile != null || cached.products.isNotEmpty())) {
            _state.value = SupplierListingUiState(
                loading = false,
                supplierId = supplierId,
                profile = cached.profile,
                products = cached.products,
                page = cached.page,
                totalPages = cached.totalPages,
                total = cached.total,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire snapshot — the offline render matches the online one. */
    private fun persistCache(
        profile: SupplierCorePublicSupplier,
        rows: List<SupplierCoreListingProduct>,
        pagination: SupplierCoreListingPagination?,
    ) {
        val payload = CachedSupplierListingPage(
            profile = profile,
            products = rows,
            page = pagination?.page ?: 1,
            totalPages = pagination?.totalPages ?: 1,
            total = pagination?.total ?: rows.size,
        )
        viewModelScope.launch(Dispatchers.IO) {
            SupplierListingCacheStore.write(appContext, _state.value.supplierId, payload)
        }
    }

    /**
     * "supplierId=abc" || "id=abc" — the web's pageParams.supplierId ||
     * pageParams.id chain. The ZylodRoot hand-off is a bare "k=v&k2=v2"
     * string (already URI-encoded); the full-URI "?k=v" form is tolerated
     * too. supplierId WINS over id when both are present.
     */
    private fun parseSupplierId(query: String): String {
        // t269-fix3: the hand-off is a BARE "k=v&k2=v2" string (no leading
        // '?') — substringAfter('?') discarded it wholesale and every deep
        // link landed on the no-supplier state. Strip an optional leading
        // '?' and parse the bare form.
        val raw = query.removePrefix("?").trim()
        if (raw.isBlank()) return ""
        var supplierId = ""
        var id = ""
        for (pair in raw.split('&')) {
            if (!pair.contains('=')) continue
            val key = Uri.decode(pair.substringBefore('=')).trim().lowercase()
            val value = Uri.decode(pair.substringAfter('=', "")).trim()
            if (value.isBlank()) continue
            when (key) {
                "supplierid" -> if (supplierId.isBlank()) supplierId = value
                "id" -> if (id.isBlank()) id = value
            }
        }
        return if (supplierId.isNotBlank()) supplierId else id
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
        /** Web parity — the SPA's SupplierProductsPage PAGE_SIZE. */
        const val PAGE_SIZE = 12
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedSupplierListingPage(
    val profile: SupplierCorePublicSupplier? = null,
    val products: List<SupplierCoreListingProduct> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

/**
 * On-device saved supplier listing — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the SUPPLIER-KEYED owner-fixed key
 * "native_supplier_core_supplier-listing_<supplierId>_cache" so supplier A's
 * cached page never renders on supplier B's page.
 */
private object SupplierListingCacheStore {
    private const val TAG = "ZylodSupplierCore"
    private const val PREFS = "zylod_config"
    private const val KEY_PREFIX = "native_supplier_core_supplier-listing_"
    private const val KEY_SUFFIX = "_cache"

    private fun key(supplierId: String) = "$KEY_PREFIX$supplierId$KEY_SUFFIX"

    fun read(context: Context, supplierId: String): CachedSupplierListingPage? {
        if (supplierId.isBlank()) return null
        return runCatching {
            val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(key(supplierId), null) ?: return null
            ApiClient.json.decodeFromString(CachedSupplierListingPage.serializer(), raw)
        }.onFailure { Log.w(TAG, "supplier listing cache read failed: ${it.message}") }.getOrNull()
    }

    fun write(context: Context, supplierId: String, page: CachedSupplierListingPage) {
        if (supplierId.isBlank()) return
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedSupplierListingPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key(supplierId), raw)
                .apply()
            // t279 — one key per supplier storefront visited; keep the newest 12.
            com.zylod.wholesale.util.CacheTrim.trim(context, "native_supplier_core_supplier-listing_")
        }.onFailure { Log.w(TAG, "supplier listing cache write failed: ${it.message}") }
    }
}
