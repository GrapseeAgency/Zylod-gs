package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportFeedbackBody
import com.zylod.wholesale.data.api.SupportFeedbackItemDto
import com.zylod.wholesale.data.api.parseErrorBody
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Feedback VM — GET + POST api/support/feedback as the record for the
 * native "feedback-page" pageId (feedback-suggestions-page.tsx ported
 * 1:1):
 *
 *  - GET ?type= (limit 20, the route's default) — the community wall with
 *    the four filter pills; a filter change REFETCHES (web parity), the
 *    "all" pill omits the param. The rows are the route's select
 *    projection — NO submitter identity columns exist to leak.
 *  - POST { type, subject, description, rating } — the Share Idea modal.
 *    The web form carries its constant default rating: 5 (the web modal
 *    has NO rating input either — ported verbatim, documented here so the
 *    constant is never mistaken for a user choice). pageContext is
 *    omitted — the route applies its own 'feedback-page' default.
 *  - VALIDATION: the route's 400 contract (type/subject/description) is
 *    gated client-side with the server's verbatim error string;
 *    401/403 → the web's "signed-in account" line; other failures → the
 *    server's `{ error }` verbatim or the web fallback with the HTTP
 *    code; network → the web's network line.
 *  - SUCCESS: the "Feedback Submitted!" state, then — after the web's
 *    1.2s pause — the modal closes, the form resets and the wall refetches
 *    so the new REAL row appears.
 *  - LOAD FAILURE: honest error card + Retry with the web's verbatim
 *    messages (empty wall renders the web's empty card, never filler).
 *
 * PUBLIC route (optional auth — guests can post; userId attaches when a
 * session exists): no sign-in gate, like the web.
 */
data class FeedbackRow(
    /** Stable LazyColumn key (feedback id, hash fallback). */
    val key: String,
    val type: String,
    /** type.replace('_', ' ') — the web's badge label. */
    val typeLabel: String,
    val subject: String,
    val description: String,
    /** Present → the amber "n.0" star chip (web parity). */
    val rating: Int?,
    /** toLocaleDateString equivalent (medium date, US locale). */
    val dateLabel: String,
)

data class FeedbackUiState(
    val loading: Boolean = true,
    val items: List<FeedbackRow> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val loadError: String? = null,
    /** Selected filter pill ("all" | the three type values). */
    val typeFilter: String = "all",
    /** The Share Idea modal (web showSubmitModal). */
    val showSubmitModal: Boolean = false,
    val formType: String = "feature_request",
    val formSubject: String = "",
    val formDescription: String = "",
    val submitting: Boolean = false,
    val submitted: Boolean = false,
    /** Real POST error line (server copy verbatim). */
    val submitError: String? = null,
) {
    /** Web hasAnyItems fork for the empty card. */
    val hasItems: Boolean get() = items.isNotEmpty()
}

class FeedbackViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(FeedbackUiState())
    val state: StateFlow<FeedbackUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null
    private var submitJob: Job? = null

    /** Entry resolve (called on EVERY entry). */
    fun load() {
        fetch()
    }

    /** Filter pill tap (web setTypeFilter → refetch). */
    fun setTypeFilter(value: String) {
        if (_state.value.typeFilter == value) return
        _state.update { it.copy(typeFilter = value, loading = true, loadError = null) }
        fetch()
    }

    fun retry() {
        _state.update { it.copy(loading = true, loadError = null) }
        fetch()
    }

    /* ── modal + form ─────────────────────────────────────────────────── */

    fun openModal() = _state.update {
        it.copy(showSubmitModal = true, submitted = false, submitError = null)
    }

    fun closeModal() = _state.update {
        it.copy(showSubmitModal = false, submitted = false, submitError = null)
    }

    fun setFormType(value: String) = _state.update { it.copy(formType = value, submitError = null) }
    fun setFormSubject(value: String) = _state.update { it.copy(formSubject = value, submitError = null) }
    fun setFormDescription(value: String) = _state.update { it.copy(formDescription = value, submitError = null) }

    /** Web modal defaults — the exact reset formData. */
    private fun resetForm() = _state.update {
        it.copy(formType = "feature_request", formSubject = "", formDescription = "")
    }

    /**
     * Submit — client-side required gate first (the route's own 400 text),
     * the submitting flag guards a double post, and success runs the web's
     * exact 1.2s success pause before closing + refetching the wall.
     */
    fun submit() {
        val current = _state.value
        if (current.submitting) return
        val missing = current.formType.isBlank() ||
            current.formSubject.isBlank() ||
            current.formDescription.isBlank()
        if (missing) {
            _state.update { it.copy(submitError = "Type, subject, and description are required") }
            return
        }
        _state.update { it.copy(submitting = true, submitError = null) }
        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).submitFeedback(
                    SupportFeedbackBody(
                        type = current.formType,
                        subject = current.formSubject.trim(),
                        description = current.formDescription.trim(),
                        // The web form's constant default 5 — ported verbatim.
                        rating = 5,
                    ),
                )
                val payload = response.body()
                when {
                    response.isSuccessful && payload?.success == true -> {
                        Log.i(TAG, "feedback submitted pageId=$pageId")
                        _state.update { it.copy(submitting = false, submitted = true) }
                        // Web: setTimeout 1200ms → close + reset + refetch.
                        delay(1200)
                        _state.update { it.copy(showSubmitModal = false, submitted = false) }
                        resetForm()
                        fetch()
                    }
                    response.code() == 401 || response.code() == 403 -> {
                        _state.update {
                            it.copy(
                                submitting = false,
                                submitError = "Posting feedback requires a signed-in account. Please sign in and try again.",
                            )
                        }
                    }
                    else -> {
                        val message = parseErrorBody(response.errorBody()).error
                            ?.takeIf(String::isNotBlank)
                            ?: "Your feedback could not be posted (HTTP ${response.code()}). Please try again."
                        Log.w(TAG, "feedback submit failed: $message")
                        _state.update { it.copy(submitting = false, submitError = message) }
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "feedback submit network failed: ${e.message}")
                _state.update {
                    it.copy(submitting = false, submitError = "Network error while posting feedback. Check your connection and retry.")
                }
            }
        }
    }

    private fun fetch() {
        fetchJob?.cancel()
        fetchJob = viewModelScope.launch {
            try {
                val type = _state.value.typeFilter
                Log.i(TAG, "fetch feedback pageId=$pageId type=$type")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base)
                    .feedback(type = type.takeUnless { it == "all" })
                val payload = response.body()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = "Could not load feedback right now (HTTP ${response.code()}) — please try again later."
                    Log.w(TAG, "feedback load error: $message")
                    _state.update { it.copy(loading = false, loadError = message) }
                    return@launch
                }
                val rows = payload?.data.orEmpty().map { it.toRow() }
                Log.i(TAG, "feedback loaded rows=${rows.size}")
                _state.update { it.copy(loading = false, items = rows, loadError = null) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "feedback fetch failed: ${e.message}")
                _state.update {
                    it.copy(
                        loading = false,
                        loadError = "Network error while loading feedback. Check your connection and retry.",
                    )
                }
            }
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}

