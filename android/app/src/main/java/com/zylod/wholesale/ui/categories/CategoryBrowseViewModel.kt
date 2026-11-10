package com.zylod.wholesale.ui.categories

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ProductDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistAddRequest
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer

/**
 * t298 — CATEGORY BROWSE parity (the t281 "CATEGORY_IDS unfiltered grids"
 * deferral closed). The web's GenericCategoryPage (generic-category-page.tsx,
 * t283) fetches `/api/products?limit=24&category=<slug>` for EVERY pageId in
 * page-loader.ts's CATEGORY_IDS set — the grid is SCOPED to the banner and
 * unmapped ids render the honest zero-rows state. The native rows rendered
 * curated bullets (endpoint: null) — a buyer opening "Textiles & Fabrics"
 * saw NO products where the web shows the real category grid.
 *
 * ONE VM serves all 20 category pageIds, keyed per pageId
 * (viewModel(key = "category-browse-$pageId")) — the suppliercore
 * pageId-keyed pattern. The slug translation is the web's own
 * CATEGORY_SLUG_MAP (verbatim, see CategoryBrowseScreen.kt); unmapped ids
 * pass the pageId itself as the filter — the API answers zero rows and the
 * screen renders the honest empty state, never an unrelated grid under a
 * category banner.
 *
 * - SORT is client-side over the SAME 24 server rows, exactly like the web
 *   (popular = soldCount desc = the endpoint's own default, price asc/desc,
 *   rating desc). No invented server params.
 * - OFFLINE (DealsViewModel degrade convention): on failure the device-saved
 *   rows render (SharedPreferences "zylod_config"/"native_category_browse_<pageId>",
 *   written after EVERY successful fetch) and the state flips to offline; with
 *   nothing renderable at all the honest error state shows.
 * - HEARTS: one GET api/wishlist?limit=50 marks the initial wished set for
 *   signed-in sessions only (guests skip the call — the 401-by-design
 *   doctrine); toggles are optimistic with rollback + toast (PDP
 *   toggleWishlist convention, ApiClient.wishlistApi add/remove — the SAME
 *   write surface every native heart uses; never redeclared).
 */
data class CategoryBrowseUiState(
    val loading: Boolean = true,
    val products: List<ProductDto> = emptyList(),
    /** productIds currently hearted (server truth for buyers, optimistic on toggle). */
    val wishedIds: Set<String> = emptySet(),
    /** The visible rows are SAVED data (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** One-shot snackbar text (heart failures, guest-wall hint). */
    val toast: String? = null,
)

class CategoryBrowseViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CategoryBrowseUiState())
    val state: StateFlow<CategoryBrowseUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** The web's own translation (generic-category-page.tsx CATEGORY_SLUG_MAP). */
    private val slug: String = categorySlugFor(pageId)

    /** True when the web maps this pageId to a real seeded category slug. */
    val mappedToSeededCategory: Boolean = CATEGORY_SLUG_MAP.containsKey(pageId)

    init {
        refresh()
    }

    /**
     * Entry pull / retry (t208 parity: called on EVERY entry; the t242 guard
     * lesson — only an in-flight refresh WITH data on screen is a no-op).
     */
    fun refresh() {
        val s = _state.value
        if (loadJob?.isActive == true && s.products.isNotEmpty()) return
        loadJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val client = ApiClient.create(base, appContext)
                // The web's exact call: /api/products?limit=24&category=<slug>.
                // Defaults sortBy=soldCount&sortOrder=desc == the web's "popular".
                val envelope = client.products(category = slug, limit = 24, page = 1)
                val rows = envelope.data.orEmpty().filter { it.id.isNotBlank() }
                _state.update {
                    it.copy(loading = false, products = rows, offline = false, error = null)
                }
                if (rows.isNotEmpty()) {
                    withContext(Dispatchers.IO) {
                        CategoryBrowseCacheStore.write(appContext, pageId, rows)
                    }
                }
                // Signed-in sessions get the heart markers; guests skip the
                // call entirely (the wishlist API is buyer-scoped by design).
                if (SessionManager.token() != null) loadWishedIds(base)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "category browse $pageId fetch failed: ${e.message}")
                val cached = CategoryBrowseCacheStore.read(appContext, pageId)
                if (cached != null) {
                    _state.update {
                        it.copy(loading = false, products = cached, offline = true, error = null)
                    }
                } else {
                    _state.update {
                        it.copy(loading = false, error = "Could not load this category — check your connection and try again.")
                    }
                }
            }
        }
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
        const val TAG = "ZylodCategoryBrowse"
    }
}

/**
 * On-device saved category rows — the SAME prefs file the rest of the native
 * shell uses (zylod_config), one key per pageId so twenty categories never
 * overwrite each other. Payload = the last successful /api/products rows for
 * that category, so the offline render is the SAME grid the buyer saw online.
 */
object CategoryBrowseCacheStore {
    private const val TAG = "ZylodCategoryBrowse"
    private const val PREFS = "zylod_config"
    private fun keyFor(pageId: String) = "native_category_browse_$pageId"

    fun read(context: Context, pageId: String): List<ProductDto>? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(keyFor(pageId), null) ?: return null
        ApiClient.json.decodeFromString(ListSerializer(ProductDto.serializer()), raw)
    }.onFailure {
        Log.w(TAG, "category cache read failed: ${it.message}")
    }.getOrNull()

    fun write(context: Context, pageId: String, rows: List<ProductDto>) {
        runCatching {
            val raw = ApiClient.json.encodeToString(ListSerializer(ProductDto.serializer()), rows)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(keyFor(pageId), raw)
                .apply()
        }.onFailure { Log.w(TAG, "category cache write failed: ${it.message}") }
    }
}
