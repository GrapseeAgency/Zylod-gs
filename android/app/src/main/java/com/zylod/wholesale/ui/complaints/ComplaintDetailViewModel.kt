package com.zylod.wholesale.ui.complaints

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ComplaintDetailDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
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
 * Complaint-detail VM — GET api/complaints/[id] (ComplaintsApi.complaintDetail)
 * as the payload of record for the dispute-detail pageId, plus the owner's
 * withdraw action (POST api/complaints/[id]/withdraw).
 *
 * WEB TRUTH NOTE (documented deviation, no fabrication): the WEB
 * dispute-detail pageId itself renders a static "Disputes aren't connected
 * yet" placeholder — but the complaint-detail ROUTE is real and live (the
 * web's own buyer-complaints page consumes it for the per-row evidence
 * manager), and the withdraw route's semantics are exactly what the web
 * exposes on that page (owner-only, open-only, 409 with the real current
 * status otherwise). So the native dispute-detail composes the REAL route:
 * with a complaint id in the entry query it renders the actual record; with
 * NO id it renders the web's own static copy verbatim (the id-less truth of
 * this pageId) — never a fabricated case.
 *
 *  - ENTRY: [complaintIdFromQuery] ("complaintId=x" / "id=x" / bare token).
 *    NO id → hasId=false → the web's static page copy.
 *  - AUTH: no token → no call, the honest sign-in gate. 401 → the gate.
 *    403 → the route's verbatim "Not authorized to view this complaint".
 *  - 404 is a DEFINITIVE answer ("Complaint not found") — the honest card,
 *    never a cache of some other complaint.
 *  - OFFLINE (ReturnRequestViewModel degrade convention): on load failure
 *    the last snapshot for THIS complaint id survives — in-memory first,
 *    then the device-saved cache (SharedPreferences "zylod_config",
 *    "native_complaint_detail_cache_<id>") — and the state flips
 *    offlineFromCache. The cache is only usable when it was saved for the
 *    SAME complaint id.
 *  - WITHDRAW: the confirm dialog lives in the screen (BankAccounts
 *    pendingDelete pattern); the VM refuses double-fires, surfaces the
 *    409/403/404 texts VERBATIM, applies the server-serialized row on 200
 *    and carries the route's message for the inline result.
 */
class ComplaintDetailViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ComplaintDetailUiState())
    val state: StateFlow<ComplaintDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null
    private var withdrawJob: Job? = null
    private var lastQuery: String = ""

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (TrackOrderViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        if (initJob?.isActive == true) return
        val complaintId = complaintIdFromQuery(lastQuery)
        if (complaintId == null) {
            // Web parity: the pageId's own static copy for the id-less case —
            // never a fabricated fallback id.
            Log.i(TAG, "no complaintId in query — static page copy")
            _state.value = ComplaintDetailUiState(loading = false, hasId = false)
            return
        }
        if (SessionManager.token() == null) {
            _state.value = ComplaintDetailUiState(
                loading = false,
                hasId = true,
                complaintId = complaintId,
                needsAuth = true,
            )
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.complaintId != complaintId || it.detail == null,
                hasId = true,
                complaintId = complaintId,
                error = null,
                notFound = false,
                forbiddenMessage = null,
                needsAuth = false,
                offlineFromCache = false,
                withdrawMessage = null,
                withdrawError = null,
            )
        }
        initJob = viewModelScope.launch { fetchDetail(complaintId) }
    }

    /** Error-card Retry — full re-fetch of the same complaint. */
    fun retry() {
        load()
    }

    /* ─── withdraw (owner-only, open-only — the route's real semantics) ──── */

    /** Dialog dismiss — clears the dialog-local error with it (web parity). */
    fun closeWithdraw() = _state.update { it.copy(withdrawError = null) }

    /** The inline withdraw-success note is consumed on dismiss. */
    fun consumeWithdrawMessage() = _state.update { it.copy(withdrawMessage = null) }

    /**
     * Confirms the withdrawal of THIS complaint. The server answers 409
     * with the REAL current status when review already started, 403 for
     * non-owners (admins included — the buyer owns this decision), 404 for
     * unknown ids — every text surfaces verbatim; the 200 message renders
     * inline and the detail swaps to the server-serialized withdrawn row.
     */
    fun confirmWithdraw() {
        val s = _state.value
        if (s.withdrawing || !s.hasId || s.complaintId.isBlank()) return
        if (s.detail?.status != "open") return // server-guarded transition; the client mirrors it
        withdrawJob?.cancel()
        _state.update { it.copy(withdrawing = true, withdrawError = null) }
        withdrawJob = viewModelScope.launch {
            try {
                val complaintId = s.complaintId
                Log.i(TAG, "withdraw …${complaintId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.complaintsApi(base).withdrawComplaint(complaintId)
                if (response.code() == 401) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Your session has ended — sign in again to withdraw this complaint."
                    Log.i(TAG, "withdraw rejected (http=401)")
                    _state.update { it.copy(withdrawing = false, withdrawError = message) }
                    return@launch
                }
                val payload = response.body()
                val updated = payload?.takeIf { response.isSuccessful && it.success }?.data
                if (updated == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Withdraw failed (HTTP ${response.code()})"
                    Log.w(TAG, "withdraw failed: $message")
                    _state.update { it.copy(withdrawing = false, withdrawError = message) }
                    return@launch
                }
                Log.i(TAG, "withdrawn status=${updated.status}")
                _state.update {
                    it.copy(
                        withdrawing = false,
                        withdrawMessage = payload.message?.takeIf(String::isNotBlank)
                            ?: "Complaint withdrawn.",
                        detail = it.detail?.copy(
                            status = updated.status,
                            updatedAt = updated.updatedAt ?: it.detail?.updatedAt,
                        ) ?: it.detail,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "withdraw failed: ${e.message}")
                _state.update {
                    it.copy(
                        withdrawing = false,
                        withdrawError = "Network error while withdrawing the complaint. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /* ─── fetch / failure / cache ─────────────────────────────────────────── */

    private suspend fun fetchDetail(complaintId: String) {
        try {
            Log.i(TAG, "fetch complaint …${complaintId.takeLast(8)}")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.complaintsApi(base).complaintDetail(complaintId)
            if (gateOn401(response.code())) return
            if (response.code() == 403) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Not authorized to view this complaint"
                Log.w(TAG, "complaint 403: $message")
                _state.update { it.copy(loading = false, forbiddenMessage = message) }
                return
            }
            if (response.code() == 404) {
                // Definitive answer (foreign/gone complaint) — honest card,
                // never a cache of some other complaint.
                Log.w(TAG, "complaint 404: Complaint not found")
                _state.update { it.copy(loading = false, notFound = true) }
                return
            }
            val payload = response.body()
            val detail = payload?.takeIf { response.isSuccessful && it.success }?.data
            if (detail == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load complaint (HTTP ${response.code()})."
                Log.w(TAG, "complaint error: $message")
                degrade(complaintId, message)
                return
            }
            Log.i(TAG, "complaint loaded evidence=${detail.evidencePhotos.size}")
            _state.value = ComplaintDetailUiState(
                loading = false,
                hasId = true,
                complaintId = complaintId,
                detail = detail,
            )
            persistCache(complaintId, detail)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "complaint fetch failed: ${e.message}")
            degrade(complaintId, "Network error while loading the complaint")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved detail
     * cache, ONLY when it was saved for this same complaint id; with none,
     * the honest error card. Mapped on the MAIN thread after the IO cache
     * read (the date formatter is a main-thread JVM helper).
     */
    private suspend fun degrade(complaintId: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            ComplaintCacheStore.read(
                appContext,
                ComplaintCacheKeys.complaintDetail(complaintId),
                CachedComplaintDetail.serializer(),
            )
        }
        val cachedDetail = cached?.detail?.takeIf { cached.complaintId == complaintId }
        if (cachedDetail != null) {
            Log.i(TAG, "degrade → cache evidence=${cachedDetail.evidencePhotos.size}")
            _state.value = ComplaintDetailUiState(
                loading = false,
                hasId = true,
                complaintId = complaintId,
                detail = cachedDetail,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(complaintId: String, detail: ComplaintDetailDto) {
        viewModelScope.launch(Dispatchers.IO) {
            ComplaintCacheStore.write(
                appContext,
                ComplaintCacheKeys.complaintDetail(complaintId),
                CachedComplaintDetail.serializer(),
                CachedComplaintDetail(complaintId = complaintId, detail = detail),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodComplaints"
    }
}
