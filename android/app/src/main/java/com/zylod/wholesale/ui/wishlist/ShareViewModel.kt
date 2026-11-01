package com.zylod.wholesale.ui.wishlist

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WishlistShareCreateBody
import com.zylod.wholesale.data.api.WishlistShareDto
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Share-management VM (pageIds wishlist-share + wishlist-share-page — BOTH
 * load the same wishlist-share-page.tsx component) and the PUBLIC shared
 * viewer VM (pageIds wishlist-shared + shared-wishlist +
 * shared-wishlist-detail). Wire contracts (WishlistShareApi /
 * SharedWishlistApi):
 *
 *  - GET api/wishlist/share — the buyer's latest share row; data null =
 *    never shared (the web's "You haven't shared your wishlist yet."
 *    state). 401/403 → the web's session-expired AccountGate.
 *  - POST api/wishlist/share — create/rotate with { allowAddToCart,
 *    showPrices }; 200 { success, data: share, message: 'Share link
 *    created' }. The server mints a NEW 32-hex token each call (the web's
 *    refresh button) and upserts the settings.
 *  - DELETE api/wishlist/share — revoke; 200 message 'Share link revoked'.
 *  - GET api/wishlist/shared?token= — PUBLIC (no auth on the route): the
 *    native viewer NEVER gates on the session — signed-out works exactly
 *    like the web's header-less fetch. 400 'Token required'; 404 'Share
 *    link not found or expired' (unknown OR expired token).
 *
 * OFFLINE: the share row / shared payload survive via their per-key disk
 * caches (WishlistCacheKeys.WISHLIST_SHARE / sharedWishlist(token)); the
 * public viewer never fabricates a payload for an unknown token.
 */
class ShareViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ShareUiState())
    val state: StateFlow<ShareUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchInFlight = false

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
            loading = _state.value.share == null,
            error = null,
            needsAuth = false,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as ComplaintsViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    /** Settings toggle (screen-local until "Save Changes" re-posts them). */
    fun setAllowAddToCart(value: Boolean) =
        _state.update { it.copy(allowAddToCart = value) }

    fun setShowPrices(value: Boolean) =
        _state.update { it.copy(showPrices = value) }

    fun consumeActionMessage() = _state.update { it.copy(actionMessage = null) }

    fun consumeActionError() = _state.update { it.copy(actionError = null) }

    /**
     * Create/rotate the share link (POST api/wishlist/share) with the two
     * settings — the web's Generate Share Link / refresh / Save Changes all
     * issue this same call. The 200 data (token + counters) IS the new
     * state; the verbatim message renders inline.
     */
    fun createShare() {
        val s = _state.value
        if (s.creating) return
        if (SessionManager.token() == null) {
            _state.update { it.copy(needsAuth = true, actionError = "Sign in to manage wishlist sharing.") }
            return
        }
        _state.update { it.copy(creating = true, actionError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "create share link")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistShareApi(base)
                    .createShare(WishlistShareCreateBody(allowAddToCart = s.allowAddToCart, showPrices = s.showPrices))
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "create rejected (http=${response.code()})")
                    _state.update { it.copy(creating = false, needsAuth = true) }
                    return@launch
                }
                val share = response.body()?.takeIf { response.isSuccessful && it.success }?.data
                if (share == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not save the share link (HTTP ${response.code()})."
                    Log.w(TAG, "create failed: $message")
                    _state.update { it.copy(creating = false, actionError = message) }
                    return@launch
                }
                Log.i(TAG, "share link live token=${share.token?.takeLast(6)}")
                _state.update { current ->
                    current.copy(
                        creating = false,
                        share = share,
                        allowAddToCart = share.allowAddToCart,
                        showPrices = share.showPrices,
                        actionMessage = response.body()?.message?.takeIf(String::isNotBlank)
                            ?: "Share link created",
                    )
                }
                persistShare(share)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "create failed: ${e.message}")
                _state.update {
                    it.copy(creating = false, actionError = "Network error while saving the share link. Check your connection and retry.")
                }
            }
        }
    }

    /**
     * Revokes the link (DELETE api/wishlist/share) — the web asks for a
     * confirm first (the screen owns that dialog); the verbatim 200
     * message renders inline and the status flips to Not Shared.
     */
    fun revokeShare() {
        val s = _state.value
        if (s.creating) return
        if (SessionManager.token() == null) {
            _state.update { it.copy(needsAuth = true, actionError = "Sign in to manage wishlist sharing.") }
            return
        }
        _state.update { it.copy(creating = true, actionError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "revoke share link")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.wishlistShareApi(base).revokeShare()
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "revoke rejected (http=${response.code()})")
                    _state.update { it.copy(creating = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not revoke the share link (HTTP ${response.code()})."
                    Log.w(TAG, "revoke failed: $message")
                    _state.update { it.copy(creating = false, actionError = message) }
                    return@launch
                }
                Log.i(TAG, "share link revoked")
                _state.update { current ->
                    current.copy(
                        creating = false,
                        share = null,
                        actionMessage = payload.message?.takeIf(String::isNotBlank)
                            ?: "Share link revoked",
                    )
                }
                persistShare(null)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "revoke failed: ${e.message}")
                _state.update {
                    it.copy(creating = false, actionError = "Network error while revoking the share link. Check your connection and retry.")
                }
            }
        }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch share status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.wishlistShareApi(base).share()
            if (response.code() == 401 || response.code() == 403) {
                // Web parity: the session-expired gate.
                Log.w(TAG, "share ${response.code()} — session gate")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            if (!response.isSuccessful || response.body()?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your share status (HTTP ${response.code()})."
                Log.w(TAG, "share error: $message")
                degrade(message)
                return
            }
            val share = response.body()?.data
            Log.i(TAG, "share status loaded active=${share != null}")
            _state.value = _state.value.copy(
                loading = false,
                share = share,
                allowAddToCart = share?.allowAddToCart ?: true,
                showPrices = share?.showPrices ?: true,
                error = null,
            )
            persistShare(share)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "share fetch failed: ${e.message}")
            degrade("Network error while loading your share status. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /** Failure path: in-memory row first, then the saved share-row cache. */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.share != null) {
            _state.value = s.copy(loading = false, error = null, actionError = message)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            WishlistCacheStore.read(appContext, WishlistCacheKeys.WISHLIST_SHARE, CachedWishlistShare.serializer())
        }
        val share = cached?.share
        if (share != null) {
            Log.i(TAG, "degrade → cached share row")
            _state.value = _state.value.copy(
                loading = false,
                share = share,
                allowAddToCart = share.allowAddToCart,
                showPrices = share.showPrices,
                error = null,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistShare(share: WishlistShareDto?) {
        viewModelScope.launch(Dispatchers.IO) {
            WishlistCacheStore.write(
                appContext,
                WishlistCacheKeys.WISHLIST_SHARE,
                CachedWishlistShare.serializer(),
                CachedWishlistShare(share = share),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodWishlistShare"
    }
}

/**
 * PUBLIC shared-wishlist viewer VM (pageIds wishlist-shared + shared-wishlist
 * + shared-wishlist-detail). Two branches mirror shared-wishlist-page.tsx:
 *
 *  - owner mode (entry query mode=owner): GET api/wishlist/share (the SAME
 *    authed route the share-management page reads) to show the buyer's own
 *    link box; signed-out owners get the web's AccountGate verdict.
 *  - token mode (token= / shareToken= / a bare token in the query): GET
 *    api/wishlist/shared?token= — PUBLIC, works signed-out (the route has
 *    no authenticateRequest call; the web sends no Authorization header at
 *    all). 404 'Share link not found or expired' and 400 'Token required'
 *    surface verbatim inside the viewer's error state.
 *  - NO token and NOT owner mode: the web renders its header + empty grid +
 *    Shop-on-Zylod footer (the link-less truth of the pageId) — mirrored.
 */
class SharedWishlistViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SharedWishlistUiState())
    val state: StateFlow<SharedWishlistUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchInFlight = false

    /** Entry resolve on EVERY entry (ReturnRequestViewModel.load convention). */
    fun load(query: String?) {
        val ownerMode = sharedWishlistOwnerMode(query)
        val token = shareTokenFromQuery(query).orEmpty()
        _state.value = SharedWishlistUiState(
            loading = true,
            hasToken = token.isNotBlank(),
            ownerMode = ownerMode,
            token = token,
        )
        if (fetchInFlight) return
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            val s = _state.value
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            if (s.ownerMode) {
                if (SessionManager.token() == null) {
                    // The web's owner branch gates: "Sign in to share your wishlist".
                    Log.i(TAG, "owner mode signed out — gate")
                    _state.value = _state.value.copy(loading = false, needsAuth = true, error = null)
                    return
                }
                val response = ApiClient.wishlistShareApi(base).share()
                if (response.code() == 401 || response.code() == 403) {
                    _state.value = _state.value.copy(loading = false)
                    return
                }
                if (!response.isSuccessful || response.body()?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load your wishlist sharing settings. Please try again later."
                    Log.w(TAG, "owner share error: $message")
                    _state.value = _state.value.copy(loading = false, error = message)
                    return
                }
                Log.i(TAG, "owner share loaded")
                _state.value = _state.value.copy(loading = false, ownerShare = response.body()?.data, error = null)
                return
            }
            if (!s.hasToken) {
                // The web's link-less truth: header + empty grid, no error.
                Log.i(TAG, "no token — link-less viewer state")
                _state.value = _state.value.copy(loading = false)
                return
            }
            val response = ApiClient.sharedWishlistApi(base).shared(s.token)
            if (response.code() == 400 || response.code() == 404) {
                // Verbatim route texts ('Token required' / 'Share link not
                // found or expired') — no invented expiry wording.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "This shared wishlist link is invalid or has expired."
                Log.w(TAG, "shared ${response.code()}: $message")
                _state.value = _state.value.copy(loading = false, payload = null, error = message)
                return
            }
            val payload = response.body()?.takeIf { response.isSuccessful && it.success }?.data
            if (payload == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "This shared wishlist link is invalid or has expired."
                Log.w(TAG, "shared error: $message")
                _state.value = _state.value.copy(loading = false, payload = null, error = message)
                return
            }
            Log.i(TAG, "shared payload rows=${payload.items.size}")
            _state.value = _state.value.copy(loading = false, payload = payload, error = null)
            persistCache(payload)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "shared fetch failed: ${e.message}")
            degrade("Something went wrong while loading this wishlist. Please try again later.")
        } finally {
            fetchInFlight = false
        }
    }

    /** Failure path: in-memory payload first, then the per-token disk cache. */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.payload != null) {
            _state.value = s.copy(loading = false, error = null)
            return
        }
        if (!s.hasToken) {
            _state.value = _state.value.copy(loading = false)
            return
        }
        val cached = withContext(Dispatchers.IO) {
            WishlistCacheStore.read(
                appContext,
                WishlistCacheKeys.sharedWishlist(s.token),
                CachedSharedWishlist.serializer(),
            )
        }
        val payload = cached?.takeIf { it.token == s.token }?.payload
        if (payload != null) {
            Log.i(TAG, "degrade → cached shared payload")
            _state.value = _state.value.copy(loading = false, payload = payload, error = null)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistCache(payload: com.zylod.wholesale.data.api.SharedWishlistPayload) {
        viewModelScope.launch(Dispatchers.IO) {
            WishlistCacheStore.write(
                appContext,
                WishlistCacheKeys.sharedWishlist(_state.value.token),
                CachedSharedWishlist.serializer(),
                CachedSharedWishlist(token = _state.value.token, payload = payload),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodSharedWishlist"
    }
}
