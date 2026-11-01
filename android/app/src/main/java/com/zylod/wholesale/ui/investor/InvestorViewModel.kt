package com.zylod.wholesale.ui.investor

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.InvestorContactBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonPrimitive
import com.zylod.wholesale.ui.careers.CareersCacheKeys
import com.zylod.wholesale.ui.careers.CareersCacheStore
import com.zylod.wholesale.ui.careers.CachedInvestorDocs
import com.zylod.wholesale.ui.careers.InvestorUiState
import com.zylod.wholesale.ui.careers.InvestorContactUiState

/**
 * Investor relations VM — the record for the native "investor-relations"
 * AND "investor-presentation" pageIds (chunk-misc.ts:411 + :448 map them
 * onto investor-relations-page / investor-presentation-page, which BOTH
 * compose GET api/investor — the portal bare, the presentation page with
 * docType=investor_presentation). One pageId-keyed VM class serves both
 * delegates; each keeps its own instance via the viewModel key.
 *
 * Data truth: GET api/investor (PUBLIC, no rate limit) — every isPublished
 * investorDocuments row (no select: docType/title/fiscalYear/fiscalQ/
 * fileUrl/summary/... included) ordered fiscalYear DESC then publishedAt
 * DESC. The download affordance is an ACTION_VIEW on the row's REAL
 * fileUrl (http/https only) — the web's <a href={doc.fileUrl} download>.
 * The web rel-page swallows failures into an empty list; the native screen
 * degrades to the saved native_investor_cache snapshot with the offline
 * banner, else the honest error card + Retry (never a fake empty).
 *
 * support.email rides on the EXISTING SupportPublicApi publicSettings()
 * accessor (the t255 convention — never redeclared): the web's
 * usePublicSettings hook feeds the hero/empty copy's contact line, and the
 * native fetch is equally silent on failure (honest absence — the copy
 * falls back to the Help Center line exactly like the web).
 */
class InvestorViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    /** investor-presentation hits the route's own docType filter. */
    private val docTypeFilter: String? =
        if (pageId == PRESENTATION_PAGE) "investor_presentation" else null

    private val _state = MutableStateFlow(InvestorUiState())
    val state: StateFlow<InvestorUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve (called on EVERY entry — the web refetches on mount). */
    fun load() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchDocs()
        fetchSupportEmail()
    }

    /** The error card's Retry (same refetch). */
    fun retry() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchDocs()
        fetchSupportEmail()
    }

    private fun fetchDocs() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch investor docs pageId=$pageId docType=$docTypeFilter")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).investorDocs(docType = docTypeFilter)
                val payload = response.body()
                val data = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                if (data == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the investor documents (HTTP ${response.code()})."
                    Log.w(TAG, "investor docs error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "investor docs loaded rows=${data.documents.size}")
                _state.update {
                    it.copy(loading = false, documents = data.documents, error = null)
                }
                // Only the bare portal page owns the shared cache key — the
                // presentation page's filtered fetch must never clobber the
                // full portal snapshot (it DEGRADES from it instead).
                if (docTypeFilter == null) {
                    withContext(Dispatchers.IO) {
                        CareersCacheStore.write(
                            appContext,
                            CareersCacheKeys.INVESTOR,
                            CachedInvestorDocs.serializer(),
                            CachedInvestorDocs(documents = data.documents),
                        )
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "investor docs fetch failed: ${e.message}")
                degrade("Network error while loading the investor documents. Check your connection and retry.")
            }
        }
    }

    /** Failure: the saved snapshot (filtered for the presentation page). */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            CareersCacheStore.read(appContext, CareersCacheKeys.INVESTOR, CachedInvestorDocs.serializer())
        }
        val docs = cached?.documents.orEmpty().let { all ->
            if (docTypeFilter == null) all else all.filter { it.docType == docTypeFilter }
        }
        if (docs.isNotEmpty()) {
            Log.i(TAG, "investor docs degrade → cache rows=${docs.size}")
            _state.update {
                it.copy(loading = false, documents = docs, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, documents = emptyList(), error = message) }
        }
    }

    /**
     * The owner-published support.email (GET api/settings/public via the
     * t255 accessor). Silent on every failure — the copy branches on the
     * value's honest absence, exactly like the web hook's contract.
     */
    private fun fetchSupportEmail() {
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).publicSettings()
                val raw = response.body()?.data?.settings?.get("support.email")
                val email = (raw as? JsonPrimitive)?.takeIf { it.isString }?.content.orEmpty()
                Log.i(TAG, "public settings support.email present=${email.isNotBlank()}")
                if (email.isNotBlank()) {
                    _state.update { it.copy(supportEmail = email) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "public settings fetch failed (silent): ${e.message}")
            }
        }
    }

    private companion object {
        const val TAG = "ZylodInvestor"
        const val PRESENTATION_PAGE = "investor-presentation"
    }
}

