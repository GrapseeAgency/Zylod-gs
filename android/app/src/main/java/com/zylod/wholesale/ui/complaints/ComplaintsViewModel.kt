package com.zylod.wholesale.ui.complaints

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ComplaintCreateBody
import com.zylod.wholesale.data.api.ComplaintDetailDto
import com.zylod.wholesale.data.api.ComplaintDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseComplaintError
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
import kotlinx.serialization.KSerializer

/**
 * Complaints-list VM — GET api/complaints (ComplaintsApi.complaints) as the
 * payload of record for the pageId-keyed complaints surface:
 *
 *  - buyer-complaints → the web BuyerComplaintsPage: the full list rows
 *    (category chip, status badge, filed timestamp, ref id, order context,
 *    description, resolution note), the expandable per-row evidence section
 *    (exactly what the web's EvidenceManager does — it re-reads the DETAIL
 *    route for the photo list) and the withdraw action on open rows.
 *  - dispute-center / disputes-page → the web DisputeCenterPage (the
 *    disputes-page pageId maps onto the SAME component in
 *    src/lib/page-chunks/chunk-misc.ts): the file-a-complaint form PLUS the
 *    compact recent list (no withdraw, no evidence — web parity).
 *
 *  - STATUS FILTER: the route's REAL contract — `status` is the zod enum
 *    (open|in_review|resolved|rejected|withdrawn|all) and is SKIPPED when
 *    "all"/absent. The web pages fetch '?take=100' with no status param;
 *    the native list adds the route's own chips because the route really
 *    supports the filter (t261 contract).
 *  - AUTH: no token → no call at all, the honest sign-in gate. 401 OR 403
 *    on the list → needsAuth (the web treats both as its gate); 401/403 on
 *    the submit → needsAuth + the route's verbatim error text.
 *  - OFFLINE (PaymentHistoryViewModel degrade convention): on failure the
 *    renderable rows survive — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config", "native_complaints_cache") ONLY
 *    when it was fetched under the SAME filter.
 *  - SUBMIT GUARDS mirror the web's client-side zod mirror exactly
 *    (dispute-center-page.tsx:146-157) — the route's verbatim 400 texts
 *    still surface when the server re-checks.
 */
class ComplaintsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ComplaintsUiState())
    val state: StateFlow<ComplaintsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var activeFilter = ComplaintsUiState.FILTER_ALL
    private var fetchInFlight = false
    private var loadJob: Job? = null
    private var evidenceJobs = mutableMapOf<String, Job>()

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state (PaymentHistoryViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry pull / retry (called on EVERY entry — guard doctrine holds). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, needsAuth = true)
            return
        }
        if (fetchInFlight) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            needsAuth = false,
            offline = false,
            filter = activeFilter,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as OrdersViewModel.retry() — screens may bind either name. */
    fun retry() = refresh()

    /**
     * Status chip tap — swaps the filter and re-fetches (the route filters
     * server-side by the exact status value; "all" is the skip token).
     * Same-filter taps are no-ops. The previous chip's in-flight fetch is
     * CANCELLED first (RfqListViewModel.setStatusFilter pattern): without
     * that, a slow "all" response can land after a fast "open" one and
     * overwrite the filtered rows while the chip says "Open".
     */
    fun setFilter(status: String) {
        if (status == activeFilter) return
        activeFilter = status
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, filter = activeFilter, needsAuth = true)
            return
        }
        loadJob?.cancel()
        _state.value = _state.value.copy(loading = _state.value.rows.isEmpty(), filter = activeFilter, error = null)
        loadJob = viewModelScope.launch { fetch() }
    }

    /* ─── file-a-complaint form (dispute-center family, web handlers 1:1) ── */

    fun setCategory(value: String) = _state.update { it.copy(category = value) }

    fun setTitle(value: String) = _state.update { it.copy(title = value) }

    fun setDescription(value: String) = _state.update { it.copy(description = value) }

    fun setOrderId(value: String) = _state.update { it.copy(orderId = value) }

    /** The web's inline confirmation card is consumed on dismiss. */
    fun consumeFiled() = _state.update { it.copy(filed = null) }

    /**
     * Files the complaint (POST api/complaints). Double-submit guard: the
     * button is disabled while [ComplaintsUiState.submitting] and a settled
     * success is a no-op — the route rate-limits at 10/5min. The client
     * guards mirror the web component's zod mirror VERBATIM; the server's
     * own 400/403/404 texts surface verbatim through
     * [parseComplaintError] (issues joined like the web joins them).
     */
    fun submitComplaint() {
        val s = _state.value
        if (s.submitting || s.filed != null) return
        val trimmedTitle = s.title.trim()
        val trimmedDescription = s.description.trim()
        val trimmedOrderId = s.orderId.trim()
        // Client-side mirror of the server's zod validation (the web's exact
        // three guards, dispute-center-page.tsx:146-157).
        if (s.category.isBlank()) {
            _state.update { it.copy(formError = "Select the category that best fits your complaint.") }
            return
        }
        if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
            _state.update { it.copy(formError = "Title must be between 3 and 120 characters.") }
            return
        }
        if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
            _state.update { it.copy(formError = "Description must be between 10 and 5000 characters.") }
            return
        }
        if (SessionManager.token() == null) {
            _state.update {
                it.copy(needsAuth = true, formError = "Sign in to file a complaint.")
            }
            return
        }
        _state.update { it.copy(submitting = true, formError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "file complaint cat=${s.category}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val body = ComplaintCreateBody(
                    category = s.category,
                    title = trimmedTitle,
                    description = trimmedDescription,
                    orderId = trimmedOrderId.takeIf(String::isNotBlank),
                )
                val response = ApiClient.complaintsApi(base).fileComplaint(body)
                if (response.code() == 401 || response.code() == 403) {
                    // Web parity: the gate AND the verbatim route text.
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Sign in to file a complaint."
                    Log.i(TAG, "submit rejected (http=${response.code()})")
                    _state.update { it.copy(submitting = false, needsAuth = true, formError = message) }
                    return@launch
                }
                val payload = response.body()
                val created = payload?.takeIf { response.isSuccessful && it.success }?.data
                if (created == null) {
                    val message = parseComplaintError(response.errorBody())
                        .displayMessage("Filing the complaint failed (HTTP ${response.code()})")
                    Log.w(TAG, "submit failed: $message")
                    _state.update { it.copy(submitting = false, formError = message) }
                    return@launch
                }
                Log.i(TAG, "complaint filed ${created.id.orEmpty().takeLast(8)}")
                _state.update {
                    it.copy(
                        submitting = false,
                        filed = created,
                        category = "",
                        title = "",
                        description = "",
                        orderId = "",
                    )
                }
                // The web background-refreshes the list right after a 201.
                refresh()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "submit failed: ${e.message}")
                _state.update {
                    it.copy(submitting = false, formError = "Network error while filing the complaint. Check your connection and retry.")
                }
            }
        }
    }

    /* ─── withdraw (buyer-complaints, owner-only / open-only) ─────────────── */

    /** Dialog dismiss — clears the dialog-local error with it (web parity). */
    fun closeWithdraw() = _state.update { it.copy(withdrawError = null) }

    /**
     * Confirms the withdrawal for the row the dialog is showing. The server
     * answers 409 with the REAL current status when the complaint is no
     * longer open, 403 for non-owners, 404 for unknown ids — every text
     * surfaces verbatim inside the dialog; the 200 message renders inline
     * after it closes.
     */
    fun confirmWithdraw(complaintId: String) {
        val s = _state.value
        if (s.withdrawing) return
        if (complaintId.isBlank()) return
        _state.update { it.copy(withdrawing = true, withdrawError = null) }
        viewModelScope.launch {
            try {
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
                _state.update { current ->
                    current.copy(
                        withdrawing = false,
                        withdrawMessage = payload.message?.takeIf(String::isNotBlank)
                            ?: "Complaint withdrawn.",
                        rows = current.rows.map { row ->
                            if (row.stableKey == updated.stableKey) updated else row
                        },
                    )
                }
                // The web background-refreshes after a successful withdraw.
                refresh()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "withdraw failed: ${e.message}")
                _state.update {
                    it.copy(withdrawing = false, withdrawError = "Network error while withdrawing the complaint. Check your connection and retry.")
                }
            }
        }
    }

    /** The inline withdraw-success note is consumed on dismiss. */
    fun consumeWithdrawMessage() = _state.update { it.copy(withdrawMessage = null) }

    /* ─── evidence sections (buyer-complaints rows, EvidenceManager parity) ─ */

    /**
     * Expands (or collapses) a row's evidence section. Expanding re-reads
     * GET api/complaints/{id} — the SAME owner-gated endpoint the web's
     * EvidenceManager fetches for the photo metadata; 401/403 surfaces the
     * component's own session note, other failures its verbatim error.
     */
    fun toggleEvidence(complaintId: String) {
        if (complaintId.isBlank()) return
        val existing = _state.value.evidence[complaintId]
        if (existing != null) {
            _state.update { it.copy(evidence = it.evidence - complaintId) }
            return
        }
        if (evidenceJobs[complaintId]?.isActive == true) return
        _state.update {
            it.copy(evidence = it.evidence + (complaintId to ComplaintEvidenceSection(loading = true)))
        }
        evidenceJobs[complaintId] = viewModelScope.launch {
            try {
                Log.i(TAG, "evidence fetch …${complaintId.takeLast(8)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.complaintsApi(base).complaintDetail(complaintId)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(
                            evidence = it.evidence + (complaintId to ComplaintEvidenceSection(
                                error = "Your session cannot view this evidence — sign in with the account that filed it.",
                            )),
                        )
                    }
                    return@launch
                }
                if (response.code() == 404) {
                    _state.update {
                        it.copy(
                            evidence = it.evidence + (complaintId to ComplaintEvidenceSection(
                                error = parseErrorBody(response.errorBody()).error
                                    ?.takeIf(String::isNotBlank)
                                    ?: "Complaint not found",
                            )),
                        )
                    }
                    return@launch
                }
                val payload = response.body()
                val detail = payload?.takeIf { response.isSuccessful && it.success }?.data
                if (detail == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Failed to load evidence photos (HTTP ${response.code()})"
                    _state.update {
                        it.copy(evidence = it.evidence + (complaintId to ComplaintEvidenceSection(error = message)))
                    }
                    return@launch
                }
                _state.update {
                    it.copy(
                        evidence = it.evidence + (complaintId to ComplaintEvidenceSection(
                            photos = detail.evidencePhotos,
                        )),
                    )
                }
                persistDetailCache(detail)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "evidence fetch failed: ${e.message}")
                _state.update {
                    it.copy(
                        evidence = it.evidence + (complaintId to ComplaintEvidenceSection(
                            error = "Network error while loading evidence photos. Check your connection and retry.",
                        )),
                    )
                }
            }
        }
    }

    /* ─── fetch / failure / cache ─────────────────────────────────────────── */

    private suspend fun fetch() {
        fetchInFlight = true
        try {
            Log.i(TAG, "fetch complaints filter=$activeFilter pageId=$pageId")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.complaintsApi(base).complaints(
                status = activeFilter.takeIf { it != ComplaintsUiState.FILTER_ALL },
            )
            if (response.code() == 401 || response.code() == 403) {
                // The web treats BOTH as its sign-in gate (buyer-complaints
                // checks 401 || 403 explicitly).
                Log.w(TAG, "complaints ${response.code()} — session gate")
                _state.value = _state.value.copy(loading = false, needsAuth = true)
                return
            }
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Failed to load your complaints (HTTP ${response.code()})"
                Log.w(TAG, "complaints error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "complaints loaded rows=${rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = rows,
                filter = activeFilter,
                error = null,
                refreshError = null,
                refreshing = false,
            )
            persistListCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "complaints fetch failed: ${e.message}")
            degrade("Network error while loading your complaints. Check your connection and retry.")
        } finally {
            fetchInFlight = false
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache ONLY when it was fetched under the same filter;
     * with neither, the honest error card.
     */
    private suspend fun degrade(message: String) {
        val s = _state.value
        if (s.rows.isNotEmpty()) {
            _state.value = s.copy(
                loading = false,
                offline = true,
                refreshing = false,
                refreshError = message,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) {
            ComplaintCacheStore.read(appContext, ComplaintCacheKeys.COMPLAINTS, serializer())
        }
        val usable = cached?.takeIf { it.filter == activeFilter && it.rows.isNotEmpty() }
        if (usable != null) {
            Log.i(TAG, "degrade → cache rows=${usable.rows.size}")
            _state.value = _state.value.copy(
                loading = false,
                rows = usable.rows,
                filter = activeFilter,
                offline = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun serializer(): KSerializer<CachedComplaintList> = CachedComplaintList.serializer()

    /** Persist the rows, tagged with the filter they belong to. */
    private fun persistListCache(rows: List<ComplaintDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            ComplaintCacheStore.write(
                appContext,
                ComplaintCacheKeys.COMPLAINTS,
                CachedComplaintList.serializer(),
                CachedComplaintList(rows = rows, filter = activeFilter),
            )
        }
    }

    /** Persist the detail snapshot (pinned to its complaint id) — evidence + detail reuse. */
    internal fun persistDetailCache(detail: ComplaintDetailDto) {
        val id = detail.id ?: return
        viewModelScope.launch(Dispatchers.IO) {
            ComplaintCacheStore.write(
                appContext,
                ComplaintCacheKeys.complaintDetail(id),
                CachedComplaintDetail.serializer(),
                CachedComplaintDetail(complaintId = id, detail = detail),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodComplaints"
    }
}
