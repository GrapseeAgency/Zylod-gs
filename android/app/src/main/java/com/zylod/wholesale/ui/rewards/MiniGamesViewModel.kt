package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CheckinStatusDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SpinHistoryEnvelope
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.finance.FinanceCacheStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Mini-games hub VM — composes the TWO real game GETs this batch owns for
 * the native mini-games pageId: GET api/rewards/checkin (the check-in
 * game's live state) and GET api/rewards/spin-history (the wheel's live
 * state + ledger). The web's trivia/memory/box games live on
 * /api/mini-games — a surface this batch does not re-host — so the hub
 * renders exactly the two server-backed games and their real playable
 * state, with NO invented games.
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate (the web's
 *    own AccountGate copy); a 401 on either fetch (after the shared OkHttp
 *    authenticator's one refresh) → needsAuth.
 *  - OFFLINE: the two saved snapshots ("native_checkin_cache" +
 *    "native_spin_history_cache") render with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 */
data class MiniGamesUiState(
    /** Resolving / fetching both feeds (skeleton while both absent). */
    val loading: Boolean = true,
    /** Live check-in state (streak + today's claim). */
    val checkin: CheckinStatusDto? = null,
    /** Live spin state (counters + recent wins). */
    val spin: SpinHistoryEnvelope? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible feeds came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class MiniGamesViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(MiniGamesUiState())
    val state: StateFlow<MiniGamesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var hubJob: Job? = null

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
        if (hubJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = MiniGamesUiState(loading = false, needsAuth = true)
            return
        }
        hubJob?.cancel()
        _state.update {
            it.copy(
                loading = it.checkin == null && it.spin == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        hubJob = viewModelScope.launch { fetchHub() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /* ── fetch / degrade ── */

    private suspend fun fetchHub() {
        try {
            Log.i(TAG, "fetch mini-games hub (checkin + spin)")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.rewardsApi(base)
            val checkinDeferred = async { runCatching { api.checkinStatus() }.getOrNull() }
            val spinDeferred = async { runCatching { api.spinHistory() }.getOrNull() }
            val checkinResponse = checkinDeferred.await()
            val spinResponse = spinDeferred.await()

            if (checkinResponse?.code() == 401 && spinResponse?.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }

            var failure: String? = null
            val checkinPayload = checkinResponse?.body()
            val checkin = if (checkinResponse != null && checkinResponse.isSuccessful && checkinPayload?.success == true) {
                checkinPayload.data
            } else {
                if (checkinResponse != null && !checkinResponse.isSuccessful) {
                    failure = failure ?: parseErrorBody(checkinResponse.errorBody()).error?.takeIf(String::isNotBlank)
                }
                null
            }
            val spinPayload = spinResponse?.body()
            val spin = if (spinResponse != null && spinResponse.isSuccessful && spinPayload?.success == true) {
                spinPayload
            } else {
                if (spinResponse != null && !spinResponse.isSuccessful) {
                    failure = failure ?: parseErrorBody(spinResponse.errorBody()).error?.takeIf(String::isNotBlank)
                }
                null
            }

            if (checkin == null && spin == null) {
                Log.w(TAG, "mini-games hub error: $failure")
                degrade(
                    failure?.takeIf(String::isNotBlank)
                        ?: "Could not load the games hub (HTTP ${checkinResponse?.code() ?: spinResponse?.code() ?: 0}).",
                )
                return
            }

            Log.i(
                TAG,
                "mini-games hub loaded checkin=${checkin != null} spinRows=${spin?.data?.size ?: 0}",
            )
            _state.value = _state.value.copy(
                loading = false,
                checkin = checkin,
                spin = spin,
                error = null,
            )
            checkin?.let { persistCheckin(it) }
            spin?.let { persistSpin(it) }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "mini-games hub fetch failed: ${e.message}")
            degrade("Network error while loading the games hub. Check your connection and retry.")
        }
    }

    /** Failure path: the two saved caches; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cachedCheckin = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.CHECKIN, CachedCheckinStatus.serializer())
        }
        val cachedSpin = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.SPIN_HISTORY, CachedSpinHistory.serializer())
        }
        if (cachedCheckin?.status != null || cachedSpin?.envelope != null) {
            Log.i(TAG, "degrade → cached games-hub snapshots")
            _state.value = _state.value.copy(
                loading = false,
                checkin = cachedCheckin?.status,
                spin = cachedSpin?.envelope,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist both wire DTOs — the offline render matches the live one. */
    private fun persistCheckin(status: CheckinStatusDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.CHECKIN,
                CachedCheckinStatus.serializer(),
                CachedCheckinStatus(status = status),
            )
        }
    }

    private fun persistSpin(envelope: SpinHistoryEnvelope) {
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
        const val TAG = "ZylodMiniGames"
    }
}