/* ─── mappers + constants (the web page's exact projections) ─────────────── */

/** Wire row → render row (the community-wall card projection). */
internal fun SupportFeedbackItemDto.toRow() = FeedbackRow(
    key = stableKey,
    type = type.orEmpty(),
    typeLabel = type.orEmpty().replace('_', ' '),
    subject = subject.orEmpty(),
    description = description.orEmpty(),
    rating = rating?.takeIf { it > 0 },
    dateLabel = feedbackDateLabel(createdAt),
)

/** new Date(createdAt).toLocaleDateString() equivalent (medium, US). */
internal fun feedbackDateLabel(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { feedbackIsoParser.parse(iso.take(19)) }.getOrNull()
        ?: return ""
    return DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.US).format(parsed)
}

/** The web filter pills — verbatim values and labels. */
internal data class FeedbackFilter(val value: String, val label: String)

internal val FEEDBACK_FILTERS = listOf(
    FeedbackFilter("all", "All Ideas"),
    FeedbackFilter("feature_request", "Feature Request"),
    FeedbackFilter("suggestion", "Improvement"),
    FeedbackFilter("general_feedback", "General Experience"),
)

/** The web modal's <select> — the three REAL type values, verbatim labels. */
internal val FEEDBACK_TYPES = listOf(
    "feature_request" to "Feature Request",
    "suggestion" to "Workflow Improvement",
    "general_feedback" to "General Feedback",
)

private val feedbackIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}
