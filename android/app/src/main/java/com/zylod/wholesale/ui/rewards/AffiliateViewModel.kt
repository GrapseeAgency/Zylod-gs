package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AffiliateDashboardDto
import com.zylod.wholesale.data.api.AffiliateProfileDto
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
 * Affiliate VM — GET/POST api/affiliate + GET api/affiliate/dashboard
 * (RewardsApi.affiliateStatus / .joinAffiliate / .affiliateDashboard) as
 * the payload of record for the native affiliate-program +
 * affiliate-dashboard pageIds (the web's two components, same split).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    any leg (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth; 403 is treated the same (the routes answer both for a dead
 *    session, exactly like the web's res.status 401||403 branch).
 *  - PROGRAM layout: GET answers the three-shape status — enrolled=false
 *    (the honest join CTA; the route's own 'User is not yet enrolled…'
 *    message) or enrolled=true + profile (tracking link card). The JOIN is
 *    POST with NO body: 200 'Already enrolled' / 201 'Successfully
 *    enrolled in the Zylod Wholesale Affiliate Partner Program!' — the
 *    message renders verbatim and the profile from data becomes the
 *    tracking-link card.
 *  - DASHBOARD layout: GET api/affiliate/dashboard — 404 'Affiliate
 *    profile not found' when the caller has no profile → the honest
 *    not-enrolled gate (NO zero-shaped KPI cards, the web's own verdict);
 *    200 renders the KPI cards, the pending/paid payout card and the
 *    always-empty conversions ledger as its honest empty state.
 *  - OFFLINE: the last saved status/dashboard (SharedPreferences
 *    "zylod_config", "native_affiliate_cache" /
 *    "native_affiliate_dashboard_cache") render with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the cache keys.
 */
data class AffiliateUiState(
    /** Resolving / fetching (skeleton while empty). */
    val loading: Boolean = true,
    /** GET api/affiliate status — null until known (three-shape route). */
    val enrolled: Boolean? = null,
    /** The not-enrolled route's own message ('User is not yet enrolled…'). */
    val statusMessage: String? = null,
    val profile: AffiliateProfileDto? = null,
    val dashboard: AffiliateDashboardDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The dashboard route's 404 — no affiliate profile for this account. */
    val dashboardNotFoundMessage: String? = null,
    /** Signed out (no token, or a 401/403 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** POST join in flight — the button is disabled (rate limit 5/min). */
    val joining: Boolean = false,
    /** The verbatim join rejection. */
    val joinError: String? = null,
    /** Real success: the route's message verbatim ('Already enrolled' / 201 line). */
    val joinSuccessMessage: String? = null,
    /** Copy-affordance feedback (the web's 2s "Copied" flip). */
    val linkCopied: Boolean = false,
)

class AffiliateViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(AffiliateUiState())
    val state: StateFlow<AffiliateUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null
    private var joinJob: Job? = null

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
        if (loadJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = AffiliateUiState(loading = false, needsAuth = true)
            return
        }
        loadJob?.cancel()
        _state.update {
            it.copy(
                loading = it.enrolled == null && it.dashboard == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        loadJob = viewModelScope.launch {
            if (pageId == "affiliate-dashboard") fetchDashboard() else fetchStatus()
        }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /** Dismiss the inline join result (the user read it). */
    fun consumeJoinResult() {
        _state.update { it.copy(joinSuccessMessage = null, joinError = null) }
    }

    /**
     * Copy-affordance feedback — the web's 2s "Copied" flip. The clipboard
     * WRITE itself happens in the screen (LocalClipboardManager is a
     * composition local); this only times the label back.
     */
    fun copyLink() {
        _state.update { it.copy(linkCopied = true) }
        viewModelScope.launch {
            kotlinx.coroutines.delay(2000)
            _state.update { it.copy(linkCopied = false) }
        }
    }

    /**
     * POST api/affiliate — the JOIN, NO request body (the route reads
     * none). Success renders the verbatim message and swaps the CTA for
     * the tracking-link card from data — no re-fetch needed (the response
     * carries the profile), matching the web's setAffiliate(data.data).
     */
    fun join() {
        if (joinJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true, joining = false)
            return
        }
        _state.update { it.copy(joining = true, joinError = null, joinSuccessMessage = null) }
        joinJob = viewModelScope.launch {
            try {
                Log.i(TAG, "join affiliate program")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.rewardsApi(base).joinAffiliate()
                if (response.code() == 401 || response.code() == 403) {
                    Log.i(TAG, "join rejected (http=${response.code()}) — session ended")
                    _state.update { it.copy(joining = false, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                val profile = payload?.data
                if (response.isSuccessful && payload?.success == true && profile != null) {
                    Log.i(TAG, "joined: ${payload.message}")
                    persistStatus(enrolled = true, profile = profile)
                    _state.update {
                        it.copy(
                            joining = false,
                            enrolled = true,
                            profile = profile,
                            joinSuccessMessage = payload.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Enrolled in the Wholesale Affiliate Partner Program!",
                        )
                    }
                    return@launch
                }
                val errorText = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: payload?.error?.takeIf(String::isNotBlank)
                    ?: "Enrollment was refused (HTTP ${response.code()}). You were NOT enrolled."
                Log.w(TAG, "join failed: $errorText")
                _state.update { it.copy(joining = false, joinError = errorText) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "join failed: ${e.message}")
                _state.update {
                    it.copy(
                        joining = false,
                        joinError = "Network error — enrollment did not go through. Please retry.",
                    )
                }
            }
        }
    }

    /* ── fetch / degrade ── */

    private suspend fun fetchStatus() {
        try {
            Log.i(TAG, "fetch affiliate status")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).affiliateStatus()
            if (gateOn401(response.code())) return
            val payload = response.body()
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your affiliate status (HTTP ${response.code()})."
                Log.w(TAG, "affiliate status error: $message")
                degrade(message)
                return
            }
            if (payload?.enrolled == true && payload.data != null) {
                Log.i(TAG, "affiliate enrolled code=${payload.data?.affiliateCode}")
                _state.value = _state.value.copy(
                    loading = false,
                    enrolled = true,
                    profile = payload.data,
                    statusMessage = payload.message,
                )
                persistStatus(enrolled = true, profile = payload.data)
            } else {
                Log.i(TAG, "affiliate not enrolled: ${payload?.message}")
                _state.value = _state.value.copy(
                    loading = false,
                    enrolled = false,
                    statusMessage = payload?.message,
                    profile = null,
                )
                persistStatus(enrolled = false, profile = null)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "affiliate status fetch failed: ${e.message}")
            degrade("Network error while loading your affiliate status. Check your connection and retry.")
        }
    }

    private suspend fun fetchDashboard() {
        try {
            Log.i(TAG, "fetch affiliate dashboard")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).affiliateDashboard()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val dashboard = payload?.data
            if (response.code() == 404) {
                // The route's own verdict for a non-affiliate account — the
                // honest gate, never zero-shaped KPI cards.
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Affiliate profile not found"
                Log.i(TAG, "affiliate dashboard 404: $message")
                _state.value = _state.value.copy(loading = false, dashboardNotFoundMessage = message)
                return
            }
            if (!response.isSuccessful || payload?.success != true || dashboard == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your affiliate data (HTTP ${response.code()})."
                Log.w(TAG, "affiliate dashboard error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "affiliate dashboard loaded clicks=${dashboard.stats?.totalClicks}")
            _state.value = _state.value.copy(loading = false, dashboard = dashboard, error = null)
            persistDashboard(dashboard)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "affiliate dashboard fetch failed: ${e.message}")
            degrade("Network error — could not reach the affiliate service. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401 && code != 403) return false
        Log.i(TAG, "not permitted (http=$code) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        if (pageId == "affiliate-dashboard") {
            val cached = withContext(Dispatchers.IO) {
                FinanceCacheStore.read(appContext, RewardsCacheKeys.AFFILIATE_DASHBOARD, CachedAffiliateDashboard.serializer())
                    ?.dashboard
            }
            if (cached != null) {
                Log.i(TAG, "degrade → cached affiliate dashboard")
                _state.value = _state.value.copy(loading = false, dashboard = cached, offlineFromCache = true)
            } else {
                _state.update { it.copy(loading = false, error = message) }
            }
        } else {
            val cached = withContext(Dispatchers.IO) {
                FinanceCacheStore.read(appContext, RewardsCacheKeys.AFFILIATE_STATUS, CachedAffiliateStatus.serializer())
            }
            if (cached != null) {
                Log.i(TAG, "degrade → cached affiliate status (enrolled=${cached.enrolled})")
                _state.value = _state.value.copy(
                    loading = false,
                    enrolled = cached.enrolled,
                    profile = cached.profile,
                    offlineFromCache = true,
                )
            } else {
                _state.update { it.copy(loading = false, error = message) }
            }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistStatus(enrolled: Boolean, profile: AffiliateProfileDto?) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.AFFILIATE_STATUS,
                CachedAffiliateStatus.serializer(),
                CachedAffiliateStatus(enrolled = enrolled, profile = profile),
            )
        }
    }

    private fun persistDashboard(dashboard: AffiliateDashboardDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                RewardsCacheKeys.AFFILIATE_DASHBOARD,
                CachedAffiliateDashboard.serializer(),
                CachedAffiliateDashboard(dashboard = dashboard),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodRewards"
    }
}
