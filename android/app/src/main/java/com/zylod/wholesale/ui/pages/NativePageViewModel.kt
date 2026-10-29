package com.zylod.wholesale.ui.pages

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * t233 — the shared ViewModel behind every generated native page.
 *
 * State contract (identical guarantees to DealsViewModel/OrdersViewModel):
 *  - `loading` spinner ONLY on first load when an endpoint exists;
 *  - silent in-place refresh once live data is on screen (t216 convention —
 *    never blank a visible page behind a spinner);
 *  - degrade order live → saved cache → curated seed, with an honest
 *    banner/notice; `error` is set only when NOTHING is renderable, which
 *    for endpoint-less pages never happens;
 *  - [refresh] is the retry action (top-bar retry + error-state button).
 */
data class NativePageUiState(
    val loading: Boolean = true,
    val data: NativePageData? = null,
    val source: NativePageSource = NativePageSource.SEED,
    /** True when the visible content is NOT a live fetch (cache or seed). */
    val offline: Boolean = false,
    /** Degrade banner copy when showing non-live content after a failure. */
    val notice: String? = null,
    /** Set only when nothing at all is renderable (endpoint pages only). */
    val error: String? = null,
)

class NativePageViewModel(
    private val appContext: Context,
    val meta: NativePageMeta,
) : ViewModel() {

    private val _state = MutableStateFlow(NativePageUiState(loading = meta.endpoint != null))
    val state: StateFlow<NativePageUiState> = _state.asStateFlow()

    private var lastQuery: String = ""

    fun refresh(query: String) {
        if (query.isNotBlank()) lastQuery = query
        refreshInternal()
    }

    fun refresh() = refreshInternal()

    private fun refreshInternal() {
        // Curated page: nothing to fetch — instant, deterministic content.
        if (meta.endpoint == null) {
            _state.value = NativePageUiState(
                loading = false,
                data = NativePageContent.seedFor(meta),
                source = NativePageSource.SEED,
                offline = false,
            )
            return
        }
        val liveOnScreen = _state.value.source == NativePageSource.LIVE && _state.value.data != null
        _state.value = _state.value.copy(loading = !liveOnScreen, error = null)
        viewModelScope.launch {
            val result = NativePageRepository.load(appContext, meta, lastQuery)
            val data = result.data
            _state.value = when {
                data == null -> NativePageUiState(
                    loading = false,
                    error = result.notice ?: "Could not load ${meta.title}.",
                )
                else -> NativePageUiState(
                    loading = false,
                    data = data,
                    source = result.source,
                    offline = result.source != NativePageSource.LIVE,
                    notice = result.notice,
                    error = null,
                )
            }
        }
    }
}
