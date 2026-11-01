package com.zylod.wholesale.ui.content

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.TradeEventDto
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
 * Events VM — the record for the native "events" pageId.
 *
 * Data truth: events-page.tsx ported. GET api/events (PUBLIC, no rate
 * limit) — isActive tradeEvents rows ordered startsAt ASC, take 30, FULL
 * rows (title/description/location/startsAt/endsAt/websiteUrl carried).
 * The web renders ONE list — no upcoming/past split (the payload's order
 * is the server's own, and the web never segments it) — with an Enquire
 * button per row → contact-us. The error state surfaces the route's own
 * text as the card heading + "Try Again"; the empty state is the web's
 * verbatim "No events scheduled right now" card + "Refresh". Failures
 * degrade to the saved native_events_cache snapshot with the offline
 * banner. PUBLIC content: works signed-out.
 */
class EventsViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(EventsUiState())
    val state: StateFlow<EventsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve (called on EVERY entry — the web refetches on mount). */
    fun load() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchEvents()
    }

    /** The error card's "Try Again" / the empty card's "Refresh" (same refetch). */
    fun retry() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchEvents()
    }

    private fun fetchEvents() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch events pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).events()
                val payload = response.body()
                val events = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                    .orEmpty()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load trade events (HTTP ${response.code()})"
                    Log.w(TAG, "events error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "events loaded rows=${events.size}")
                _state.update { it.copy(loading = false, events = events, error = null) }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.EVENTS,
                        CachedEvents.serializer(),
                        CachedEvents(rows = events),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "events fetch failed: ${e.message}")
                degrade("Could not load trade events. Check your connection and try again.")
            }
        }
    }

    /** Failure: the saved snapshot with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(appContext, ContentCacheKeys.EVENTS, CachedEvents.serializer())
        }
        val events = cached?.rows.orEmpty()
        if (events.isNotEmpty()) {
            Log.i(TAG, "events degrade → cache rows=${events.size}")
            _state.update {
                it.copy(loading = false, events = events, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, events = emptyList(), error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
