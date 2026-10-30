package com.zylod.wholesale.ui.coupons

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.data.api.CouponClaimRequest
import com.zylod.wholesale.data.api.CouponVaultDto
import com.zylod.wholesale.data.api.PlatformCouponDto
import com.zylod.wholesale.data.api.RewardsDataDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Response

/**
 * One fetch window: vault (active + used) + public campaigns + points, in
 * flight together — the same doctrine as WalletViewModel's balance+history
 * pair (a half-fresh coupons surface is harder to render honestly than a
 * saved one).
 */
private data class CouponsWindow(
    val active: Response<ApiEnvelope<List<CouponVaultDto>>>,
    val used: Response<ApiEnvelope<List<CouponVaultDto>>>,
    val available: Response<ApiEnvelope<List<PlatformCouponDto>>>,
    val rewards: Response<ApiEnvelope<RewardsDataDto>>,
)

/**
 * Native My Coupons VM — GET /api/coupons/my (active + used), GET
 * /api/coupons (public campaigns) and GET /api/rewards (points), with an
 * optional POST /api/coupons/claim to collect a campaign code.
 *
 *  - AUTH (WalletViewModel convention): coupons are per-buyer private money
 *    promises, so an absent token short-circuits to `needsAuth` without a
 *    network call, and a 401 (the shared OkHttp authenticator already tried
 *    one refresh) moves the screen to the sign-in state with rendered data
 *    CLEARED — a stale vault must never survive a dead session.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_coupons_cache", written after
 *    every successful pull) — and the state flips to `offline` so the screen
 *    shows its saved-coupons banner. With nothing renderable at all: the
 *    honest first-launch offline state (error not null), never a blank
 *    screen.
 *  - VAULT WINDOW: the route caps limit at 50 and a buyer's own vouchers are
 *    bounded, so ONE pull per status (50 rows) covers the vault — no
 *    infinite scroll on this surface. The claim rail (public campaigns) is
 *    likewise a single first page.
 *  - CLAIM SAFETY: earned vouchers bound to this buyer also ride the public
 *    list (coupons rows with userId set). They are filtered OUT of the claim
 *    rail ([PlatformCoupon.personal]) because they already live in the vault
 *    sections — claiming one would increment usedCount and spend it.
 */
data class CouponsUiState(
    val loading: Boolean = true,
    /** Vault rows with status "active" (spendable at checkout). */
    val active: List<CouponVaultItem> = emptyList(),
    /** Vault rows with status "used" (already spent on an order). */
    val used: List<CouponVaultItem> = emptyList(),
    /** Public campaign codes the buyer can still claim. */
    val available: List<PlatformCoupon> = emptyList(),
    /** Loyalty points (GET /api/rewards); null = hide the points rail. */
    val rewards: RewardsSummary? = null,
    /** stableKey of a campaign coupon whose claim POST is in flight. */
    val claimingKey: String? = null,
    /** One-shot inline feedback for claim attempts (success or failure). */
    val notice: Notice? = null,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved cache). */
    val error: String? = null,
) {
    val hasContent: Boolean
        get() = active.isNotEmpty() || used.isNotEmpty() ||
            available.isNotEmpty() || rewards != null

    /** Inline claim feedback, styled differently for failure vs success. */
    data class Notice(val text: String, val isError: Boolean)
}

class CouponsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CouponsUiState())
    val state: StateFlow<CouponsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to the
        // sign-in state instead of a stale (possibly someone else's) vault.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = CouponsUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry pull / retry (called on EVERY entry — the VM survives on the
     * saved back stack, so vouchers claimed or spent elsewhere show up at
     * once). Same guard doctrine as WalletViewModel.refresh(): only a pull
     * already in flight WITH content on screen is a no-op (t216
     * silent-refresh convention — never blank visible data behind a
     * spinner).
     */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = CouponsUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return // a claim is mutating the vault — let it settle
        if (s.loading && s.hasContent) return // a refresh already in flight with content on screen
        _state.value = s.copy(
            loading = !s.hasContent,
            offline = false,
            error = null,
            needsAuth = false,
            notice = null,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as WalletViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.couponsApi(base)
            // ONE window: both vault statuses + campaigns + points, together.
            val (activeResp, usedResp, availResp, rewardsResp) = coroutineScope {
                val active = async { api.my(status = STATUS_ACTIVE, limit = VAULT_LIMIT) }
                val used = async { api.my(status = STATUS_USED, limit = VAULT_LIMIT) }
                val avail = async { api.available(limit = AVAILABLE_LIMIT) }
                val rewards = async { api.rewards() }
                CouponsWindow(active.await(), used.await(), avail.await(), rewards.await())
            }

            // 401: the shared authenticator has already attempted one token
            // refresh by the time a 401 reaches this layer → real end of
            // session → sign-in state, data cleared.
            if (activeResp.code() == 401 || usedResp.code() == 401 ||
                availResp.code() == 401 || rewardsResp.code() == 401
            ) {
                Log.w(TAG, "coupons 401 — session ended")
                _state.value = CouponsUiState(loading = false, needsAuth = true)
                return
            }
            if (!activeResp.isSuccessful || !usedResp.isSuccessful ||
                !availResp.isSuccessful || !rewardsResp.isSuccessful
            ) {
                val failed = listOf(activeResp, usedResp, availResp, rewardsResp)
                    .firstOrNull { !it.isSuccessful }
                val message = parseErrorBody(failed?.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your coupons (HTTP ${failed?.code() ?: 0})"
                Log.w(TAG, "coupons error: $message")
                degrade(message)
                return
            }
            val activeBody = activeResp.body()?.takeIf { it.success }
            val usedBody = usedResp.body()?.takeIf { it.success }
            val availBody = availResp.body()?.takeIf { it.success }
            val rewardsBody = rewardsResp.body()?.takeIf { it.success }
            Log.i(
                TAG,
                "coupons http=${activeResp.code()} active=${activeBody?.data?.size ?: -1} " +
                    "used=${usedBody?.data?.size ?: -1} avail=${availBody?.data?.size ?: -1}",
            )
            if (activeBody == null || usedBody == null || availBody == null) {
                degrade("Could not load your coupons")
                return
            }

            val active = activeBody.vaultItems()
            val used = usedBody.vaultItems()
            // The claim rail shows PUBLIC campaign codes only: rows bound to
            // this buyer are earned vouchers — the vault sections below
            // already render them, and claiming one would spend it.
            val available = availBody.platformCoupons().filterNot { it.personal }
            // Points are auxiliary on this surface: a success=false body only
            // hides the points rail, it never takes the coupons down.
            val rewards = rewardsBody?.rewardsSummary()

            _state.value = CouponsUiState(
                loading = false,
                active = active,
                used = used,
                available = available,
                rewards = rewards,
                offline = false,
            )
            persistCache(active, used, available, rewards)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading your coupons. Check your connection and retry.")
        }
    }

    /**
     * Collect a public campaign coupon into the vault. Success moves the
     * card out of the claim rail and into Active (deduped) — the UI updates
     * from the server's own created row, never a guessed local mutation.
     */
    fun claim(coupon: PlatformCoupon) {
        if (SessionManager.token() == null) {
            _state.value = CouponsUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return // one claim in flight at a time
        if (!coupon.claimable) return
        _state.value = s.copy(claimingKey = coupon.stableKey, notice = null)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.couponsApi(base)
                    .claim(CouponClaimRequest(couponId = coupon.id))
                if (response.code() == 401) {
                    Log.w(TAG, "claim 401 — session ended")
                    _state.value = CouponsUiState(loading = false, needsAuth = true)
                    return@launch
                }
                val claimed = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || claimed == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not claim ${coupon.code} right now."
                    Log.w(TAG, "claim error: $message")
                    _state.value = _state.value.copy(
                        claimingKey = null,
                        notice = CouponsUiState.Notice(message, isError = true),
                    )
                    return@launch
                }
                val item = claimed.toVaultItem()
                val current = _state.value
                _state.value = current.copy(
                    claimingKey = null,
                    notice = CouponsUiState.Notice("${item.code} added to your vouchers", isError = false),
                    available = current.available.filterNot { it.stableKey == coupon.stableKey },
                    active = dedupe(listOf(item) + current.active),
                )
                persistCache(
                    _state.value.active,
                    _state.value.used,
                    _state.value.available,
                    _state.value.rewards,
                )
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim failed: ${e.message}")
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = CouponsUiState.Notice(
                        "Network error while claiming. Check your connection and retry.",
                        isError = true,
                    ),
                )
            }
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache; with neither, the first-launch offline state.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.hasContent) {
            _state.value = _state.value.copy(
                loading = false,
                claimingKey = null,
                offline = true,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) { CouponsCacheStore.read(appContext) }
        if (cached != null && (cached.active.isNotEmpty() || cached.used.isNotEmpty() ||
                cached.available.isNotEmpty())
        ) {
            _state.value = CouponsUiState(
                loading = false,
                active = cached.active,
                used = cached.used,
                available = cached.available,
                rewards = cached.rewards,
                offline = true,
            )
        } else {
            _state.value = CouponsUiState(loading = false, error = message)
        }
    }

    /** Key-dedup: the server allows one active voucher per code. */
    private fun dedupe(items: List<CouponVaultItem>): List<CouponVaultItem> {
        val seen = HashSet<String>(items.size)
        return items.filter { seen.add(it.stableKey) }
    }

    private fun persistCache(
        active: List<CouponVaultItem>,
        used: List<CouponVaultItem>,
        available: List<PlatformCoupon>,
        rewards: RewardsSummary?,
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            CouponsCacheStore.write(
                appContext,
                CouponsCacheEnvelope(
                    savedAt = System.currentTimeMillis(),
                    active = active,
                    used = used,
                    available = available,
                    rewards = rewards,
                ),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodCoupons"
        const val STATUS_ACTIVE = "active"
        const val STATUS_USED = "used"
        const val VAULT_LIMIT = 50 // route caps limit at 50
        const val AVAILABLE_LIMIT = 20
    }
}

/**
 * On-device saved coupons — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the key the owner brief fixed:
 * "native_coupons_cache". Payload = the last successful window (vault +
 * campaigns + points), so the offline render is consistent with the online
 * one.
 */
object CouponsCacheStore {
    private const val TAG = "ZylodCoupons"
    private const val PREFS = "zylod_config"
    const val KEY = "native_coupons_cache"

    fun read(context: Context): CouponsCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CouponsCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "coupons cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: CouponsCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CouponsCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "coupons cache write failed: ${it.message}") }
    }
}
