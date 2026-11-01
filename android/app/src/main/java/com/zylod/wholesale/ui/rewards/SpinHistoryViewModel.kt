package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SpinHistoryEnvelope
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
 * Spin-history VM — GET api/rewards/spin-history (RewardsApi.spinHistory)
 * as the payload of record for the native spin-history + game-history
 * pageIds. The route serves ONE ledger (the spinWinResults rows plus the
 * top-level spinsToday / spinsRemaining counters), so both pageIds render
 * exactly what it returns and label it honestly (the web's game-history
 * page reads /api/mini-games — a feed this batch does not re-host; the
 * native game-history page shows the spin ledger the server actually
 * keeps for the account and says so in its section header).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate; a 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth ('Authentication required' is the route's own guest body).
 *  - OFFLINE: the last saved envelope (SharedPreferences "zylod_config",
 *    "native_spin_history_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention) — the same cache
 *    the spin screen reads, one endpoint, one cache.
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class SpinHistoryUiState(
    /** Resolving / fetching the history (skeleton while empty). */
    val loading: Boolean = true,
    val envelope: SpinHistoryEnvelope? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible rows came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class SpinHistoryViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SpinHistoryUiState())
    val state: StateFlow<SpinHistoryUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var historyJob: Job? = null

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
        if (historyJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = SpinHistoryUiState(loading = false, needsAuth = true)
            return
        }
        historyJob?.cancel()
        _state.update {
            it.copy(
                loading = it.envelope == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        historyJob = viewModelScope.launch { fetchHistory() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /* ── fetch / degrade ── */

    private suspend fun fetchHistory() {
        try {
            Log.i(TAG, "fetch spin history")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).spinHistory()
            if (gateOn401(response.code())) return
            val payload = response.body()
            if (!response.isSuccessful || payload?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your spin history (HTTP ${response.code()})."
                Log.w(TAG, "spin history error: $message")
                degrade(message)
                return
            }
            Log.i(
                TAG,
                "spin history loaded rows=${payload.data.size} today=${payload.spinsToday} remaining=${payload.spinsRemaining}",
            )
            _state.value = _state.value.copy(
                loading = false,
                envelope = payload,
                error = null,
            )
            persistCache(payload)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "spin history fetch failed: ${e.message}")
            degrade("Network error while loading your spin history. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved history cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.SPIN_HISTORY, CachedSpinHistory.serializer())
        }
        val envelope = cached?.envelope
        if (envelope != null) {
            Log.i(TAG, "degrade → cached spin history")
            _state.value = _state.value.copy(loading = false, envelope = envelope, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(envelope: SpinHistoryEnvelope) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.SPIN_HISTORY,
                CachedSpinHistory.serializer(),
                CachedSpinHistory(envelope = envelope),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodSpinHistory"
    }
}
