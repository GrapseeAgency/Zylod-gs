package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.RewardsBookDto
import com.zylod.wholesale.data.api.RewardsRedeemBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.finance.FinanceCacheStore
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
 * Rewards-book VM — GET/POST api/rewards (RewardsApi.rewardsBook / .redeem)
 * as the payload of record for the native buyer-rewards + reward-points
 * pageIds (both render the web's loyalty-points component, whose redeem
 * action lives on THIS route's catalog — the loyalty GET has no POST).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth (the route is buyer-gated via requireUserType, so a
 *    non-buyer session 401s here exactly like the web's fetch).
 *  - REDEEM: POST { redeemId } for a catalog option — the route's verbatim
 *    400/409 texts surface (including the REAL balance it spells out);
 *    success renders the route's message + the REAL walletBalanceAfter
 *    inline and re-fetches the book so balance/history move.
 *  - OFFLINE: the last saved book (SharedPreferences "zylod_config",
 *    "native_rewards_cache") renders with the offline banner otherwise
 *    (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (CreditScoreViewModel convention) while sharing the one cache key.
 */
data class RewardsUiState(
    /** Resolving / fetching the book (skeleton while empty). */
    val loading: Boolean = true,
    val book: RewardsBookDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible book came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The catalog option currently redeeming (button spinner + disable). */
    val redeemingId: String? = null,
    /** The verbatim server rejection (400 zod/option/balance, 409 race). */
    val redeemError: String? = null,
    /** Real success: the route's message verbatim ('Redeemed … successfully'). */
    val redeemSuccessMessage: String? = null,
    /** Real success: the option label the server confirmed. */
    val redeemSuccessLabel: String? = null,
    /** Real success: the wallet balance AFTER the credit (server-computed). */
    val redeemWalletBalanceAfter: Double? = null,
) {
    /** Dismiss the inline redemption result card (the user read it). */
    fun consumeRedeemResult(): RewardsUiState = copy(
        redeemSuccessMessage = null,
        redeemSuccessLabel = null,
        redeemWalletBalanceAfter = null,
    )
}

class RewardsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RewardsUiState())
    val state: StateFlow<RewardsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var bookJob: Job? = null
    private var redeemJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (CreditScoreViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (bookJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = RewardsUiState(loading = false, needsAuth = true)
            return
        }
        bookJob?.cancel()
        _state.update {
            it.copy(
                loading = it.book == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        bookJob = viewModelScope.launch { fetchBook() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /** Dismiss the inline redemption result card (the user read it). */
    fun consumeRedeemResult() {
        _state.update { it.consumeRedeemResult() }
    }

    /**
     * POST api/rewards — redeem a catalog option. The client guard is only
     * "an option id from the loaded catalog" (the route's catalog is
     * server-fixed); the server's verbatim 400/409 text surfaces when it
     * fires anyway. On success the book re-fetches so the spent points and
     * the new ledger row appear.
     */
    fun redeem(optionId: String) {
        val trimmed = optionId.trim()
        if (trimmed.isEmpty()) return
        if (redeemJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true, redeemingId = null)
            return
        }
        _state.update { it.copy(redeemingId = trimmed, redeemError = null) }
        redeemJob = viewModelScope.launch {
            try {
                Log.i(TAG, "redeem rewards option $trimmed")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.rewardsApi(base).redeem(RewardsRedeemBody(redeemId = trimmed))
                if (response.code() == 401) {
                    Log.i(TAG, "redeem rejected (http=401) — session ended")
                    _state.update { it.copy(redeemingId = null, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                val data = payload?.data
                if (response.isSuccessful && payload?.success == true && data != null) {
                    Log.i(TAG, "redeemed ${data.redeemed} walletAfter=${data.walletBalanceAfter}")
                    _state.update {
                        it.copy(
                            redeemingId = null,
                            redeemSuccessMessage = payload.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Redeemed successfully.",
                            redeemSuccessLabel = data.redeemed,
                            redeemWalletBalanceAfter = data.walletBalanceAfter,
                        )
                    }
                    refreshBookAfterRedeem()
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Redemption failed (HTTP ${response.code()})."
                Log.w(TAG, "redeem failed: $message")
                _state.update { it.copy(redeemingId = null, redeemError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "redeem failed: ${e.message}")
                _state.update {
                    it.copy(
                        redeemingId = null,
                        redeemError = "Network error — the redemption did NOT go through. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    /** Post-redeem book refresh (independent of the entry guard). */
    private fun refreshBookAfterRedeem() {
        if (bookJob?.isActive == true) return
        bookJob = viewModelScope.launch { fetchBook() }
    }

    private suspend fun fetchBook() {
        try {
            Log.i(TAG, "fetch rewards book")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).rewardsBook()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val book = payload?.data
            if (!response.isSuccessful || payload?.success != true || book == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your rewards (HTTP ${response.code()})."
                Log.w(TAG, "rewards book error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "rewards book loaded balance=${book.balance} tier=${book.tier} history=${book.history.size}")
            _state.value = _state.value.copy(
                loading = false,
                book = book,
                error = null,
            )
            persistCache(book)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "rewards book fetch failed: ${e.message}")
            degrade("Network error while loading your rewards. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved book cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.REWARDS_BOOK, CachedRewardsBook.serializer())
        }
        val book = cached?.book
        if (book != null) {
            Log.i(TAG, "degrade → cached rewards book")
            _state.value = _state.value.copy(loading = false, book = book, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(book: RewardsBookDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.REWARDS_BOOK,
                CachedRewardsBook.serializer(),
                CachedRewardsBook(book = book),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodRewards"
    }
}
