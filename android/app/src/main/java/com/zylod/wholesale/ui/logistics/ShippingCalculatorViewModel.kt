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
import java.util.Locale

/**
 * Freight-calculator VM — GET api/shipping/quote (PUBLIC; the Task 94
 * zone-book engine) as the payload of record for the shipping-calculator
 * pageId, mirroring shipping-calculator-page.tsx exactly:
 *
 *  - INPUTS: destination district + chargeable weight are required; the
 *    subtotal is optional and only sent when > 0 (it unlocks the freeAbove
 *    crossings). The volumetric helper (L × W × H ÷ 5000) fills the
 *    weight input — pure math, clearly labeled.
 *  - QUOTE ON MOUNT (web parity): the defaults (Dhaka / 10 kg) are quoted
 *    once so the page never sits on an invented number.
 *  - HONEST ANSWERS: a 400 surfaces the server's real error text; an
 *    uncovered district is the honest empty state ("No shipping option
 *    covers that yet") — never a fabricated standard rate.
 *  - OFFLINE (LiveChatViewModel degrade convention): on failure the last
 *    successful quote survives — device-saved cache (SharedPreferences
 *    "zylod_config", "native_logistics_quote_cache") — and the state flips
 *    offlineFromCache so the screen shows its saved-data banner.
 */
data class ShippingCalculatorUiState(
    val district: String = "Dhaka",
    val weight: String = "10",
    /** Volumetric helper inputs (cm) — web dims l/w/h. */
    val dimL: String = "",
    val dimW: String = "",
    val dimH: String = "",
    val subtotal: String = "",
    /** The zone book's real answer (price-asc as the server sorts it). */
    val options: List<QuoteOptionDto> = emptyList(),
    /** A quote has completed at least once (gates the empty state). */
    val loaded: Boolean = false,
    /** The wire call is in flight. */
    val loading: Boolean = false,
    /** Validation + HTTP/network failure text — the inline destructive line. */
    val error: String? = null,
    /** Informational helper line (the applied volumetric weight). */
    val hint: String? = null,
    /** The district the last quote was FOR (the empty-state message). */
    val quotedDistrict: String = "",
    /** The visible options came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class ShippingCalculatorViewModel(
    private val appContext: Context,
    @Suppress("UNUSED_PARAMETER") private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(ShippingCalculatorUiState())
    val state: StateFlow<ShippingCalculatorUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var quoteJob: Job? = null

    /* ─── input setters ──────────────────────────────────────────────────── */

    fun setDistrict(value: String) {
        _state.update { it.copy(district = value, error = null) }
    }

    fun setWeight(value: String) {
        _state.update { it.copy(weight = value, error = null) }
    }

    fun setSubtotal(value: String) {
        _state.update { it.copy(subtotal = value, error = null) }
    }

    fun setDimL(value: String) {
        _state.update { it.copy(dimL = value) }
    }

    fun setDimW(value: String) {
        _state.update { it.copy(dimW = value) }
    }

    fun setDimH(value: String) {
        _state.update { it.copy(dimH = value) }
    }

    /**
     * The volumetric helper (web applyVolumetric): fills the chargeable
     * weight from L × W × H ÷ 5000 — the chargeable weight is the greater
     * of this and the real weight, which is exactly what the caption says.
     */
    fun applyVolumetric() {
        val l = _state.value.dimL.toDoubleOrNull() ?: 0.0
        val w = _state.value.dimW.toDoubleOrNull() ?: 0.0
        val h = _state.value.dimH.toDoubleOrNull() ?: 0.0
        if (l <= 0.0 || w <= 0.0 || h <= 0.0) {
            _state.update { it.copy(hint = "Enter all three dimensions first") }
            return
        }
        val volumetric = (l * w * h) / 5000.0
        _state.update {
            it.copy(
                weight = String.format(Locale.US, "%.2f", volumetric),
                error = null,
                hint = "Volumetric weight applied: " +
                    String.format(Locale.US, "%.2f", volumetric) +
                    " kg — L × W × H ÷ 5000. The chargeable weight is the greater of this and the real weight.",
            )
        }
    }

    /** Consume the informational helper line. */
    fun consumeHint() {
        _state.update { it.copy(hint = null) }
    }

    /* ─── quote ──────────────────────────────────────────────────────────── */

    /**
     * Get Live Quote — validates like the web (district required, weight a
     * non-negative number), then GETs the zone book. The subtotal param is
     * sent ONLY when it parses to a positive number (web parity).
     */
    fun quote() {
        if (quoteJob?.isActive == true) return
        val district = _state.value.district.trim()
        val weightKg = _state.value.weight.toDoubleOrNull()
        if (district.isEmpty()) {
            _state.update { it.copy(error = "Enter a destination district", hint = null) }
            return
        }
        if (weightKg == null || weightKg < 0.0) {
            _state.update { it.copy(error = "Enter a valid weight in kg", hint = null) }
            return
        }
        val subtotal = _state.value.subtotal.toDoubleOrNull()?.takeIf { it > 0.0 }
        quoteJob?.cancel()
        _state.update {
            it.copy(
                loading = true,
                error = null,
                offlineFromCache = false,
                hint = null,
            )
        }
        quoteJob = viewModelScope.launch {
            try {
                Log.i(TAG, "quote district=$district weight=$weightKg subtotal=$subtotal")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.logisticsApi(base)
                    .shippingQuote(district = district, weightKg = weightKg, subtotal = subtotal)
                val body = response.body()
                if (body == null || !response.isSuccessful || !body.success) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not quote (HTTP ${response.code()})."
                    Log.w(TAG, "quote error: $message")
                    degrade(message)
                    return@launch
                }
                val options = body.data.orEmpty()
                Log.i(TAG, "quote loaded count=${options.size}")
                _state.update {
                    it.copy(
                        loading = false,
                        loaded = true,
                        options = options,
                        quotedDistrict = district,
                        error = null,
                        offlineFromCache = false,
                    )
                }
                persistCache(options)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "quote fetch failed: ${e.message}")
                degrade("Network error. Please retry.")
            }
        }
    }

    /**
     * Failure path: the saved quote cache (banner state); with none, the
     * honest error text + Retry. Mapped on the MAIN thread after the IO
     * cache read.
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            LogisticsCacheStore.read(appContext, LogisticsCacheKeys.QUOTE, CachedQuote.serializer())
        }
        val options = cached?.options.orEmpty()
        if (options.isNotEmpty()) {
            Log.i(TAG, "degrade → cache options=${options.size}")
            _state.update {
                it.copy(
                    loading = false,
                    loaded = true,
                    options = options,
                    error = null,
                    offlineFromCache = true,
                )
            }
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(options: List<com.zylod.wholesale.data.api.QuoteOptionDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            LogisticsCacheStore.write(
                appContext,
                LogisticsCacheKeys.QUOTE,
                CachedQuote.serializer(),
                CachedQuote(options = options),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodLogistics"
    }
}
