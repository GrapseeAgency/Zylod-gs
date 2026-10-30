package com.zylod.wholesale.ui.seller

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SellerDashboardEnvelope
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Native Seller Dashboard VM — GET api/supplier/dashboard (+ api/supplier/
 * orders for the recent-orders rail), the REAL seller endpoints verified in
 * src/app/api/supplier/{dashboard,orders}/route.ts (RouteOwnership ownership
 * row: pageId "seller-dashboard" renders natively).
 *
 *  - BOTH calls fly in parallel; the dashboard is the payload of record and
 *    the orders list only ENRICHES the recent-orders rail (buyer, payment
 *    status, parent orderId). An orders failure is not a screen failure —
 *    the dashboard's own recentSubOrders render instead (same rows, less
 *    detail), mirroring the web seller dashboard.
 *  - NOT-SELLER (OrdersViewModel needsAuth convention): every handler is
 *    requireUserType(['supplier','admin']) — a 401/403 means a real
 *    end-of-session or a buyer account (the shared OkHttp authenticator has
 *    already attempted one token refresh by then) → the honest
 *    not-seller state, never fabricated stats.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    data survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_seller_dashboard_cache",
 *    written after EVERY successful dashboard pull as the wire envelope
 *    JSON) — and the state flips to `offline` so the screen shows its saved
 *    data banner. With nothing renderable at all: the honest first-launch
 *    offline state (error != null), never a blank screen.
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner — the fetch replaces it in place.
 */
data class SellerDashboardUiState(
    val loading: Boolean = true,
    val content: SellerDashboardContent? = null,
    /** The visible data is SAVED (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** 401/403: signed-out or non-seller account — the screen's honest gate state. */
    val notSeller: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved dashboard). */
    val error: String? = null,
)

class SellerDashboardViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SellerDashboardUiState())
    val state: StateFlow<SellerDashboardUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /**
     * Entry pull / retry (DealsViewModel convention: called on EVERY entry —
     * the VM survives on the saved back stack, so stats that moved while the
     * user was elsewhere appear at once). Only a refresh already in flight
     * WITH data on screen is a no-op.
     */
    fun refresh() {
        val s = _state.value
        val hasData = s.content != null
        if (s.loading && hasData) return
        _state.value = s.copy(loading = !hasData, offline = false, notSeller = false, error = null)
        viewModelScope.launch { fetch() }
    }

    fun retry() = refresh()

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch seller dashboard")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.sellerApi(base)

            val (dashResponse, ordersResponse) = coroutineScope {
                val dash = async { api.dashboard() }
                val orders = async { api.orders() }
                dash.await() to orders.await()
            }

            // Honest seller gate: buyers/anonymous are 401, profile-less
            // sessions 403 — never render zeros as if they were real stats.
            if (dashResponse.code() == 401 || dashResponse.code() == 403) {
                Log.i(TAG, "not a seller session (http=${dashResponse.code()})")
                _state.value = SellerDashboardUiState(loading = false, notSeller = true)
                return
            }
            if (!dashResponse.isSuccessful) {
                val message = parseErrorBody(dashResponse.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your seller dashboard (HTTP ${dashResponse.code()})"
                Log.w(TAG, "dashboard error: $message")
                degrade(message)
                return
            }
            val body = dashResponse.body()
            val content = body?.takeIf { it.success }?.data?.toDomain()
            if (content == null) {
                degrade("Could not load your seller dashboard")
                return
            }

            // Best-effort enrichment: the orders endpoint's rows carry the
            // buyer, payment status and the parent orderId (t229). On any
            // failure the dashboard's recentSubOrders stand in.
            val enriched = ordersResponse.takeIf { it.isSuccessful }
                ?.body()?.takeIf { it.success }
                ?.orders?.map { it.toOrderRow() }
                ?.takeIf { it.isNotEmpty() }
                ?: content.recentOrders
            val merged = content.copy(recentOrders = enriched)

            _state.value = SellerDashboardUiState(loading = false, content = merged)
            persistCache(body)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading your dashboard. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory first,
     * then the saved cache; with neither, the first-launch offline state.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.content != null) {
            _state.value = _state.value.copy(loading = false, offline = true, error = null)
            return
        }
        val cached = withContext(Dispatchers.IO) { SellerDashboardCacheStore.read(appContext) }
        val data = cached?.data?.toDomain()
        if (data != null) {
            _state.value = SellerDashboardUiState(loading = false, content = data, offline = true)
        } else {
            _state.value = SellerDashboardUiState(loading = false, error = message)
        }
    }

    /** Persist the wire envelope JSON — the offline render matches the online one. */
    private fun persistCache(envelope: SellerDashboardEnvelope) {
        viewModelScope.launch(Dispatchers.IO) {
            SellerDashboardCacheStore.write(appContext, envelope)
        }
    }

    private companion object {
        const val TAG = "ZylodSeller"
    }
}

/**
 * On-device saved seller dashboard — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_seller_dashboard_cache". Payload = the last successful
 * api/supplier/dashboard envelope, so the offline render is byte-consistent
 * with the online one.
 */
object SellerDashboardCacheStore {
    private const val TAG = "ZylodSeller"
    private const val PREFS = "zylod_config"
    const val KEY = "native_seller_dashboard_cache"

    fun read(context: Context): SellerDashboardEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(SellerDashboardEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "seller dashboard cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: SellerDashboardEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(SellerDashboardEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "seller dashboard cache write failed: ${it.message}") }
    }
}
