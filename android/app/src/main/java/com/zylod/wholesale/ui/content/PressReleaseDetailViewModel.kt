package com.zylod.wholesale.ui.content

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.ui.support.slugFromQuery
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
 * Press release detail VM — the record for the native
 * "press-release-detail" pageId.
 *
 * Data truth: the web's press-release-detail-page.tsx entry slug rule is
 * pageParams?.slug || 'zylod-secures-series-a-to-digitize-bangladesh-
 * wholesale' (the platform's own launch release is the default read) —
 * mirrored verbatim via [PRESS_DETAIL_DEFAULT_SLUG]. GET api/press/{slug}
 * (PUBLIC): 200 { success, data: { ...every pressReleases column,
 * related: [x3] } } — the handler also increments views server-side (the
 * wire's views number is the LIVE counter, rendered as-is). 404 → the
 * web's verbatim "Press release not found." card (no cache fallback — a
 * definitive answer). Other failures degrade to the per-slug
 * native_press_release_cache_<slug> snapshot with the offline banner,
 * else the error card. PUBLIC content: works signed-out.
 */
class PressReleaseDetailViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(PressReleaseDetailUiState())
    val state: StateFlow<PressReleaseDetailUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve — the query's "slug=" pair (web pageParams + default). */
    fun load(query: String?) {
        val slug = slugFromQuery(query) ?: PRESS_DETAIL_DEFAULT_SLUG
        _state.update {
            it.copy(
                slug = slug,
                loading = true,
                release = null,
                notFound = false,
                error = null,
                offlineFromCache = false,
            )
        }
        fetchRelease(slug)
    }

    fun retry() {
        val slug = _state.value.slug
        if (slug.isBlank()) return
        _state.update { it.copy(loading = true, notFound = false, error = null, offlineFromCache = false) }
        fetchRelease(slug)
    }

    private fun fetchRelease(slug: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch press release slug=$slug pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).pressRelease(slug)
                val payload = response.body()
                if (response.code() == 404) {
                    Log.i(TAG, "press release 404 slug=$slug")
                    _state.update { it.copy(loading = false, notFound = true, error = null) }
                    return@launch
                }
                val release = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true && it.slug == slug }
                if (release == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load this release (HTTP ${response.code()})."
                    Log.w(TAG, "press release error: $message")
                    degrade(slug, message)
                    return@launch
                }
                Log.i(TAG, "press release loaded slug=$slug views=${release.views}")
                _state.update { it.copy(loading = false, release = release, error = null) }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.pressRelease(slug),
                        CachedPressRelease.serializer(),
                        CachedPressRelease(release = release),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "press release fetch failed: ${e.message}")
                degrade(slug, "Network error while loading this release. Check your connection and retry.")
            }
        }
    }

    /** Failure: the saved SAME-slug release with the banner, else the error card. */
    private suspend fun degrade(slug: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(
                appContext,
                ContentCacheKeys.pressRelease(slug),
                CachedPressRelease.serializer(),
            )
        }
        val release = cached?.release
        if (release != null && release.slug == slug) {
            Log.i(TAG, "press release degrade → cache slug=$slug")
            _state.update {
                it.copy(loading = false, release = release, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
