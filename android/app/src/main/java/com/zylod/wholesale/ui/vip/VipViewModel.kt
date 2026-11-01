package com.zylod.wholesale.ui.vip

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.VipDataDto
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
 * VIP VM — GET api/vip (RewardsApi.vipMatrix) as the payload of record for
 * the five native vip pageIds (vip-benefits + vip-benefits-page render the
 * web's vip-benefits-page LADDER; vip-club / vip-membership / vip-program
 * render the web's vip-membership-page hero — the layout branch is the
 * screen's, this VM serves both).
 *
 *  - AUTH: the route is PUBLIC — a guest GET still returns the full real
 *    ladder with currentTier 'standard' / totalSpend 0. So the ladder
 *    pageIds never gate. The club pageIds mirror the web's own
 *    `if (!isAuthenticated) return <AccountGate …>`: no token → the honest
 *    sign-in gate, no call at all (a 401 can only arrive as shape drift
 *    and degrades the same way).
 *  - OFFLINE: the last saved ladder (SharedPreferences "zylod_config",
 *    "native_vip_cache") renders with the offline banner otherwise
 *    (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (RewardsViewModel convention) while sharing the one cache key.
 */
data class VipUiState(
    /** Resolving / fetching the ladder (skeleton while empty). */
    val loading: Boolean = true,
    val vip: VipDataDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Club pageIds only: signed out — the web AccountGate parity gate. */
    val needsAuth: Boolean = false,
    /** The visible ladder came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class VipViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(VipUiState())
    val state: StateFlow<VipUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var vipJob: Job? = null

    /** The web's layout split: ladder pageIds render signed-out too. */
    private val ladderLayout: Boolean = vipIsLadder(pageId)

    init {
        // 401→refresh→logout chain: a dropped session moves a gated club
        // page to the sign-in gate (RewardsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null && !ladderLayout) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (vipJob?.isActive == true) return
        // The club layout gates sign-in exactly like the web component; the
        // ladder layout renders for guests (the route answers them too).
        if (!ladderLayout && SessionManager.token() == null) {
            _state.value = VipUiState(loading = false, needsAuth = true)
            return
        }
        vipJob?.cancel()
        _state.update {
            it.copy(
                loading = it.vip == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        vipJob = viewModelScope.launch { fetchVip() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /* ── fetch / degrade ── */

    private suspend fun fetchVip() {
        try {
            Log.i(TAG, "fetch vip matrix")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.rewardsApi(base).vipMatrix()
            if (response.code() == 401) {
                Log.i(TAG, "not permitted (http=401) — session ended")
                if (ladderLayout) {
                    degrade("Could not load the VIP tier configuration.")
                } else {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
                return
            }
            val payload = response.body()
            val vip = payload?.data
            if (!response.isSuccessful || payload?.success != true || vip == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the VIP tier configuration."
                Log.w(TAG, "vip matrix error: $message")
                degrade(message)
                return
            }
            Log.i(
                TAG,
                "vip matrix loaded tier=${vip.currentTier} spend=${vip.totalSpendBDT} tiers=${vip.tiers.size}",
            )
            _state.value = _state.value.copy(
                loading = false,
                vip = vip,
                error = null,
            )
            persistCache(vip)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "vip fetch failed: ${e.message}")
            degrade("Network error while loading the VIP tier configuration. Check your connection and retry.")
        }
    }

    /** Failure path: saved ladder cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, VipCacheKeys.VIP, CachedVip.serializer())
        }
        val vip = cached?.vip
        if (vip != null) {
            Log.i(TAG, "degrade → cached vip matrix")
            _state.value = _state.value.copy(loading = false, vip = vip, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(vip: VipDataDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                VipCacheKeys.VIP,
                CachedVip.serializer(),
                CachedVip(vip = vip),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodVip"
    }
}
