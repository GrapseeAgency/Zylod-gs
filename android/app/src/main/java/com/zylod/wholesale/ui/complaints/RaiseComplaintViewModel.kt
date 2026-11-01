package com.zylod.wholesale.ui.complaints

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ReportProblemBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.support.stringSetting
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Raise-complaint VM — the payload of record for BOTH the raise-complaint
 * AND raise-dispute pageIds (they load the SAME web component,
 * raise-complaint-page.tsx — there is no separate dispute form on the web).
 *
 * DATA TRUTH (the web component's own honesty note, mirrored): this form
 * does NOT file a complaints row. It POSTs api/support/report-problem
 * (ComplaintsApi.reportProblem) — a feedbackSubmissions bug_report row —
 * with the web's EXACT body: { issueType: damaged|missing|specs|delay|
 * quality, subject: "Order complaint (<outcome>)" + " — order <id>" when
 * the entry query pinned one, description: the statement, pageContext:
 * 'raise-complaint' }. The claim-amount field the web renders for
 * refund/partial is display-only there and stays display-only here (the
 * web never sends it — mirrored 1:1, never "improved" into a fabricated
 * refund claim).
 *
 *  - ENTRY: the order target card resolves from the entry query
 *    (orderId= / id= / bare token) — no id renders the web's "No specific
 *    order attached" line.
 *  - SUPPORT EMAIL: the owner-published support.email (GET
 *    api/settings/public) shapes the error/evidence copy exactly like the
 *    web component; absent → the generic Help-Center wording, never an
 *    invented address.
 *  - AUTH: the route accepts guests, but the web treats 401/403 as its
 *    AccountGate ("Sign in to raise a complaint") — mirrored. Success
 *    shows the REAL saved reference (the feedbackSubmissions id) and the
 *    web's own next-steps copy; no fake case ids, no escrow claims.
 *  - NO OFFLINE CACHE: a form surface with no read endpoint — there is
 *    nothing honest to cache (the web caches nothing either).
 */
class RaiseComplaintViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(RaiseComplaintUiState())
    val state: StateFlow<RaiseComplaintUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var lastQuery: String = ""

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(entryQuery: String? = null) {
        if (entryQuery != null) lastQuery = entryQuery
        val orderId = raiseOrderIdFromQuery(lastQuery).orEmpty()
        _state.update {
            it.copy(orderId = orderId, sessionExpired = false, errorMsg = null)
        }
        fetchSupportEmail()
    }

    /* ─── form edits (web handlers, 1:1) ─────────────────────────────────── */

    fun setComplaintType(value: String) =
        _state.update { it.copy(complaintType = value) }

    fun setDesiredOutcome(value: String) =
        _state.update { it.copy(desiredOutcome = value) }

    fun setRefundAmount(value: String) =
        _state.update { it.copy(refundAmount = value) }

    fun setStatement(value: String) =
        _state.update { it.copy(statement = value) }

    /**
     * Submits the report-problem POST. The web's only client guard is the
     * disabled-until-nonblank statement (the compose below mirrors it);
     * the server's verbatim 400/429 texts surface otherwise. Double-submit
     * guard: the button is disabled while submitting.
     */
    fun submit() {
        val s = _state.value
        if (s.submitting || s.submitted) return
        if (s.statement.trim().isBlank()) return // the web's disabled-submit guard
        _state.update { it.copy(submitting = true, errorMsg = null) }
        viewModelScope.launch {
            try {
                val outcome = s.desiredOutcome
                val composedSubject = buildString {
                    append("Order complaint (")
                    append(outcome)
                    append(")")
                    if (s.orderId.isNotBlank()) append(" — order ${s.orderId}")
                }
                Log.i(TAG, "submit report-problem type=${s.complaintType}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.complaintsApi(base).reportProblem(
                    ReportProblemBody(
                        issueType = s.complaintType,
                        subject = composedSubject,
                        description = s.statement.trim(),
                        pageContext = PAGE_CONTEXT,
                    ),
                )
                if (response.code() == 401 || response.code() == 403) {
                    // Web parity: the AccountGate, never a fake "complaint saved".
                    Log.i(TAG, "report rejected (http=${response.code()}) — session gate")
                    _state.update { it.copy(submitting = false, sessionExpired = true) }
                    return@launch
                }
                val payload = response.body()
                val reference = payload?.data?.id
                    ?.takeIf { response.isSuccessful && payload.success && it.isNotBlank() }
                if (reference == null) {
                    val serverMessage = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                    val message = serverMessage
                        ?: s.supportEmail.takeIf(String::isNotBlank)?.let {
                            "Failed to submit complaint. Please try again or email $it."
                        }
                        ?: "Failed to submit complaint. Please try again or reach us through the Help Center."
                    Log.w(TAG, "report failed: $message")
                    _state.update { it.copy(submitting = false, errorMsg = message) }
                    return@launch
                }
                Log.i(TAG, "report saved ref …${reference.takeLast(8)}")
                _state.update { it.copy(submitting = false, submitted = true, reference = reference) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "report failed: ${e.message}")
                val s2 = _state.value
                val message = s2.supportEmail.takeIf(String::isNotBlank)?.let {
                    "Network error. Please try again or email $it."
                } ?: "Network error. Please try again or reach us through the Help Center."
                _state.update { it.copy(submitting = false, errorMsg = message) }
            }
        }
    }

    /* ─── helpers ────────────────────────────────────────────────────────── */

    /**
     * GET api/settings/public — the owner-published support.email the web
     * component reads via usePublicSettings. Best-effort: a failure leaves
     * the generic wording (the web's exact fallback), never a fabricated
     * address.
     */
    private fun fetchSupportEmail() {
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).publicSettings()
                val email = response.body()
                    ?.takeIf { response.isSuccessful && it.success }
                    ?.data
                    ?.settings
                    ?.stringSetting("support.email")
                    .orEmpty()
                if (email.isNotBlank()) {
                    Log.i(TAG, "support.email published")
                }
                _state.update { it.copy(supportEmail = email) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "support email fetch failed: ${e.message}")
                // Generic wording stays — the web's own fallback.
            }
        }
    }

    private companion object {
        const val TAG = "ZylodComplaints"

        /** The web component's fixed pageContext marker (verbatim). */
        const val PAGE_CONTEXT = "raise-complaint"
    }
}
