package com.zylod.wholesale.ui.adminops

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.AdminOpsDeliveryAssignment
import com.zylod.wholesale.data.api.AdminOpsDriverAccount
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * t265 — Admin Deliveries VM (pageId "admin-deliveries"). There is NO
 * deliveries/route.ts — the listing surfaces are the TWO sub-endpoints, so
 * this VM pulls BOTH and renders a two-section screen:
 *
 *  - GET api/admin/deliveries/assignments — the driver-assignment history
 *    (subOrder ↔ driver rows, newest first, take 100; assignments/route.ts).
 *  - GET api/admin/deliveries/drivers — the driver ACCOUNT list (userType
 *    'driver', newest first, take 100; drivers/route.ts).
 *
 * Both handlers are requireUserType(['admin']); a 401/403 from either is the
 * honest not-admin gate. Both must succeed for Content — a failure on either
 * degrades the whole payload (in-memory first, then the saved cache under
 * "zylod_config"/"native_admin_ops_admin-deliveries_cache", written ONLY
 * after a successful pull with at least one row) — never a half-rendered
 * screen presented as live truth. t216 silent refresh keeps visible data.
 */
data class AdminDeliveriesUiState(
    val loading: Boolean = true,
    /** A silent re-pull with rows already on screen (no spinner swap). */
    val refreshing: Boolean = false,
    val assignments: List<AdminOpsDeliveryAssignment> = emptyList(),
    val drivers: List<AdminOpsDriverAccount> = emptyList(),
    /** Set only when nothing is renderable (no network AND no saved rows). */
    val error: String? = null,
    /** The visible rows are the last LIVE fetch, connection lost since. */
    val offline: Boolean = false,
    /** The visible rows came from the saved disk cache (first load offline). */
    val offlineFromCache: Boolean = false,
    /** 401/403: signed-out or non-admin account — the screen's honest gate. */
    val notAdmin: Boolean = false,
)

class AdminDeliveriesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(AdminDeliveriesUiState())
    val state: StateFlow<AdminDeliveriesUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry — called on EVERY entry (the VM survives back stack). */
    fun refresh() {
        if (fetchJob?.isActive == true) return
        startLoad()
    }

    fun retry() = refresh()

    private fun startLoad() {
        fetchJob?.cancel()
        val hasRows = _state.value.assignments.isNotEmpty() || _state.value.drivers.isNotEmpty()
        _state.update {
            it.copy(
                loading = !hasRows,
                refreshing = hasRows,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
        }
        fetchJob = viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch delivery assignments + drivers")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val api = ApiClient.adminOpsApi(base)
            // Both lists in parallel — the screen renders them as sections of
            // ONE payload, so one combined result state.
            val (assignmentsResp, driversResp) = coroutineScope {
                val assignmentsCall = async { api.deliveryAssignments() }
                val driversCall = async { api.deliveryDrivers() }
                assignmentsCall.await() to driversCall.await()
            }
            // Honest admin gate: either handler refusing the session ends it.
            if (assignmentsResp.code() == 401 || assignmentsResp.code() == 403 ||
                driversResp.code() == 401 || driversResp.code() == 403
            ) {
                Log.i(TAG, "not an admin session (http assignments=${assignmentsResp.code()} drivers=${driversResp.code()})")
                _state.value = AdminDeliveriesUiState(loading = false, notAdmin = true)
                return
            }
            if (!assignmentsResp.isSuccessful || !driversResp.isSuccessful) {
                val code = if (!assignmentsResp.isSuccessful) assignmentsResp.code() else driversResp.code()
                val message = parseErrorBody(
                    if (!assignmentsResp.isSuccessful) assignmentsResp.errorBody() else driversResp.errorBody(),
                ).error?.takeIf(String::isNotBlank)
                    ?: "Could not load deliveries (HTTP $code)"
                Log.w(TAG, "deliveries error: $message")
                degrade(message)
                return
            }
            val assignments = assignmentsResp.body()?.assignments.orEmpty()
            val drivers = driversResp.body()?.drivers.orEmpty()
            _state.value = _state.value.copy(
                loading = false,
                refreshing = false,
                assignments = assignments,
                drivers = drivers,
                error = null,
                offline = false,
                offlineFromCache = false,
                notAdmin = false,
            )
            // Save cache ONLY on success with at least one row (wire DTOs —
            // the offline render maps through the same objects).
            if (assignments.isNotEmpty() || drivers.isNotEmpty()) {
                persistCache(assignments, drivers)
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "deliveries fetch failed: ${e.message}")
            degrade("Network error while loading deliveries. Check your connection and retry.")
        }
    }

    /**
     * Failure path: keep renderable data (banner state) — in-memory rows
     * first, then the saved cache; with neither, the first-launch offline
     * state. Rows are mapped on the MAIN thread after the IO cache read.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.assignments.isNotEmpty() || _state.value.drivers.isNotEmpty()) {
            _state.update {
                it.copy(loading = false, refreshing = false, offline = true, error = null)
            }
            return
        }
        val cached = withContext(Dispatchers.IO) { DeliveriesCacheStore.read(appContext) }
        if (cached != null && (cached.assignments.isNotEmpty() || cached.drivers.isNotEmpty())) {
            _state.value = AdminDeliveriesUiState(
                loading = false,
                assignments = cached.assignments,
                drivers = cached.drivers,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, refreshing = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the online one. */
    private fun persistCache(assignments: List<AdminOpsDeliveryAssignment>, drivers: List<AdminOpsDriverAccount>) {
        val payload = CachedDeliveriesPage(assignments = assignments, drivers = drivers)
        viewModelScope.launch(Dispatchers.IO) {
            DeliveriesCacheStore.write(appContext, payload)
        }
    }

    private companion object {
        const val TAG = "ZylodAdminOps"
    }
}

/** @Serializable page snapshot (dc74841 rule: every persisted type serializable). */
@Serializable
private data class CachedDeliveriesPage(
    val assignments: List<AdminOpsDeliveryAssignment> = emptyList(),
    val drivers: List<AdminOpsDriverAccount> = emptyList(),
)

/**
 * On-device saved delivery ops — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the owner-fixed key
 * "native_admin_ops_admin-deliveries_cache".
 */
private object DeliveriesCacheStore {
    private const val TAG = "ZylodAdminOps"
    private const val PREFS = "zylod_config"
    const val KEY = "native_admin_ops_admin-deliveries_cache"

    fun read(context: Context): CachedDeliveriesPage? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(CachedDeliveriesPage.serializer(), raw)
    }.onFailure { Log.w(TAG, "deliveries cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, page: CachedDeliveriesPage) {
        runCatching {
            val raw = ApiClient.json.encodeToString(CachedDeliveriesPage.serializer(), page)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "deliveries cache write failed: ${it.message}") }
    }
}
