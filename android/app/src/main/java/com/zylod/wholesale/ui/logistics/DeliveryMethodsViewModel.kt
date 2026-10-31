package com.zylod.wholesale.ui.logistics

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
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

/**
 * Delivery-methods VM — GET api/delivery-methods (PUBLIC, the
 * deliveryMethods table the admin configures) as the payload of record for
 * the delivery-options pageId, mirroring delivery-method-page.tsx exactly:
 *
 *  - PUBLIC: no auth gate — the shared client may attach a Bearer header
 *    and the route ignores it.
 *  - HONEST EMPTY: an unconfigured site is an empty list → the same amber
 *    "No delivery methods have been configured yet." card the web shows
 *    (never invented couriers or prices).
 *  - SELECTION: the first method is preselected (web parity); tapping a
 *    card re-selects; "Continue to Payment" only when a method is chosen.
 *  - OFFLINE (LiveChatViewModel degrade convention): on failure the last
 *    snapshot survives — device-saved cache (SharedPreferences
 *    "zylod_config", "native_logistics_methods_cache") — and the state
 *    flips offlineFromCache so the screen shows its saved-data banner.
 */
data class DeliveryMethodsUiState(
    /** First load (skeleton while true). */
    val loading: Boolean = true,
    val methods: List<DeliveryMethodRow> = emptyList(),
    /** The selected method's stable key ("" when nothing is selectable). */
    val selectedKey: String = "",
    /**
     * HTTP/network failure text OR the honest-empty message — the amber
     * card text exactly as the web loadError renders it.
     */
    val error: String? = null,
    /** The visible list came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class DeliveryMethodsViewModel(
    private val appContext: Context,
    @Suppress("UNUSED_PARAMETER") private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(DeliveryMethodsUiState())
    val state: StateFlow<DeliveryMethodsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load(@Suppress("UNUSED_PARAMETER") entryQuery: String? = null) {
        if (initJob?.isActive == true) return
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.methods.isEmpty(),
                error = null,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchMethods() }
    }

    /** Amber-card Retry — full re-fetch. */
    fun retry() {
        load()
    }

    fun select(key: String) {
        _state.update { it.copy(selectedKey = key) }
    }

    private suspend fun fetchMethods() {
        try {
            Log.i(TAG, "fetch delivery methods")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.logisticsApi(base).deliveryMethods()
            val body = response.body()
            val methods = body?.takeIf { response.isSuccessful && it.success }?.data.orEmpty()
            if (body == null || !response.isSuccessful || !body.success) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load delivery methods (HTTP ${response.code()})."
                Log.w(TAG, "delivery methods error: $message")
                degrade(message)
                return
            }
            val rows = methods.map { it.toMethodRow() }
            Log.i(TAG, "delivery methods loaded count=${rows.size}")
            _state.update {
                it.copy(
                    loading = false,
                    methods = rows,
                    // Web parity: the first method is preselected; an empty
                    // list surfaces the honest configured-none message.
                    selectedKey = rows.firstOrNull()?.key.orEmpty(),
                    error = if (rows.isEmpty()) {
                        "No delivery methods have been configured yet."
                    } else {
                        null
                    },
                    offlineFromCache = false,
                )
            }
            persistCache(methods)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "delivery methods fetch failed: ${e.message}")
            degrade("Network error while loading delivery methods.")
        }
    }

    /**
     * Failure path: the saved methods cache (banner state); with none, the
     * honest amber error card. Mapped on the MAIN thread after the IO
     * cache read (the mappers are main-thread JVM helpers, RfqModels
     * convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.METHODS, CachedMethods.serializer())
        }
        val rows = cached?.methods.orEmpty().map { it.toMethodRow() }
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache methods=${rows.size}")
            _state.value = DeliveryMethodsUiState(
                loading = false,
                methods = rows,
                selectedKey = rows.firstOrNull()?.key.orEmpty(),
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(methods: List<com.zylod.wholesale.data.api.DeliveryMethodDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            LogisticsCacheStore.write(
                appContext,
                LogisticsCacheKeys.METHODS,
                CachedMethods.serializer(),
                CachedMethods(methods = methods),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}
