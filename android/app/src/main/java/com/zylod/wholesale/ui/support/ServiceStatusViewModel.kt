package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportDiagnosticsEnvelope
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
 * Service-status VM — GET api/app/diagnostics (SupportPublicApi
 * .diagnostics) as the payload of record for BOTH native pageIds
 * "system-status" and "system-health" (the web SPA serves both ids from
 * the SAME service-status-page.tsx component, src/lib/page-chunks —
 * t254's pageId-keyed shared-screen pattern).
 *
 * WIRE FACT: the web status page calls /api/app/diagnostics, NOT
 * /api/support/status (that one feeds the helpdesk banner — both are
 * declared on SupportPublicApi). The diagnostics body is NOT enveloped:
 * success/status/latencyMs/metrics/services sit at the top level, and the
 * 500 failure keeps the same shape with success=false + status="degraded"
 * + error — handled as a real failure here (honest error card + Retry),
 * never a placeholder "Operational".
 *
 * PUBLIC route: no sign-in gate. FAILURE: honest error card + Retry, or
 * the saved snapshot ("native_support_status_cache", shared with the
 * helpdesk banner payload via read-modify-write) with the offline banner.
 */
data class ServiceStatusUiState(
    val loading: Boolean = true,
    /** The RAW diagnostics body — null while resolving / after a failure. */
    val data: SupportDiagnosticsEnvelope? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class ServiceStatusViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ServiceStatusUiState())
    val state: StateFlow<ServiceStatusUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var fetchJob: Job? = null

    /** Entry resolve (called on EVERY entry — the web's mount probe). */
    fun load() {
        fetch()
    }

    /** The web Re-probe button — a fresh live probe. */
    fun reprobe() {
        fetch()
    }

    private fun fetch() {
        fetchJob?.cancel()
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchJob = viewModelScope.launch {
            try {
                Log.i(TAG, "probe diagnostics pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).diagnostics()
                val body = response.body()
                if (!response.isSuccessful || body?.success != true) {
                    val message = body?.error?.takeIf(String::isNotBlank)
                        ?: "Live probes are unavailable right now (HTTP ${response.code()})."
                    Log.w(TAG, "diagnostics error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "diagnostics ok services=${body.services.size} latencyMs=${body.latencyMs}")
                _state.update {
                    it.copy(loading = false, data = body, error = null, offlineFromCache = false)
                }
                withContext(Dispatchers.IO) {
                    SupportPublicCacheStore.write(
                        appContext,
                        SupportPublicCacheKeys.STATUS,
                        CachedSupportStatus.serializer(),
                        // Read-modify-write: the status half belongs to the helpdesk.
                        (SupportPublicCacheStore.read(
                            appContext,
                            SupportPublicCacheKeys.STATUS,
                            CachedSupportStatus.serializer(),
                        ) ?: CachedSupportStatus()).copy(diagnostics = body),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "diagnostics probe failed: ${e.message}")
                degrade("Network error while probing the services. Check your connection and retry.")
            }
        }
    }

    /** Failure path: the saved probes with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            SupportPublicCacheStore.read(appContext, SupportPublicCacheKeys.STATUS, CachedSupportStatus.serializer())
        }
        val diagnostics = cached?.diagnostics
        if (diagnostics != null) {
            Log.i(TAG, "degrade → cached diagnostics services=${diagnostics.services.size}")
            _state.value = _state.value.copy(
                loading = false,
                data = diagnostics,
                error = null,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}
