package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SpinHistoryEnvelope
import com.zylod.wholesale.data.api.SpinPrizeDto
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
 * Lucky-wheel VM — POST api/rewards/spin (RewardsApi.spinSubmit) with the
 * status probe from GET api/rewards/spin-history (RewardsApi.spinHistory —
 * exactly what the web spin-win component calls first for its
 * spinsRemaining counter), for the native spin-wheel + spin-win pageIds.
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate; a 401 on
 *    either call (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth ('Authentication required' is the route's own guest body).
 *  - SPIN: POST with NO body. Success renders the server's REAL prize
 *    verbatim (label from the data.prize payload) and highlights its
 *    segmentIndex row in the static prize table — the native screen runs
 *    NO wheel animation that could pretend a prize before the server
 *    answers. 429 answers the route's verbatim daily-cap text ("Daily
 *    spin limit reached (3/3). Come back tomorrow at 00:00 AM!") or the
 *    shared rate-limit text; the spinsRemaining counter moves with the
 *    server's value (never a local guess).
 *  - OFFLINE: the last saved history envelope (SharedPreferences
 *    "zylod_config", "native_spin_history_cache") renders with the offline
 *    banner otherwise (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class SpinUiState(
    /** Resolving / fetching the spin status (skeleton while empty). */
    val loading: Boolean = true,
    /** The GET spin-history envelope — rows AND the top-level counters. */
    val history: SpinHistoryEnvelope? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible counters came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The POST spin is in flight (button spinner + disable). */
    val spinning: Boolean = false,
    /** The verbatim server rejection (429 daily cap / rate limit). */
    val spinError: String? = null,
    /** Real result: the WON prize, verbatim from the POST data. */
    val wonPrize: SpinPrizeDto? = null,
    /** Real result: the won prize's segmentIndex (table-row highlight). */
    val wonSegmentIndex: Int? = null,
    /** Real result: the spinsRemaining the server answered AFTER the spin. */
    val wonSpinsRemaining: Int? = null,
) {
    /** Dismiss the won-prize banner (the user read it). */
    fun consumeSpinResult(): SpinUiState = copy(
        wonPrize = null,
        wonSegmentIndex = null,
        wonSpinsRemaining = null,
    )
}

class SpinViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SpinUiState())
    val state: StateFlow<SpinUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var historyJob: Job? = null
    private var spinJob: Job? = null

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
            _state.value = SpinUiState(loading = false, needsAuth = true)
            return
        }
        historyJob?.cancel()
        _state.update {
            it.copy(
                loading = it.history == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        historyJob = viewModelScope.launch { fetchHistory() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /** Dismiss the won-prize banner (the user read it). */
    fun consumeSpinResult() {
        _state.update { it.consumeSpinResult() }
    }

    /**
     * POST api/rewards/spin — one free wheel turn. The client guard is only
     * "not already spinning" (the counter gate is the server's 429); the
     * route's verbatim daily-cap / rate-limit text surfaces when it fires.
     * On success the REAL prize renders and the status re-fetches so the
     * counters + ledger move.
     */
    fun spin() {
        if (spinJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true, spinning = false)
            return
        }
        _state.update { it.copy(spinning = true, spinError = null) }
        spinJob = viewModelScope.launch {
            try {
                Log.i(TAG, "submit spin")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.rewardsApi(base).spinSubmit()
                if (response.code() == 401) {
                    Log.i(TAG, "spin rejected (http=401) — session ended")
                    _state.update { it.copy(spinning = false, needsAuth = true) }
                    return@launch
                }
                if (response.isSuccessful) {
                    val payload = response.body()
                    val result = payload?.data
                    if (payload?.success == true && result != null) {
                        Log.i(
                            TAG,
                            "won ${result.prize?.label} segment=${result.segmentIndex} remaining=${result.spinsRemaining}",
                        )
                        _state.update {
                            it.copy(
                                spinning = false,
                                wonPrize = result.prize,
                                wonSegmentIndex = result.segmentIndex,
                                wonSpinsRemaining = result.spinsRemaining,
                            )
                        }
                        refreshHistoryAfterSpin()
                        return@launch
                    }
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Spin failed (HTTP ${response.code()})."
                Log.w(TAG, "spin failed: $message")
                _state.update { it.copy(spinning = false, spinError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "spin failed: ${e.message}")
                _state.update {
                    it.copy(
                        spinning = false,
                        spinError = "Network error — the spin did NOT go through. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    /** Post-spin history refresh (independent of the entry guard). */
    private fun refreshHistoryAfterSpin() {
        if (historyJob?.isActive == true) return
        historyJob = viewModelScope.launch { fetchHistory() }
    }

    private suspend fun fetchHistory() {
        try {
            Log.i(TAG, "fetch spin history for status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).spinHistory()
            if (gateOn401(response.code())) return
            val payload = response.body()
            if (!response.isSuccessful || payload?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your spin status (HTTP ${response.code()})."
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
                history = payload,
                error = null,
            )
            persistCache(payload)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "spin history fetch failed: ${e.message}")
            degrade("Network error while loading your spin status. Check your connection and retry.")
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
            _state.value = _state.value.copy(loading = false, history = envelope, offlineFromCache = true)
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
        const val TAG = "ZylodSpin"
    }
}

/** The spinsRemaining the UI should trust: the POST's answer wins over the GET's. */
internal fun SpinUiState.effectiveSpinsRemaining(): Int? = wonSpinsRemaining ?: history?.spinsRemaining
