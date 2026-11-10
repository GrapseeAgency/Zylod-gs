package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.WalletBalanceDto
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * Native Balance Overview VM (t302) — the web's balance-overview page
 * (src/components/pages/balance-overview-page.tsx), wire-exact: ONE call to
 * GET api/wallet/balance through the EXISTING WalletApi — the breakdown
 * (available liquid, escrow, inflow/outflow, deposits/withdrawals/payments/
 * refunds/cashback) is the server's own aggregate; the page never renders a
 * fabricated ৳0 when the record can't be read.
 *
 * Doctrine:
 *  - AUTH (WalletViewModel convention): the web page gates guests with its
 *    AccountGate — the native screen shows the same soft sign-in CTA, never
 *    a hard redirect; 401 (after the shared authenticator's one refresh)
 *    lands there too.
 *  - OFFLINE (DealsViewModel degrade convention): the saved breakdown
 *    (SharedPreferences "zylod_config"/"native_balance_overview_cache")
 *    renders under the offline banner; with neither network nor cache, the
 *    honest error state with Retry.
 *  - The ONE page-level loader is the M3 spinner — no shimmer.
 */
data class BalanceOverviewUiState(
    val loading: Boolean = true,
    /** The server's own aggregate breakdown; null while loading/errored. */
    val balance: WalletBalanceDto? = null,
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved cache). */
    val error: String? = null,
)

class BalanceOverviewViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(BalanceOverviewUiState())
    val state: StateFlow<BalanceOverviewUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        // 401→refresh→logout chain: a dead session must not leave a stale
        // (possibly someone else's) balance on screen.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = BalanceOverviewUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull / retry (every entry — t208 convention). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = BalanceOverviewUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.loading && s.balance != null) return
        _state.value = s.copy(loading = !s.hasContent, offline = false, error = null, needsAuth = false)
        viewModelScope.launch { fetch() }
    }

    /** Same hook as WalletViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    private val BalanceOverviewUiState.hasContent: Boolean
        get() = balance != null

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.walletApi(base).balance()
            if (response.code() == 401) {
                Log.w(TAG, "balance 401 — session ended")
                _state.value = BalanceOverviewUiState(loading = false, needsAuth = true)
                return
            }
            if (!response.isSuccessful) {
                degrade("Could not load your wallet balance (HTTP ${response.code()}).")
                return
            }
            val body = response.body()?.takeIf { it.success }
            val balance = body?.data
            if (balance == null) {
                degrade("Could not load your wallet balance.")
                return
            }
            Log.i(TAG, "balance http=${response.code()} available=${balance.availableBalance}")
            _state.value = BalanceOverviewUiState(loading = false, balance = balance, offline = false)
            withContext(Dispatchers.IO) {
                BalanceCacheStore.write(
                    appContext,
                    BalanceCacheEnvelope(savedAt = System.currentTimeMillis(), balance = balance),
                )
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error — could not reach the wallet service.")
        }
    }

    private suspend fun degrade(message: String) {
        if (_state.value.hasContent) {
            _state.value = _state.value.copy(loading = false, offline = true)
            return
        }
        val cached = withContext(Dispatchers.IO) { BalanceCacheStore.read(appContext) }
        if (cached != null && cached.balance != null) {
            _state.value = BalanceOverviewUiState(
                loading = false,
                balance = cached.balance,
                offline = true,
            )
        } else {
            _state.value = BalanceOverviewUiState(loading = false, error = message)
        }
    }

    private companion object {
        const val TAG = "ZylodBalanceOverview"
    }
}

/** On-device saved breakdown — the "native_balance_overview_cache" key. */
@Serializable
data class BalanceCacheEnvelope(
    val savedAt: Long = 0L,
    val balance: WalletBalanceDto? = null,
)

object BalanceCacheStore {
    private const val TAG = "ZylodBalanceOverview"
    private const val PREFS = "zylod_config"
    const val KEY = "native_balance_overview_cache"

    fun read(context: Context): BalanceCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(BalanceCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "balance cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: BalanceCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(BalanceCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY, raw).apply()
        }.onFailure { Log.w(TAG, "balance cache write failed: ${it.message}") }
    }
}
