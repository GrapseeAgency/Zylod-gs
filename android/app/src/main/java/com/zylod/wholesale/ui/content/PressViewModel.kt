package com.zylod.wholesale.ui.content

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
 * Press hub VM — the record for the native "press-media" pageId.
 *
 * Data truth: press-media-page.tsx ported — TWO fetches back the screen:
 * GET api/press (the web calls it ONCE with NO params and filters
 * client-side; the releases page + distinct categories + the route's own
 * pagination envelope arrive) and GET api/press/media-kit (the public
 * asset library the web links to as its own page — the native screen
 * embeds the section inline because the t263 batch owns no separate
 * media-kit pageId). Category chips mirror the web's client-side filter
 * exactly (selectedCat === 'all' keeps every release; a chip keeps
 * releases whose category equals it — no refetch). Each payload degrades
 * to its OWN saved snapshot (native_press_cache / native_media_kit_cache)
 * with the offline banner. PUBLIC content: works signed-out.
 */
class PressViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PressUiState())
    val state: StateFlow<PressUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var releasesJob: Job? = null
    private var mediaKitJob: Job? = null

    /** Entry resolve (both halves fetch independently, like the web's mounts). */
    fun load() {
        _state.update {
            it.copy(
                // t279 — rotation re-entry keeps the visible releases on
                // screen (loading only while nothing renderable yet).
                loading = it.releases.isEmpty(),
                releasesError = null,
                offlineFromCache = false,
                mediaKitLoading = it.mediaKit == null,
                mediaKitError = null,
            )
        }
        fetchReleases()
        fetchMediaKit()
    }

    /** The web's setSelectedCat — pure client-side filter, never a refetch. */
    fun selectCategory(category: String) {
        _state.update { it.copy(selectedCategory = category) }
    }

    fun retryReleases() {
        _state.update { it.copy(loading = true, releasesError = null, offlineFromCache = false) }
        fetchReleases()
    }

    fun retryMediaKit() {
        _state.update { it.copy(mediaKitLoading = true, mediaKitError = null) }
        fetchMediaKit()
    }

    private fun fetchReleases() {
        releasesJob?.cancel()
        releasesJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch press releases pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).pressReleases()
                val payload = response.body()
                val data = payload?.data
                if (!response.isSuccessful || payload?.success != true || data == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the press releases (HTTP ${response.code()})."
                    Log.w(TAG, "press list error: $message")
                    degradeReleases(message)
                    return@launch
                }
                Log.i(TAG, "press list loaded releases=${data.releases.size} cats=${data.categories.size}")
                _state.update {
                    it.copy(
                        loading = false,
                        releases = data.releases,
                        categories = data.categories,
                        pagination = data.pagination,
                        releasesError = null,
                        // A fresh resolve resets the chip to the web's 'all' default.
                        selectedCategory = "all",
                    )
                }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.PRESS,
                        CachedPressList.serializer(),
                        CachedPressList(list = data),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "press list fetch failed: ${e.message}")
                degradeReleases("Network error while loading the press releases. Check your connection and retry.")
            }
        }
    }

    private fun fetchMediaKit() {
        mediaKitJob?.cancel()
        mediaKitJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch media kit pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).mediaKit()
                val payload = response.body()
                val kit = payload?.data
                if (!response.isSuccessful || payload?.success != true || kit == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the media kit (HTTP ${response.code()})."
                    Log.w(TAG, "media kit error: $message")
                    degradeMediaKit(message)
                    return@launch
                }
                Log.i(TAG, "media kit loaded assets=${kit.assets.size}")
                _state.update {
                    it.copy(mediaKitLoading = false, mediaKit = kit, mediaKitError = null)
                }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.MEDIA_KIT,
                        CachedMediaKit.serializer(),
                        CachedMediaKit(kit = kit),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "media kit fetch failed: ${e.message}")
                degradeMediaKit("Network error while loading the media kit. Check your connection and retry.")
            }
        }
    }

    /** Releases failure: the saved page with the banner, else the error card. */
    private suspend fun degradeReleases(message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(appContext, ContentCacheKeys.PRESS, CachedPressList.serializer())
        }
        val data = cached?.list
        if (data != null && data.releases.isNotEmpty()) {
            Log.i(TAG, "press degrade → cache releases=${data.releases.size}")
            _state.update {
                it.copy(
                    loading = false,
                    releases = data.releases,
                    categories = data.categories,
                    pagination = data.pagination,
                    releasesError = null,
                    offlineFromCache = true,
                )
            }
        } else {
            _state.update { it.copy(loading = false, releasesError = message) }
        }
    }

    /** Media-kit failure: the saved kit with the banner, else the error card. */
    private suspend fun degradeMediaKit(message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(appContext, ContentCacheKeys.MEDIA_KIT, CachedMediaKit.serializer())
        }
        val kit = cached?.kit
        if (kit != null && kit.assets.isNotEmpty()) {
            Log.i(TAG, "media kit degrade → cache assets=${kit.assets.size}")
            _state.update {
                it.copy(mediaKitLoading = false, mediaKit = kit, mediaKitError = null)
            }
        } else {
            _state.update { it.copy(mediaKitLoading = false, mediaKitError = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
