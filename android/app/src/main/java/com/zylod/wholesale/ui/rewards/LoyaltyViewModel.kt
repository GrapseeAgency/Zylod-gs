package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.LoyaltyStatusDto
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
 * Loyalty-status VM — GET api/rewards/loyalty (RewardsApi.loyalty) as the
 * payload of record for the native loyalty-points + loyalty-program
 * pageIds (the web renders the same loyalty-points component for both).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth. (The route serves ANY authenticated account — it upserts
 *    150 welcome points on first create — so only guests are gated, the
 *    exact rule the web page applies.)
 *  - OFFLINE: the last saved status (SharedPreferences "zylod_config",
 *    "native_loyalty_cache") renders with the offline banner otherwise
 *    (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class LoyaltyUiState(
    /** Resolving / fetching the status (skeleton while empty). */
    val loading: Boolean = true,
    val loyalty: LoyaltyStatusDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible status came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class LoyaltyViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(LoyaltyUiState())
    val state: StateFlow<LoyaltyUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (RewardsViewModel convention).
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
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = LoyaltyUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.loyalty == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchLoyalty() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchLoyalty() {
        try {
            Log.i(TAG, "fetch loyalty status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).loyalty()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val loyalty = payload?.data
            if (!response.isSuccessful || payload?.success != true || loyalty == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your loyalty points (HTTP ${response.code()})."
                Log.w(TAG, "loyalty status error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "loyalty loaded balance=${loyalty.pointsBalance} tier=${loyalty.tier}")
            _state.value = LoyaltyUiState(loading = false, loyalty = loyalty)
            persistCache(loyalty)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "loyalty fetch failed: ${e.message}")
            degrade("Network error while loading your loyalty points. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved status cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.LOYALTY, CachedLoyaltyStatus.serializer())
        }
        val loyalty = cached?.loyalty
        if (loyalty != null) {
            Log.i(TAG, "degrade → cached loyalty status")
            _state.value = LoyaltyUiState(loading = false, loyalty = loyalty, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(loyalty: LoyaltyStatusDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.LOYALTY,
                CachedLoyaltyStatus.serializer(),
                CachedLoyaltyStatus(loyalty = loyalty),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodRewards"
    }
}
