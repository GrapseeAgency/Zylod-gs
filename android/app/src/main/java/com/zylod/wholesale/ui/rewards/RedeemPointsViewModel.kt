package com.zylod.wholesale.ui.rewards

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PointsRedeemBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t282 — native Redeem-Points VM (SPA pageId "redeem-points"; the web
 * component is redeem-points-page.tsx). The pageId was WebView-forwarded in
 * t281 ("typed ui/rewards port noted for later") — this is that port.
 *
 * Wire contract:
 *  - BALANCE: GET api/rewards/loyalty through the EXISTING RewardsApi
 *    (LoyaltyStatusDto.pointsBalance) — the exact call the web page makes.
 *  - REDEEM: POST api/rewards/redeem { pointsToRedeem, rewardType }
 *    (PointsLedgerApi.redeem) — 10 points = ৳1; 'voucher' issues a REAL
 *    single-use coupon (30 days, min order 3× the value) whose CODE the
 *    201 data carries; 'wallet_credit' moves ৳ into the wallet. Errors are
 *    surfaced VERBATIM (400 'Insufficient point balance — you have X
 *    points, this redemption needs Y', 409 the concurrent-redemption text,
 *    401 the sign-in gate). Rate limit is server-side (10/min) — the UI
 *    single-flights via [RedeemPointsUiState.redeemingPoints].
 *  - SUCCESS parity: balance decrements optimistically (the web's
 *    setPointsBalance(prev - opt.points)), the toast carries the REAL code
 *    (or the wallet message), then the screen routes to my-coupons — the
 *    web's navigate('my-coupons').
 *
 * The fixed option table is the WEB PAGE'S OWN REDEEM_OPTIONS (verified
 * against the API's real rules: minOrder = 3 × value for vouchers, the
 * ৳1,000 tier is a wallet credit with NO minimum) — mirrored constants,
 * not invented benefits.
 */
data class RedeemOption(
    val points: Int,
    val bdt: Int,
    val label: String,
    /** 0 = the wallet-credit tier (no minimum); vouchers show minOrder = 3×bdt. */
    val minOrder: Int,
) {
    /** The web's rewardType pick: minOrder === 0 → wallet_credit. */
    val rewardType: String get() = if (minOrder == 0) "wallet_credit" else "voucher"
}

/** redeem-points-page.tsx REDEEM_OPTIONS — verbatim, server-rule-true. */
val REDEEM_OPTIONS = listOf(
    RedeemOption(points = 500, bdt = 50, label = "৳50 Wholesale Voucher", minOrder = 150),
    RedeemOption(points = 1000, bdt = 100, label = "৳100 Wholesale Voucher", minOrder = 300),
    RedeemOption(points = 2500, bdt = 250, label = "৳250 Wholesale Voucher", minOrder = 750),
    RedeemOption(points = 5000, bdt = 500, label = "৳500 Wholesale Voucher", minOrder = 1500),
    RedeemOption(points = 10000, bdt = 1000, label = "৳1,000 Wallet Credit", minOrder = 0),
)

data class RedeemPointsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val balance: Int = 0,
    val loadError: String? = null,
    /** The option currently redeeming (its points value — the web's key). */
    val redeemingPoints: Int? = null,
    val customBusy: Boolean = false,
    /** One-shot sonner-parity message (success carries the REAL voucher code). */
    val toast: String? = null,
)

class RedeemPointsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RedeemPointsUiState())
    val state: StateFlow<RedeemPointsUiState> = _state.asStateFlow()

    private var rewardsApi: com.zylod.wholesale.data.api.RewardsApi? = null
    private var ledgerApi: com.zylod.wholesale.data.api.PointsLedgerApi? = null
    private var redeemJob: Job? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = RedeemPointsUiState(loading = false, needsAuth = true)
            return
        }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = rewardsApi ?: ApiClient.rewardsApi(baseUrl).also { rewardsApi = it }
                val response = client.loyalty()
                if (response.code() == 401) {
                    _state.value = RedeemPointsUiState(loading = false, needsAuth = true)
                    return@launch
                }
                val balance = response.body()?.takeIf { it.success }?.data?.pointsBalance
                if (balance == null) {
                    _state.update { it.copy(loading = false, loadError = "Your points balance is unavailable right now.") }
                } else {
                    _state.update { it.copy(loading = false, balance = balance, loadError = null, needsAuth = false) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "loyalty load failed: ${e.message}")
                _state.update { it.copy(loading = false, loadError = "Could not reach the server to load your points balance.") }
            }
        }
    }

    /** A fixed-option tap (the web's handleRedeem). */
    fun redeem(option: RedeemOption) {
        redeem(option.points, option.rewardType, successLabel = option.label)
    }

    /**
     * The web's handleCustomRedeem: any whole number of points ≥ 100 (and ≤
     * the balance) as a VOUCHER — ৳1 per 10 points, min order 3× the value.
     */
    fun redeemCustom(points: Int) {
        redeem(points, "voucher", successLabel = "৳${points / 10} voucher")
    }

    private fun redeem(points: Int, rewardType: String, successLabel: String) {
        val s = _state.value
        if (s.redeemingPoints != null || s.customBusy) return
        if (points < 100) return
        if (s.balance < points) {
            _state.update {
                it.copy(toast = "You need $points points to redeem this reward. Current balance: ${it.balance}")
            }
            return
        }
        redeemJob?.cancel()
        val custom = rewardType == "voucher" && successLabel.startsWith("৳") && successLabel.contains("voucher")
        _state.update { if (custom) it.copy(customBusy = true) else it.copy(redeemingPoints = points) }
        redeemJob = viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = ledgerApi ?: ApiClient.pointsLedgerApi(baseUrl).also { ledgerApi = it }
                val response = client.redeem(PointsRedeemBody(pointsToRedeem = points, rewardType = rewardType))
                if (response.code() == 401) {
                    _state.update { it.copy(redeemingPoints = null, customBusy = false, needsAuth = true) }
                    return@launch
                }
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    val code = data?.coupon?.code
                    _state.update {
                        it.copy(
                            balance = it.balance - points,
                            redeemingPoints = null,
                            customBusy = false,
                            toast = if (code != null) {
                                "$successLabel issued! Code: $code — single use, valid 30 days, minimum order ৳${data.cashValueBDT * 3}. It is in your coupon vault."
                            } else {
                                "$successLabel has been added to your wallet."
                            },
                        )
                    }
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to redeem points"
                _state.update { it.copy(redeemingPoints = null, customBusy = false, toast = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "redeem failed: ${e.message}")
                _state.update { it.copy(redeemingPoints = null, customBusy = false, toast = "Network error — try again.") }
            }
        }
    }

    /** One-shot toast consume (the PDP VM's consumeToast convention). */
    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    private companion object {
        const val TAG = "ZylodRedeemPoints"
    }
}
