package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.LegalDocumentDto
import com.zylod.wholesale.data.api.LegalFaqItemDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * The two payment LEGAL surfaces' VMs (public api/legal routes — the web
 * payment-faq / payment-terms pages' REAL data sources; the pages are NOT
 * purely static copy, so they compose the same endpoints instead of
 * embedding constants). Both routes are PUBLIC (no Bearer required — the
 * shared client may send one, the routes ignore it), so there is NO sign-in
 * gate here: the honest states are loading / error / empty / offline.
 *
 * Offline cache: the last successful payloads (SharedPreferences
 * "zylod_config", "native_payment_faq_cache" / "native_payment_terms_cache"
 * — the FAQ cache is shared by both pages because the web pages compose the
 * SAME faq call) render with the offline banner on failure.
 */

/** The payment-FAQ VM — GET api/legal/faq?docType=payment_terms. */
data class PaymentFaqUiState(
    val loading: Boolean = true,
    val rows: List<LegalFaqItemDto> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible rows came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class PaymentFaqViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentFaqUiState())
    val state: StateFlow<PaymentFaqUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (initJob?.isActive == true) return
        _state.value = _state.value.copy(
            loading = _state.value.rows.isEmpty(),
            error = null,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch { fetchFaqs() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchFaqs() {
        try {
            Log.i(TAG, "fetch payment faqs")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).legalFaqs(docType = PAYMENT_TERMS_DOC_TYPE)
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load the Payment FAQ right now."
                Log.w(TAG, "payment faq error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "payment faqs loaded rows=${rows.size}")
            _state.value = PaymentFaqUiState(loading = false, rows = rows)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment faq fetch failed: ${e.message}")
            degrade("Could not load the Payment FAQ right now.")
        }
    }

    /** Failure path: saved rows cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.PAYMENT_FAQ, CachedPaymentFaqs.serializer())
        }
        val rows = cached?.rows.orEmpty()
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cached payment faqs")
            _state.value = PaymentFaqUiState(loading = false, rows = rows, offlineFromCache = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistCache(rows: List<LegalFaqItemDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.PAYMENT_FAQ,
                CachedPaymentFaqs.serializer(),
                CachedPaymentFaqs(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}

/** The payment-terms VM — GET api/legal/payment_terms + the same FAQ call. */
data class PaymentTermsUiState(
    val loading: Boolean = true,
    val document: LegalDocumentDto? = null,
    val faqs: List<LegalFaqItemDto> = emptyList(),
    /** Load failure text (with Retry) — null when at least the doc loaded. */
    val error: String? = null,
    /** The visible document came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class PaymentTermsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PaymentTermsUiState())
    val state: StateFlow<PaymentTermsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (initJob?.isActive == true) return
        _state.value = _state.value.copy(
            loading = _state.value.document == null,
            error = null,
            offlineFromCache = false,
        )
        initJob = viewModelScope.launch {
            // The web page composes the SAME two endpoints; so does this.
            val faqsDeferred = async { fetchFaqs() }
            fetchDocument()
            faqsDeferred.await()
        }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchDocument() {
        try {
            Log.i(TAG, "fetch payment terms document")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).legalDocument(PAYMENT_TERMS_DOC_TYPE)
            val payload = response.body()
            val document = payload?.data?.document
            if (!response.isSuccessful || payload?.success != true || document == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "The payment terms document could not be loaded."
                Log.w(TAG, "payment terms error: $message")
                degradeDocument(message)
                return
            }
            Log.i(TAG, "payment terms loaded v${document.version}")
            _state.value = _state.value.copy(loading = false, document = document, error = null)
            persistCache(document)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment terms fetch failed: ${e.message}")
            degradeDocument("Could not reach the server to load the payment terms. Check your connection and refresh.")
        }
    }

    private suspend fun fetchFaqs() {
        try {
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).legalFaqs(docType = PAYMENT_TERMS_DOC_TYPE)
            val payload = response.body()
            val rows = payload?.data
            if (!response.isSuccessful || payload?.success != true || rows == null) {
                // The FAQ section is secondary — a failure just hides it.
                Log.w(TAG, "payment terms faq error (http=${response.code()})")
                return
            }
            _state.value = _state.value.copy(faqs = rows)
            persistFaqCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "payment terms faq fetch failed: ${e.message}")
        }
    }

    /** Failure path: saved document cache; with none, the honest error card. */
    private suspend fun degradeDocument(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.PAYMENT_TERMS, CachedPaymentTermsDocument.serializer())
        }
        val document = cached?.document
        if (document != null) {
            Log.i(TAG, "degrade → cached payment terms")
            _state.value = _state.value.copy(loading = false, document = document, offlineFromCache = true)
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    private fun persistCache(document: LegalDocumentDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.PAYMENT_TERMS,
                CachedPaymentTermsDocument.serializer(),
                CachedPaymentTermsDocument(document = document),
            )
        }
    }

    private fun persistFaqCache(rows: List<LegalFaqItemDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.PAYMENT_FAQ,
                CachedPaymentFaqs.serializer(),
                CachedPaymentFaqs(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}

/** The docType both payment legal pages query (payment-faq-page.tsx:16). */
const val PAYMENT_TERMS_DOC_TYPE = "payment_terms"
