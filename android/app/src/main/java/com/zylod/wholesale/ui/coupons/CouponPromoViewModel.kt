package com.zylod.wholesale.ui.coupons

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CouponClaimRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Native Coupon Promo VM — the web's coupon-promo page
 * (src/components/pages/coupon-promo-page.tsx), wire-exact:
 *
 *  - GET api/coupons?limit=30 — the public campaign list. The route is
 *    PUBLIC: guests see the public rows, a signed-in buyer additionally
 *    sees their own earned vouchers (userId set) — those are vault
 *    material, so the claim rail filters them OUT ([PlatformCoupon.personal])
 *    exactly like My Coupons does; claiming one would spend it.
 *  - POST api/coupons/claim — TWO paths, both real:
 *      · by row id (a campaign card's Claim button),
 *      · BY CODE (the typed-code box; 201 "Collected", 401 → sign-in,
 *        anything else surfaces the server's own refusal wording — expired,
 *        exhausted, foreign or unknown codes included).
 *
 * Doctrine (identical to CouponsViewModel): soft sign-in CTA never a hard
 * redirect; offline renders the saved campaigns (in-memory first, then the
 * "native_coupon_promo_cache" prefs key); one claim in flight at a time;
 * the UI never invents a success — every settled claim comes from the
 * server's own answer.
 */
data class CouponPromoUiState(
    val loading: Boolean = true,
    /** Public campaign rows (personal earned vouchers filtered out). */
    val campaigns: List<PlatformCoupon> = emptyList(),
    /** stableKey of a row claim in flight, or "code" while a code claim runs. */
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
        get() = campaigns.isNotEmpty()

    val anyClaimInFlight: Boolean
        get() = claimingKey != null

    /** Inline claim feedback, styled differently for failure vs success. */
    data class Notice(val text: String, val isError: Boolean)
}

class CouponPromoViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CouponPromoUiState())
    val state: StateFlow<CouponPromoUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        // 401→refresh→logout chain: a dropped session must not leave a
        // claimable rail behind a dead session.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = CouponPromoUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry pull / retry (called on EVERY entry — the VM survives on the
     * saved back stack). Same guard doctrine as CouponsViewModel.refresh().
     * NOTE: the LIST is public — this pull does NOT short-circuit guests
     * (they see the campaigns; only a CLAIM needs the account), exactly the
     * web page's behavior.
     */
    fun refresh() {
        val s = _state.value
        if (s.claimingKey != null) return // a claim is mutating the rail — let it settle
        if (s.loading && s.hasContent) return
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
            val response = ApiClient.couponsApi(base).available(limit = PROMO_LIMIT)

            if (response.code() == 401) {
                // The public list 401s only if the session died mid-refresh
                // — the rail is public, so degrade instead of a hard gate.
                Log.w(TAG, "promo 401 on public list")
                degrade("Could not load the campaign list (HTTP 401)")
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the campaign list (HTTP ${response.code()})"
                Log.w(TAG, "promo error: $message")
                degrade(message)
                return
            }
            val body = response.body()?.takeIf { it.success }
            if (body == null) {
                degrade("Could not load the campaign list")
                return
            }
            val campaigns = body.platformCoupons().filterNot { it.personal }
            Log.i(TAG, "promo http=${response.code()} campaigns=${campaigns.size}")

            _state.value = CouponPromoUiState(loading = false, campaigns = campaigns, offline = false)
            persistCache(campaigns)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading the campaign list. Check your connection and retry.")
        }
    }

    /**
     * Claim a campaign card by its id (the web page's row Claim button).
     * 201 moves the card off the rail FROM THE SERVER's created row; a
     * refusal surfaces the server's own wording.
     */
    fun claim(coupon: PlatformCoupon) {
        if (SessionManager.token() == null) {
            _state.value = CouponPromoUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return
        if (!coupon.claimable) return
        _state.value = s.copy(claimingKey = coupon.stableKey, notice = null)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.couponsApi(base)
                    .claim(CouponClaimRequest(couponId = coupon.id))
                if (response.code() == 401) {
                    Log.w(TAG, "claim 401 — session ended")
                    _state.value = CouponPromoUiState(loading = false, needsAuth = true)
                    return@launch
                }
                val claimed = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || claimed == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "The server refused — ${coupon.code} was NOT collected."
                    Log.w(TAG, "claim error: $message")
                    _state.value = _state.value.copy(
                        claimingKey = null,
                        notice = CouponPromoUiState.Notice(message, isError = true),
                    )
                    return@launch
                }
                val item = claimed.toVaultItem()
                val current = _state.value
                _state.value = current.copy(
                    claimingKey = null,
                    notice = CouponPromoUiState.Notice(
                        "Collected \"${item.code}\" — it is in your voucher vault",
                        isError = false,
                    ),
                    campaigns = current.campaigns.filterNot { it.stableKey == coupon.stableKey },
                )
                persistCache(_state.value.campaigns)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim failed: ${e.message}")
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = CouponPromoUiState.Notice(
                        "Network error — the voucher was NOT collected. Please retry.",
                        isError = true,
                    ),
                )
            }
        }
    }

    /**
     * Claim by TYPED CODE (the web page's code box): POST
     * api/coupons/claim { code }. The server checks the code against the
     * live database — expired, exhausted, foreign or unknown codes are
     * refused with the real reason, surfaced verbatim.
     */
    fun claimByCode(code: String) {
        val trimmed = code.trim().uppercase()
        if (trimmed.isEmpty()) return
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return
        _state.value = s.copy(claimingKey = CODE_CLAIM_KEY, notice = null)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.couponsApi(base)
                    .claim(CouponClaimRequest(code = trimmed))
                if (response.code() == 401) {
                    Log.w(TAG, "claim-by-code 401 — session ended")
                    _state.value = CouponPromoUiState(loading = false, needsAuth = true)
                    return@launch
                }
                val claimed = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || claimed == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "The server refused (HTTP ${response.code()}) — $trimmed was NOT collected."
                    Log.w(TAG, "claim-by-code error: $message")
                    _state.value = _state.value.copy(
                        claimingKey = null,
                        notice = CouponPromoUiState.Notice(message, isError = true),
                    )
                    return@launch
                }
                val item = claimed.toVaultItem()
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = CouponPromoUiState.Notice(
                        "Collected \"${item.code}\" — it is in your voucher vault",
                        isError = false,
                    ),
                )
                // The list may now include this code if it was personal to
                // this buyer — the web page reloads after a 201; same here.
                viewModelScope.launch { refetchSilently() }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim-by-code failed: ${e.message}")
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = CouponPromoUiState.Notice(
                        "Network error — the voucher was NOT collected. Please retry.",
                        isError = true,
                    ),
                )
            }
        }
    }

    /** Silent list refresh (keeps visible rows mounted — t216 convention). */
    private suspend fun refetchSilently() {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.couponsApi(base).available(limit = PROMO_LIMIT)
            if (!response.isSuccessful) return
            val body = response.body()?.takeIf { it.success } ?: return
            val campaigns = body.platformCoupons().filterNot { it.personal }
            _state.value = _state.value.copy(campaigns = campaigns)
            persistCache(campaigns)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "silent refetch failed: ${e.message}")
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
        val cached = withContext(Dispatchers.IO) { CouponPromoCacheStore.read(appContext) }
        if (cached != null && cached.campaigns.isNotEmpty()) {
            _state.value = CouponPromoUiState(
                loading = false,
                campaigns = cached.campaigns,
                offline = true,
            )
        } else {
            _state.value = CouponPromoUiState(loading = false, error = message)
        }
    }

    private fun persistCache(campaigns: List<PlatformCoupon>) {
        viewModelScope.launch(Dispatchers.IO) {
            CouponPromoCacheStore.write(
                appContext,
                CouponPromoCacheEnvelope(savedAt = System.currentTimeMillis(), campaigns = campaigns),
            )
        }
    }

    companion object {
        private const val TAG = "ZylodCouponPromo"
        private const val PROMO_LIMIT = 30 // the web page's ?limit=30
        /** claimingKey sentinel while a typed-code claim POST is in flight. */
        const val CODE_CLAIM_KEY = "code"
    }
}

/**
 * On-device saved campaigns — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the key "native_coupon_promo_cache".
 * Payload = the last successful campaign rail (domain rows, not wire DTOs —
 * CouponsCacheEnvelope doctrine), so the offline render is consistent with
 * the online one.
 */
@kotlinx.serialization.Serializable
data class CouponPromoCacheEnvelope(
    val savedAt: Long = 0L,
    val campaigns: List<PlatformCoupon> = emptyList(),
)

object CouponPromoCacheStore {
    private const val TAG = "ZylodCouponPromo"
    private const val PREFS = "zylod_config"
    const val KEY = "native_coupon_promo_cache"

    fun read(context: Context): CouponPromoCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CouponPromoCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "promo cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: CouponPromoCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CouponPromoCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "promo cache write failed: ${it.message}") }
    }
}
