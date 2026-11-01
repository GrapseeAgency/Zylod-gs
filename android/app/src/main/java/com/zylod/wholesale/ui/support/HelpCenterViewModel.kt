package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportPublicApi
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

/**
 * Helpdesk VM — the three payloads the web help-center-page.tsx pulls, as
 * the record for the native "helpdesk" pageId:
 *
 *  1. GET api/support/faqs (the web's ?limit=4 is ignored by the handler —
 *     the web renders EVERY row that arrives, and so does this screen).
 *  2. GET api/support/status — the System Status banner (failure → the
 *     banner is simply absent, web parity).
 *  3. GET api/settings/public via [load]'s third call — the REAL
 *     owner-published support.email / support.phone ("Reach the Team"
 *     card). String primitives only (the web pickStringRecord behavior);
 *     a failed settings fetch renders the web's honest
 *     "could not be loaded" line, an EMPTY registry renders the honest
 *     "No support contact published yet" line — never a fabricated
 *     address or phone number.
 *
 * PUBLIC routes: no sign-in gate. FAQ failure keeps the rest of the page
 * alive with the web's verbatim error line under the Top FAQs header.
 */
data class HelpCenterUiState(
    /** FAQ + status resolve (the Reach-the-Team card has its own flag). */
    val loading: Boolean = true,
    /** The REAL faq rows for the Top FAQs card (server order). */
    val popularFaqs: List<FaqRow> = emptyList(),
    /** `FAQs are unavailable right now (HTTP n).` — web verbatim. */
    val faqLoadError: String? = null,
    /** Null → the System Status banner does not render (web parity). */
    val statusOverall: String? = null,
    /** GET api/settings/public resolve. */
    val contactsLoading: Boolean = true,
    /** settings["support.email"] / settings["support.phone"] (strings only). */
    val supportEmail: String = "",
    val supportPhone: String = "",
    /** True → the honest "could not be loaded" line (web contactsError). */
    val contactsError: Boolean = false,
    /** The hero search field (web searchQuery). */
    val searchQuery: String = "",
) {
    /** Web hasPublishedContact — only what the owner actually published. */
    val hasPublishedContact: Boolean get() = supportEmail.isNotEmpty() || supportPhone.isNotEmpty()
}

class HelpCenterViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(HelpCenterUiState())
    val state: StateFlow<HelpCenterUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve (called on EVERY entry; three parallel public GETs). */
    fun load() {
        loadJob?.cancel()
        _state.update {
            it.copy(loading = true, faqLoadError = null, contactsLoading = true, contactsError = false)
        }
        loadJob = viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api = ApiClient.supportPublicApi(base)
                coroutineScope {
                    val faqsCall = async { fetchFaqs(api) }
                    val statusCall = async { fetchStatus(api) }
                    val settingsCall = async { fetchSettings(api) }
                    faqsCall.await()
                    statusCall.await()
                    settingsCall.await()
                }
                _state.update { it.copy(loading = false) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "helpdesk load failed: ${e.message}")
                _state.update { it.copy(loading = false) }
            }
        }
    }

    /** Search input only — the submit itself jumps to docs-search-results. */
    fun setSearch(query: String) {
        _state.update { it.copy(searchQuery = query) }
    }

    /** The web submit guard: blank queries never navigate. */
    fun searchQueryOrEmpty(): String = _state.value.searchQuery.trim()

    private suspend fun fetchFaqs(api: SupportPublicApi) {
        try {
            val response = api.faqs()
            val payload = response.body()
            if (!response.isSuccessful || payload?.success != true) {
                val message = "FAQs are unavailable right now (HTTP ${response.code()})."
                Log.w(TAG, "helpdesk faqs error: $message")
                _state.update { it.copy(faqLoadError = message) }
                return
            }
            val rows = payload?.data.orEmpty().map { it.toRow() }
            _state.update { it.copy(popularFaqs = rows) }
        } catch (e: Exception) {
            Log.w(TAG, "helpdesk faqs fetch failed: ${e.message}")
            _state.update {
                it.copy(faqLoadError = "Network error while loading FAQs. Check your connection and retry.")
            }
        }
    }

    private suspend fun fetchStatus(api: SupportPublicApi) {
        try {
            val response = api.status()
            val payload = response.body()
            val data = payload?.data?.takeIf { response.isSuccessful && payload?.success == true }
            if (data != null) {
                _state.update { it.copy(statusOverall = data.overallStatus?.takeIf(String::isNotBlank)) }
                withContext(Dispatchers.IO) {
                    SupportPublicCacheStore.write(
                        appContext,
                        SupportPublicCacheKeys.STATUS,
                        CachedSupportStatus.serializer(),
                        // Read-modify-write: the diagnostics half belongs to
                        // the service-status screen sharing this snapshot.
                        (SupportPublicCacheStore.read(
                            appContext,
                            SupportPublicCacheKeys.STATUS,
                            CachedSupportStatus.serializer(),
                        ) ?: CachedSupportStatus()).copy(status = data),
                    )
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "helpdesk status fetch failed: ${e.message}")
        }
    }

    private suspend fun fetchSettings(api: SupportPublicApi) {
        try {
            val response = api.publicSettings()
            val payload = response.body()
            val data = payload?.data?.takeIf { response.isSuccessful && payload?.success == true }
            if (data == null) {
                Log.w(TAG, "helpdesk settings error: HTTP ${response.code()}")
                _state.update { it.copy(contactsLoading = false, contactsError = true) }
                return
            }
            val email = data.settings.stringSetting("support.email")
            val phone = data.settings.stringSetting("support.phone")
            _state.update {
                it.copy(contactsLoading = false, supportEmail = email, supportPhone = phone, contactsError = false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "helpdesk settings fetch failed: ${e.message}")
            _state.update { it.copy(contactsLoading = false, contactsError = true) }
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}

/**
 * The web pickStringRecord: keep ONLY string primitives from the wire map
 * (number/boolean registry values are dropped, never misrendered).
 */
internal fun Map<String, kotlinx.serialization.json.JsonElement>.stringSetting(key: String): String {
    val element = this[key] as? kotlinx.serialization.json.JsonPrimitive ?: return ""
    return if (element.isString) element.content else ""
}
