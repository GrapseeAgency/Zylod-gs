package com.zylod.wholesale.ui.admin

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminDashboardDataDto
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ApiEnvelope
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
 * Native Admin Dashboard VM — GET api/admin/dashboard as the payload of
 * record, enriched by GET api/admin/users, GET api/admin/reports and GET
 * api/admin/orders (all four verified in the admin route handlers under
 * src/app/api/admin; RouteOwnership ownership row: pageId "admin-dashboard"
 * renders natively).
 *
 *  - ALL FOUR calls fly in parallel. The dashboard is the payload of record:
 *    its failure IS the screen's failure, while the users/reports/orders
 *    calls only ENRICH their sections (an enrichment failure falls back to
 *    the dashboard's own recentUsers/recentOrders rows — same rows, less
 *    detail — mirroring the web admin dashboard), mirroring the seller
 *    dashboard's orders-enrichment convention.
 *  - NOT-ADMIN (SellerDashboardViewModel auth-gate convention): every handler
 *    is requireUserType(['admin']) — a 401/403 means a real end-of-session or
 *    a buyer/supplier account (the shared OkHttp authenticator has already
 *    attempted one token refresh by then) → the honest notAdmin state, never
 *    fabricated stats.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable data
 *    survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_admin_dashboard_cache",
 *    written after EVERY successful dashboard pull as the wire envelope JSON)
 *    — and the state flips to `offline` so the screen shows its saved-data
 *    banner. With nothing renderable at all: the honest first-launch offline
 *    state (error not null), never a blank screen.
 *  - t216 silent refresh: a re-pull never blanks visible data behind a
 *    spinner — the fetch replaces it in place.
 */
data class AdminDashboardUiState(
    val loading: Boolean = true,
    val content: AdminDashboardContent? = null,
    /** The visible data is SAVED (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate state. */
    val notAdmin: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved dashboard). */
    val error: String? = null,
)

class AdminDashboardViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminDashboardUiState())
    val state: StateFlow<AdminDashboardUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /**
     * Entry pull / retry (SellerDashboardViewModel convention: called on EVERY
     * entry — the VM survives on the saved back stack, so stats that moved
     * while the user was elsewhere appear at once). Only a refresh already in
     * flight WITH data on screen is a no-op.
     */
    fun refresh() {
        val s = _state.value
        val hasData = s.content != null
        if (s.loading && hasData) return
        _state.value = s.copy(loading = !hasData, offline = false, notAdmin = false, error = null)
        viewModelScope.launch { fetch() }
    }

    fun retry() = refresh()

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch admin dashboard")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminApi(base)

            coroutineScope {
                val dashCall = async { api.dashboard() }
                val usersCall = async { api.users() }
                val reportsCall = async { api.reports() }
                val ordersCall = async { api.orders() }

                // Honest admin gate: signed-out callers are 401 and non-admin
                // sessions 403 on the dashboard handler — never render zeros
                // as if they were real platform stats.
                val dashResponse = dashCall.await()
                if (dashResponse.code() == 401 || dashResponse.code() == 403) {
                    Log.i(TAG, "not an admin session (http=${dashResponse.code()})")
                    _state.value = AdminDashboardUiState(loading = false, notAdmin = true)
                    return@coroutineScope
                }
                if (!dashResponse.isSuccessful) {
                    val message = parseErrorBody(dashResponse.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the admin dashboard (HTTP ${dashResponse.code()})"
                    Log.w(TAG, "dashboard error: $message")
                    degrade(message)
                    return@coroutineScope
                }
                val body = dashResponse.body()
                val content = body?.takeIf { it.success }?.toDomain()
                if (body == null || content == null) {
                    degrade("Could not load the admin dashboard")
                    return@coroutineScope
                }

                // Best-effort enrichment: the three list endpoints carry the
                // detail rows (profiles, moderation queue, derived fulfillment
                // status). On any failure — HTTP, envelope or thrown network
                // error — the dashboard's own recent rows stand in
                // (users/orders); reports simply renders its honest empty
                // state. An enrichment failure is never a screen failure,
                // which is why each await is wrapped, not left to the outer
                // catch that guards the dashboard payload of record.
                val users = runCatching { usersCall.await() }
                    .onFailure { Log.w(TAG, "users enrich failed: ${it.message}") }
                    .getOrNull()
                    ?.takeIf { it.isSuccessful }?.body()?.takeIf { it.success }?.toUserRows()
                val reports = runCatching { reportsCall.await() }
                    .onFailure { Log.w(TAG, "reports enrich failed: ${it.message}") }
                    .getOrNull()
                    ?.takeIf { it.isSuccessful }?.body()?.takeIf { it.success }?.toReportRows()
                val orders = runCatching { ordersCall.await() }
                    .onFailure { Log.w(TAG, "orders enrich failed: ${it.message}") }
                    .getOrNull()
                    ?.takeIf { it.isSuccessful }?.body()?.takeIf { it.success }?.toOrderRows()

                val merged = content.copy(
                    users = users?.takeIf { it.isNotEmpty() } ?: content.users,
                    reports = reports?.takeIf { it.isNotEmpty() } ?: content.reports,
                    orders = orders?.takeIf { it.isNotEmpty() } ?: content.orders,
                )

                _state.value = AdminDashboardUiState(loading = false, content = merged)
                persistCache(body)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading the admin dashboard. Check your connection and retry.")
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
        val cached = withContext(Dispatchers.IO) { AdminDashboardCacheStore.read(appContext) }
        val data = cached?.toDomain()
        if (data != null) {
            _state.value = AdminDashboardUiState(loading = false, content = data, offline = true)
        } else {
            _state.value = AdminDashboardUiState(loading = false, error = message)
        }
    }

    /** Persist the wire envelope JSON — the offline render matches the online one. */
    private fun persistCache(envelope: ApiEnvelope<AdminDashboardDataDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            AdminDashboardCacheStore.write(appContext, envelope)
        }
    }

    private companion object {
        const val TAG = "ZylodAdmin"
    }
}

/**
 * On-device saved admin dashboard — the SAME prefs file the rest of the
 * native shell uses (zylod_config), under the owner-fixed key
 * "native_admin_dashboard_cache". Payload = the last successful
 * api/admin/dashboard envelope, so the offline render is byte-consistent
 * with the online one.
 */
object AdminDashboardCacheStore {
    private const val TAG = "ZylodAdmin"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_dashboard_cache"

    fun read(context: Context): ApiEnvelope<AdminDashboardDataDto>? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(ApiEnvelope.serializer(AdminDashboardDataDto.serializer()), raw)
    }.onFailure { Log.w(TAG, "admin dashboard cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: ApiEnvelope<AdminDashboardDataDto>) {
        runCatching {
            val raw = ApiClient.json.encodeToString(
                ApiEnvelope.serializer(AdminDashboardDataDto.serializer()),
                envelope,
            )
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "admin dashboard cache write failed: ${it.message}") }
    }
}