/**
 * Investor contact VM — the record for the native "investor-contact"
 * pageId (chunk-misc.ts:449 → investor-contact-page.tsx).
 *
 * Data truth: POST api/investor/contact (PUBLIC, rate limit 5/min
 * 'investor-contact') with { name, email, phone?, company?, inquiryType,
 * message } — a plain destructure, NOT zod: name + email + inquiryType +
 * message are required (400 "name, email, inquiryType, and message are
 * required"), inquiryType checked against the route's list (400 "Invalid
 * inquiry type" — unreachable here: the form's six options are the web
 * select's own six, all in the route's valid list). 201 { success,
 * message: "Your investor inquiry has been received and saved for
 * review.", data: { inquiryId, ref: "IR-XXXXXXXX", submittedAt } }; 429
 * the shared Too-many-requests line. The web swallows failures silently —
 * the native surfaces the server's text verbatim (or the honest network
 * line), never a fake success. support.email rides on the t255 accessor
 * for the success card's urgent line. PUBLIC: works signed-out.
 */
class InvestorContactViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(InvestorContactUiState())
    val state: StateFlow<InvestorContactUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var submitJob: Job? = null

    /** Entry resolve — the form starts empty; only support.email is fetched. */
    fun load() {
        fetchSupportEmail()
    }

    fun setName(value: String) = _state.update {
        it.copy(name = value, error = null, successMessage = null, successRef = null)
    }

    fun setEmail(value: String) = _state.update {
        it.copy(email = value, error = null, successMessage = null, successRef = null)
    }

    fun setCompany(value: String) = _state.update { it.copy(company = value) }

    fun setInquiryType(value: String) = _state.update {
        it.copy(inquiryType = value, error = null, successMessage = null, successRef = null)
    }

    fun setMessage(value: String) = _state.update {
        it.copy(message = value, error = null, successMessage = null, successRef = null)
    }

    /**
     * Submit — client gate first (the route's own required set), then ONE
     * wire call (the submitting flag is set before the call and only
     * cleared when it settles, so a double tap can never double-post past
     * the 5/min window).
     */
    fun submit() {
        val current = _state.value
        if (current.submitting) return
        val name = current.name.trim()
        val email = current.email.trim()
        val message = current.message.trim()
        if (name.isEmpty() || email.isEmpty() || current.inquiryType.isBlank() || message.isEmpty()) {
            // The route's verbatim 400 text — the same fields it checks.
            _state.update { it.copy(error = "name, email, inquiryType, and message are required") }
            return
        }
        _state.update {
            it.copy(
                submitting = true,
                error = null,
                successMessage = null,
                successRef = null,
                name = name,
                email = email,
                message = message,
            )
        }
        submitJob?.cancel()
        submitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "investor contact submit pageId=$pageId type=${current.inquiryType}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.careersInvestorApi(base).submitInvestorContact(
                    InvestorContactBody(
                        name = name,
                        email = email,
                        inquiryType = current.inquiryType,
                        message = message,
                        company = current.company.trim().takeIf(String::isNotEmpty),
                    ),
                )
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "investor contact saved ref=${payload?.data?.ref}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            successMessage = payload?.message
                                ?.takeIf(String::isNotBlank)
                                ?: "Your investor inquiry has been received and saved for review.",
                            successRef = payload?.data?.ref,
                            error = null,
                        )
                    }
                } else {
                    // 400/429/500 carry { error } — the route's text verbatim.
                    val errorText = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: payload?.error?.takeIf(String::isNotBlank)
                        ?: "Submission failed. Please try again later."
                    Log.w(TAG, "investor contact error: $errorText")
                    _state.update { it.copy(submitting = false, error = errorText) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "investor contact network failed: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        error = "Network error — could not reach the investor contact desk. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /**
     * The owner-published support.email (GET api/settings/public via the
     * t255 accessor). Silent on every failure — the success card's urgent
     * line branches on the value's honest absence, exactly like the web.
     */
    private fun fetchSupportEmail() {
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).publicSettings()
                val raw = response.body()?.data?.settings?.get("support.email")
                val email = (raw as? JsonPrimitive)?.takeIf { it.isString }?.content.orEmpty()
                if (email.isNotBlank()) {
                    _state.update { it.copy(supportEmail = email) }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "public settings fetch failed (silent): ${e.message}")
            }
        }
    }

    private companion object {
        const val TAG = "ZylodInvestor"
    }
}
