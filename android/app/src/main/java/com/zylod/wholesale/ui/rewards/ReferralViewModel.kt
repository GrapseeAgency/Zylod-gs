package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ReferralClaimBody
import com.zylod.wholesale.data.api.ReferralsDataDto
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
 * Referral VM — GET api/referrals + POST api/referrals/claim
 * (RewardsApi.referrals / .claimReferral) as the payload of record for the
 * native referral-program / referral-program-page / referral-earnings
 * pageIds (the web renders the same GET for all three: the program page
 * shows the code + claim form, the earnings page the ledger).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401/403
 *    on the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth.
 *  - CLAIM (the route's own semantics, mirrored): the friend's code is
 *    REQUIRED and trimmed client-side; the server uppercases it. The
 *    verbatim texts surface: 400 'referralCode is required' |
 *    'You cannot use your own referral code'; 404 'Invalid or inactive
 *    referral code'; 409 'You have already applied a referral code'; the
 *    201 'Referral code claimed! +300 Points and ৳200 voucher added to
 *    your account.' renders verbatim and the field clears (the web clears
 *    the input + toasts — no fabricated ledger mutation here, the next
 *    entry re-fetches).
 *  - OFFLINE: the last saved payload (SharedPreferences "zylod_config",
 *    "native_referrals_cache") renders with the offline banner otherwise
 *    (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class ReferralUiState(
    /** Resolving / fetching the referral payload (skeleton while empty). */
    val loading: Boolean = true,
    val referrals: ReferralsDataDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401/403 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The friend's invite-code field (the claim form). */
    val friendCode: String = "",
    /** POST claim in flight — the button is disabled (rate limit 10/min). */
    val claiming: Boolean = false,
    /** The verbatim server rejection (400 / 404 / 409 / 429). */
    val claimError: String? = null,
    /** Real success: the route's 201 message verbatim. */
    val claimSuccessMessage: String? = null,
    /** Copy-affordance feedback (the web's 2s "Copied Link" flip). */
    val linkCopied: Boolean = false,
) {
    /** The claim guard: a non-blank code (the route 400s on empty anyway). */
    val friendCodeBlank: Boolean get() = friendCode.trim().isEmpty()
}

class ReferralViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ReferralUiState())
    val state: StateFlow<ReferralUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var referralsJob: Job? = null
    private var claimJob: Job? = null

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
        if (referralsJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = ReferralUiState(loading = false, needsAuth = true)
            return
        }
        referralsJob?.cancel()
        _state.update {
            it.copy(
                loading = it.referrals == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        referralsJob = viewModelScope.launch { fetchReferrals() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    fun setFriendCode(text: String) {
        _state.update { it.copy(friendCode = text.take(32), claimError = null) }
    }

    /** Dismiss the inline claim result (the user read it). */
    fun consumeClaimResult() {
        _state.update { it.copy(claimSuccessMessage = null, claimError = null) }
    }

    /**
     * Copy-affordance feedback — the web's 2s "Copied Link" flip. The
     * clipboard WRITE itself happens in the screen (LocalClipboardManager
     * is a composition local); this only times the label back.
     */
    fun copyLink() {
        _state.update { it.copy(linkCopied = true) }
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            _state.update { it.copy(linkCopied = false) }
        }
    }

    /**
     * POST api/referrals/claim — apply a friend's code. Success clears the
     * field and shows the route's verbatim 201 message (the welcome points
     * + voucher land server-side; the re-fetch on next entry shows nothing
     * new in YOUR list — you are the referee, not the referrer).
     */
    fun submitClaim() {
        val code = _state.value.friendCode.trim()
        if (code.isEmpty()) {
            _state.update { it.copy(claimError = "referralCode is required") }
            return
        }
        if (claimJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true, claiming = false)
            return
        }
        _state.update { it.copy(claiming = true, claimError = null, claimSuccessMessage = null) }
        claimJob = viewModelScope.launch {
            try {
                Log.i(TAG, "claim referral code (len=${code.length})")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.rewardsApi(base).claimReferral(ReferralClaimBody(referralCode = code))
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "claim rejected (http=${response.code()}) — session ended")
                    _state.update { it.copy(claiming = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                val message = payload?.message
                if (response.isSuccessful && payload?.success == true && message != null) {
                    Log.i(TAG, "referral claimed")
                    _state.update {
                        it.copy(
                            claiming = false,
                            claimSuccessMessage = message,
                            friendCode = "",
                        )
                    }
                    return@launch
                }
                val errorText = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not claim that referral code (HTTP ${response.code()})."
                Log.w(TAG, "claim failed: $errorText")
                _state.update { it.copy(claiming = false, claimError = errorText) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim failed: ${e.message}")
                _state.update {
                    it.copy(
                        claiming = false,
                        claimError = "Network error — the code was NOT applied. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    private suspend fun fetchReferrals() {
        try {
            Log.i(TAG, "fetch referrals")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).referrals()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val referrals = payload?.data
            if (!response.isSuccessful || payload?.success != true || referrals == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your referral data (HTTP ${response.code()})."
                Log.w(TAG, "referrals error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "referrals loaded code=${referrals.code} invited=${referrals.totalInvited}")
            _state.value = _state.value.copy(
                loading = false,
                referrals = referrals,
                error = null,
            )
            persistCache(referrals)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "referrals fetch failed: ${e.message}")
            degrade("Network error while loading your referral data. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved payload cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, RewardsCacheKeys.REFERRALS, CachedReferralsData.serializer())
        }
        val referrals = cached?.referrals
        if (referrals != null) {
            Log.i(TAG, "degrade → cached referrals")
            _state.value = _state.value.copy(loading = false, referrals = referrals, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(referrals: ReferralsDataDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.REFERRALS,
                CachedReferralsData.serializer(),
                CachedReferralsData(referrals = referrals),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodRewards"
    }
}
