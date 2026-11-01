package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CheckinSubmitEnvelope
import com.zylod.wholesale.data.api.CheckinStatusDto
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
 * Daily check-in VM — GET/POST api/rewards/checkin (RewardsApi.checkinStatus
 * / .checkinSubmit) as the payload of record for the native daily-checkin +
 * checkin-streak pageIds (the web renders the SAME route on both — the
 * claim flow on daily-checkin, the ledger on checkin-streak).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth ('Authentication required' is the route's own guest body).
 *  - CLAIM: POST with NO body — the route reads nothing from the request.
 *    201 success renders the route's message verbatim ("Checked in! +X
 *    points awarded.") and re-fetches the status so the grid + ledger
 *    move; 409 'You have already checked in today! Come back tomorrow.'
 *    (alreadyCheckedIn: true) and the 429 rate-limit text surface verbatim.
 *    The button's disabled state mirrors the GET's checkedInToday truth.
 *  - OFFLINE: the last saved status (SharedPreferences "zylod_config",
 *    "native_checkin_cache") renders with the offline banner otherwise
 *    (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class CheckinUiState(
    /** Resolving / fetching the status (skeleton while empty). */
    val loading: Boolean = true,
    val status: CheckinStatusDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible status came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The POST claim is in flight (button spinner + disable). */
    val checkingIn: Boolean = false,
    /** The verbatim server rejection (409 already-checked-in, 429 limits). */
    val checkinError: String? = null,
    /** Real success: the route's message verbatim ('Checked in! +X …'). */
    val checkinSuccessMessage: String? = null,
    /** Real success: the row's streakCount the server confirmed. */
    val checkinSuccessStreak: Int? = null,
    /** Real success: the row's pointsAwarded the server confirmed. */
    val checkinSuccessPoints: Int? = null,
) {
    /** Dismiss the inline claim-result card (the user read it). */
    fun consumeCheckinResult(): CheckinUiState = copy(
        checkinSuccessMessage = null,
        checkinSuccessStreak = null,
        checkinSuccessPoints = null,
    )
}

class CheckinViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CheckinUiState())
    val state: StateFlow<CheckinUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var statusJob: Job? = null
    private var submitJob: Job? = null

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
        if (statusJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = CheckinUiState(loading = false, needsAuth = true)
            return
        }
        statusJob?.cancel()
        _state.update {
            it.copy(
                loading = it.status == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        statusJob = viewModelScope.launch { fetchStatus() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /** Dismiss the inline claim-result card (the user read it). */
    fun consumeCheckinResult() {
        _state.update { it.consumeCheckinResult() }
    }

    /**
     * POST api/rewards/checkin — claim today's points. The GET truth gates
     * the button; the server's verbatim 409/429 text surfaces when the
     * request fires anyway. On success the status re-fetches so the streak
     * grid and the ledger reflect the new row.
     */
    fun checkin() {
        if (submitJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true, checkingIn = false)
            return
        }
        _state.update { it.copy(checkingIn = true, checkinError = null) }
        submitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "submit daily checkin")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.rewardsApi(base).checkinSubmit()
                if (response.code() == 401) {
                    Log.i(TAG, "checkin rejected (http=401) — session ended")
                    _state.update { it.copy(checkingIn = false, needsAuth = true) }
                    return@launch
                }
                // 201 answers { success, message, data }; 409 answers
                // { error, alreadyCheckedIn } on the ERROR body — both parse
                // into the same typed envelope (errorBody for the 409).
                val payload = if (response.isSuccessful) {
                    response.body()
                } else {
                    response.errorBody()?.parseCheckinEnvelope()
                }
                val data = payload?.data
                if (response.isSuccessful && payload?.success == true && data != null) {
                    Log.i(TAG, "checked in streak=${data.streakCount} points=${data.pointsAwarded}")
                    _state.update {
                        it.copy(
                            checkingIn = false,
                            checkinSuccessMessage = payload.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Checked in! +${data.pointsAwarded ?: 0} points awarded.",
                            checkinSuccessStreak = data.streakCount,
                            checkinSuccessPoints = data.pointsAwarded,
                        )
                    }
                    refreshStatusAfterSubmit()
                    return@launch
                }
                val message = payload?.error
                    ?.takeIf(String::isNotBlank)
                    ?: "Check-in failed (HTTP ${response.code()})."
                Log.w(TAG, "checkin failed: $message")
                _state.update {
                    it.copy(
                        checkingIn = false,
                        checkinError = message,
                        // The 409 body's flag is server truth: mirror it in
                        // the UI state so the button disables immediately.
                        status = if (payload?.alreadyCheckedIn == true) {
                            it.status?.copy(checkedInToday = true)
                        } else {
                            it.status
                        },
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "checkin failed: ${e.message}")
                _state.update {
                    it.copy(
                        checkingIn = false,
                        checkinError = "Network error — the check-in did NOT go through. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    /** Post-claim status refresh (independent of the entry guard). */
    private fun refreshStatusAfterSubmit() {
        if (statusJob?.isActive == true) return
        statusJob = viewModelScope.launch { fetchStatus() }
    }

    private suspend fun fetchStatus() {
        try {
            Log.i(TAG, "fetch checkin status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).checkinStatus()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val status = payload?.data
            if (!response.isSuccessful || payload?.success != true || status == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your check-in status (HTTP ${response.code()})."
                Log.w(TAG, "checkin status error: $message")
                degrade(message)
                return
            }
            Log.i(
                TAG,
                "checkin status loaded streak=${status.currentStreak} claimed=${status.checkedInToday} ledger=${status.history.size}",
            )
            _state.value = _state.value.copy(
                loading = false,
                status = status,
                error = null,
            )
            persistCache(status)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "checkin status fetch failed: ${e.message}")
            degrade("Network error while loading your check-in status. Check your connection and retry.")
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
            FinanceCacheStore.read(appContext, RewardsCacheKeys.CHECKIN, CachedCheckinStatus.serializer())
        }
        val status = cached?.status
        if (status != null) {
            Log.i(TAG, "degrade → cached checkin status")
            _state.value = _state.value.copy(loading = false, status = status, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(status: CheckinStatusDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.CHECKIN,
                CachedCheckinStatus.serializer(),
                CachedCheckinStatus(status = status),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodCheckin"
    }
}

/**
 * Parses a non-2xx check-in body ({ error, alreadyCheckedIn }) with the
 * shared lenient Json instance — parseErrorBody's AuthErrorDto has no
 * alreadyCheckedIn field, and the 409's flag is wire truth the screen
 * mirrors into its button state.
 */
private fun okhttp3.ResponseBody.parseCheckinEnvelope(): CheckinSubmitEnvelope? {
    val raw = string()
    if (raw.isBlank()) return null
    return runCatching { ApiClient.json.decodeFromString(CheckinSubmitEnvelope.serializer(), raw) }
        .getOrNull()
}
