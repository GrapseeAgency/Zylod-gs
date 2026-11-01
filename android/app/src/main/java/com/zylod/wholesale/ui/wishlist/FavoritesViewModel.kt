package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CategoryFollowBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
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

/**
 * Favorites VM — the pageId-keyed payload of record for buyer-favorites,
 * favorite-suppliers, favorite-products and favorite-categories:
 *
 *  - buyer-favorites + favorite-suppliers → GET api/buyer/favorite-suppliers
 *    (the ONLY fetch both web ids make; chunk-misc.ts:121 maps
 *    buyer-favorites onto the SAME favorite-suppliers-page component).
 *  - favorite-products → GET api/favorites (the ranked wishlist read the
 *    web page maps into its own card shape).
 *  - favorite-categories → GET api/buyer/followed-categories.
 *
 *  - SORT is CLIENT-SIDE on every variant (the web sorts its in-memory
 *    arrays; the routes take no sort param) — chip taps never re-fetch.
 *  - ACTIONS mirror the web's optimistic handlers 1:1: the row leaves the
 *    list at once and the verbatim toast text renders inline; a failed
 *    call restores the real list (re-fetch, exactly what the web does).
 *    Product removal goes through the t233 DELETE api/wishlist?productId=
 *    route (the web's own comment: "Favorites == wishlist at the data
 *    layer").
 *  - AUTH: no token → the sign-in gate without a call (the supplier page's
 *    AccountGate and the 401 branches of the other two); 401/403 on the
 *    GET → the same gate (the web treats both as its sign-in state).
 *  - OFFLINE: last good rows survive in-memory, then the per-variant disk
 *    cache (WishlistCacheKeys), with the honest banner — never a placeholder row.
 */
class FavoritesViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(FavoritesUiState(variant = favoritesVariantFor(pageId)))
    val state: StateFlow<FavoritesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchInFlight = false
    private var restoreJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (ComplaintsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, needsAuth = true)
            return
        }
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.isEmptyForVariant,
            error = null,
            needsAuth = false,
            offline = false,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as ComplaintsViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    /** Supplier sort chip tap — client-side re-sort only (web parity). */
    fun setSupplierSort(sort: String) =
        _state.update { it.copy(supplierSort = sort) }

    /** Product sort chip tap — client-side re-sort only (web parity). */
    fun setProductSort(sort: String) =
        _state.update { it.copy(productSort = sort) }

    /* ─── suppliers variant (buyer-favorites / favorite-suppliers) ────────── */

    /**
     * Unfollows a supplier (DELETE api/suppliers/{id}/favorite) with the
     * web's exact optimistic flow: remove the row first, toast
     * 'Removed from favorite suppliers' on 200, and on ANY failure show
     * 'Could not remove — please try again' and RE-FETCH the real list
     * (the web restores by re-reading the endpoint, not by re-inserting).
     */
    fun unfollowSupplier(rowId: String) {
        val s = _state.value
        if (s.removingSupplierId != null) return
        val target = s.supplierRows.firstOrNull { it.stableKey == rowId } ?: return
        val supplierId = target.effectiveSupplierId ?: return
        _state.update {
            it.copy(
                removingSupplierId = rowId,
                supplierRows = it.supplierRows.filterNot { r -> r.stableKey == rowId },
                actionMessage = null,
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "unfollow supplier …${supplierId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supplierFollowApi(base).unfollowSupplier(supplierId)
                if (response.isSuccessful && response.body()?.success == true) {
                    Log.i(TAG, "supplier unfollowed")
                    _state.update {
                        it.copy(removingSupplierId = null, actionMessage = "Removed from favorite suppliers")
                    }
                    persistCache()
                } else {
                    Log.w(TAG, "unfollow failed http=${response.code()}")
                    restoreSuppliers("Could not remove — please try again")
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "unfollow failed: ${e.message}")
                restoreSuppliers("Could not remove — please try again")
            }
        }
    }

    /* ─── products variant (favorite-products) ────────────────────────────── */

    /**
     * Removes a favorite (DELETE api/wishlist?productId= — the route the
     * web's own handler names: "Favorites == wishlist at the data layer")
     * with the web's verbatim results: optimistic row removal, then
     * 'Removed from favorites' / 'Could not remove from favorites' /
     * 'Network error' exactly as the component toasts them.
     */
    fun removeFavoriteProduct(rowId: String) {
        val s = _state.value
        if (s.removingProductId != null) return
        val target = s.productRows.firstOrNull { it.stableKey == rowId } ?: return
        val productId = target.effectiveProductId ?: return
        _state.update {
            it.copy(
                removingProductId = rowId,
                productRows = it.productRows.filterNot { r -> r.stableKey == rowId },
                actionMessage = null,
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "remove favorite product …${productId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistApi(base).remove(productId)
                when {
                    response.isSuccessful -> {
                        Log.i(TAG, "favorite removed")
                        _state.update {
                            it.copy(removingProductId = null, actionMessage = "Removed from favorites")
                        }
                        persistCache()
                    }
                    else -> {
                        Log.w(TAG, "remove failed http=${response.code()}")
                        _state.update {
                            it.copy(
                                removingProductId = null,
                                actionError = "Could not remove from favorites",
                            )
                        }
                        restoreProducts()
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "remove failed: ${e.message}")
                _state.update {
                    it.copy(removingProductId = null, actionError = "Network error")
                }
                restoreProducts()
            }
        }
    }

    /* ─── categories variant (favorite-categories) ────────────────────────── */

    /**
     * The bell toggle (POST api/categories/{id}/favorite { notifyOnNew }):
     * optimistic flip first, verbatim toasts ('Notifications on for this
     * category' / 'Notifications off'), revert on ANY failure with the
     * web's own 'Could not update — please try again'.
     */
    fun toggleBell(rowId: String) {
        val s = _state.value
        if (s.pendingBells.isNotEmpty()) return
        val target = s.categoryRows.firstOrNull { it.stableKey == rowId } ?: return
        val categoryId = target.effectiveCategoryId ?: return
        val current = s.pendingBells[rowId] ?: target.notifyOnNew
        val next = !current
        _state.update {
            it.copy(
                pendingBells = it.pendingBells + (rowId to next),
                actionMessage = null,
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "category bell …${categoryId.takeLast(8)} notifyOnNew=$next")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.categoryFollowApi(base)
                    .followCategory(categoryId, CategoryFollowBody(notifyOnNew = next))
                if (response.isSuccessful && response.body()?.success == true) {
                    Log.i(TAG, "bell updated notifyOnNew=$next")
                    _state.update { current2 ->
                        current2.copy(
                            pendingBells = current2.pendingBells - rowId,
                            categoryRows = current2.categoryRows.map { r ->
                                if (r.stableKey == rowId) r.copy(notifyOnNew = next) else r
                            },
                            actionMessage = if (next) {
                                "Notifications on for this category"
                            } else {
                                "Notifications off"
                            },
                        )
                    }
                    persistCache()
                } else {
                    Log.w(TAG, "bell failed http=${response.code()}")
                    _state.update {
                        it.copy(
                            pendingBells = it.pendingBells - rowId,
                            actionError = "Could not update — please try again",
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "bell failed: ${e.message}")
                _state.update {
                    it.copy(
                        pendingBells = it.pendingBells - rowId,
                        actionError = "Could not update — please try again",
                    )
                }
            }
        }
    }

    /**
     * Unfollows a category (DELETE api/categories/{id}/favorite) with the
     * web's exact optimistic flow: remove first, 'Unfollowed category' on
     * 200, and on failure 'Could not unfollow — please try again' + a
     * re-fetch restore (the web's own recovery path).
     */
    fun unfollowCategory(rowId: String) {
        val s = _state.value
        if (s.removingCategoryId != null) return
        val target = s.categoryRows.firstOrNull { it.stableKey == rowId } ?: return
        val categoryId = target.effectiveCategoryId ?: return
        _state.update {
            it.copy(
                removingCategoryId = rowId,
                categoryRows = it.categoryRows.filterNot { r -> r.stableKey == rowId },
                actionMessage = null,
                actionError = null,
            )
        }
        viewModelScope.launch {
            try {
                Log.i(TAG, "unfollow category …${categoryId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.categoryFollowApi(base).unfollowCategory(categoryId)
                if (response.isSuccessful && response.body()?.success == true) {
                    Log.i(TAG, "category unfollowed")
                    _state.update {
                        it.copy(removingCategoryId = null, actionMessage = "Unfollowed category")
                    }
                    persistCache()
                } else {
                    Log.w(TAG, "unfollow failed http=${response.code()}")
                    restoreCategories("Could not unfollow — please try again")
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "unfollow failed: ${e.message}")
                restoreCategories("Could not unfollow — please try again")
            }
        }
    }

    /** Inline notes are consumed on dismiss (ComplaintsViewModel convention). */
    fun consumeActionMessage() = _state.update { it.copy(actionMessage = null) }

    fun consumeActionError() = _state.update { it.copy(actionError = null) }

    /* ─── fetch / failure / cache ─────────────────────────────────────────── */

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            val variant = _state.value.variant
            Log.i(TAG, "fetch favorites variant=$variant pageId=$pageId")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            when (variant) {
                FavoritesVariant.SUPPLIERS ->
                    consumeList(ApiClient.supplierFollowApi(base).favoriteSuppliers()) { rows ->
                        _state.value.copy(supplierRows = rows)
                    }
                FavoritesVariant.PRODUCTS ->
                    consumeList(ApiClient.favoritesApi(base).favorites()) { rows ->
                        _state.value.copy(productRows = rows)
                    }
                FavoritesVariant.CATEGORIES ->
                    consumeList(ApiClient.categoryFollowApi(base).followedCategories()) { rows ->
                        _state.value.copy(categoryRows = rows)
                    }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "favorites fetch failed: ${e.message}")
            degrade("Network error while loading your favorites. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /**
     * Shared envelope handling for the three typed feeds: 401/403 → the web
     * sign-in gate, parse failure → degrade, success → swap the rows in via
     * [reduce] and persist the variant cache.
     */
    private suspend fun <T> consumeList(
        response: retrofit2.Response<com.zylod.wholesale.data.api.ApiEnvelope<List<T>>>,
        reduce: (List<T>) -> FavoritesUiState,
    ) {
        if (response.code() == 401 || response.code() == 403) {
            // The web treats both as its sign-in gate on all three feeds.
            Log.w(TAG, "favorites ${response.code()} — session gate")
            _state.value = _state.value.copy(loading = false, needsAuth = true)
            return
        }
        val rows = response.body()?.data
        if (!response.isSuccessful || response.body()?.success != true || rows == null) {
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Failed to load your favorites (HTTP ${response.code()})"
            Log.w(TAG, "favorites error: $message")
            degrade(message)
            return
        }
        Log.i(TAG, "favorites loaded rows=${rows.size}")
        _state.value = reduce(rows).copy(
            loading = false,
            error = null,
            refreshError = null,
            offline = false,
        )
        persistCache()
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the variant's saved cache; with neither, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.isNotEmptyForVariant) {
            _state.value = s.copy(loading = false, offline = true, refreshError = message)
            return
        }
        val restored = withContext(Dispatchers.IO) { readVariantCache() }
        if (restored) {
            Log.i(TAG, "degrade → variant cache rows")
            _state.value = _state.value.copy(loading = false, offline = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private val FavoritesUiState.isEmptyForVariant: Boolean
        get() = when (variant) {
            FavoritesVariant.SUPPLIERS -> supplierRows.isEmpty()
            FavoritesVariant.PRODUCTS -> productRows.isEmpty()
            FavoritesVariant.CATEGORIES -> categoryRows.isEmpty()
        }

    private val FavoritesUiState.isNotEmptyForVariant: Boolean
        get() = !isEmptyForVariant

    private suspend fun readVariantCache(): Boolean {
        val context = appContext
        return when (_state.value.variant) {
            FavoritesVariant.SUPPLIERS -> {
                val cached = WishlistCacheStore.read(context, WishlistCacheKeys.SUPPLIER_FOLLOWS, CachedSupplierFollows.serializer())
                val rows = cached?.rows.orEmpty()
                _state.value = _state.value.copy(supplierRows = rows)
                rows.isNotEmpty()
            }
            FavoritesVariant.PRODUCTS -> {
                val cached = WishlistCacheStore.read(context, WishlistCacheKeys.FAVORITES, CachedFavoriteRows.serializer())
                val rows = cached?.rows.orEmpty()
                _state.value = _state.value.copy(productRows = rows)
                rows.isNotEmpty()
            }
            FavoritesVariant.CATEGORIES -> {
                val cached = WishlistCacheStore.read(context, WishlistCacheKeys.CATEGORY_FOLLOWS, CachedCategoryFollows.serializer())
                val rows = cached?.rows.orEmpty()
                _state.value = _state.value.copy(categoryRows = rows)
                rows.isNotEmpty()
            }
        }
    }

    /** Persist the current variant's rows under its own cache key. */
    private fun persistCache() {
        val snapshot = _state.value
        viewModelScope.launch(Dispatchers.IO) {
            when (snapshot.variant) {
                FavoritesVariant.SUPPLIERS -> WishlistCacheStore.write(
                    appContext,
                    WishlistCacheKeys.SUPPLIER_FOLLOWS,
                    CachedSupplierFollows.serializer(),
                    CachedSupplierFollows(rows = snapshot.supplierRows),
                )
                FavoritesVariant.PRODUCTS -> WishlistCacheStore.write(
                    appContext,
                    WishlistCacheKeys.FAVORITES,
                    CachedFavoriteRows.serializer(),
                    CachedFavoriteRows(rows = snapshot.productRows),
                )
                FavoritesVariant.CATEGORIES -> WishlistCacheStore.write(
                    appContext,
                    WishlistCacheKeys.CATEGORY_FOLLOWS,
                    CachedCategoryFollows.serializer(),
                    CachedCategoryFollows(rows = snapshot.categoryRows),
                )
            }
        }
    }

    /** The web's unfollow recovery: re-fetch and render the REAL list again. */
    private fun restoreSuppliers(errorMessage: String) {
        _state.update { it.copy(removingSupplierId = null, actionError = errorMessage) }
        restoreJob?.cancel()
        restoreJob = viewModelScope.launch { fetch() }
    }

    /** The products variant never restores silently — the web refetches too. */
    private fun restoreProducts() {
        restoreJob?.cancel()
        restoreJob = viewModelScope.launch { fetch() }
    }

    private fun restoreCategories(errorMessage: String) {
        _state.update { it.copy(removingCategoryId = null, actionError = errorMessage) }
        restoreJob?.cancel()
        restoreJob = viewModelScope.launch { fetch() }
    }

    private companion object {
        const val TAG = "ZylodFavorites"
    }
}
