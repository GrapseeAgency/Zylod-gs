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
 * Blog list VM — the record for the native "blog" AND "marketplace-news"
 * pageIds (chunk-misc.ts maps BOTH ids onto the SAME blog-page component,
 * so one pageId-keyed VM class serves both screens; each delegate keeps
 * its own instance via the viewModel key).
 *
 * Data truth: GET api/blog (PUBLIC, rate limit 120/min) — every
 * isPublished post ordered publishedAt DESC, projected to id/slug/title/
 * excerpt/category/coverImageUrl/publishedAt. The route has NO pagination
 * params and the web renders what arrives in one grid — so there is no
 * load-more affordance here either (honest mirror, nothing dropped).
 * Failures degrade to the saved native_blog_cache snapshot with the
 * offline banner, else the web's verbatim empty card + "Check Again".
 * PUBLIC content: works signed-out, no auth branch anywhere.
 */
class BlogViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(BlogUiState())
    val state: StateFlow<BlogUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve (called on EVERY entry — the web refetches on mount). */
    fun load() {
        // t279 — rotation re-entry keeps the visible posts on screen.
        _state.update { it.copy(loading = it.posts.isEmpty(), error = null, offlineFromCache = false) }
        fetchPosts()
    }

    /** The empty card's "Check Again" / the error card's Retry (same refetch). */
    fun retry() {
        _state.update { it.copy(loading = true, error = null, offlineFromCache = false) }
        fetchPosts()
    }

    private fun fetchPosts() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch blog posts pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).blogPosts()
                val payload = response.body()
                val posts = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true }
                    .orEmpty()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the articles (HTTP ${response.code()})."
                    Log.w(TAG, "blog list error: $message")
                    degrade(message)
                    return@launch
                }
                Log.i(TAG, "blog list loaded posts=${posts.size}")
                _state.update {
                    it.copy(loading = false, posts = posts, error = null)
                }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.BLOG,
                        CachedBlogPosts.serializer(),
                        CachedBlogPosts(posts = posts),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "blog list fetch failed: ${e.message}")
                degrade("Network error while loading the articles. Check your connection and retry.")
            }
        }
    }

    /** Failure: the saved snapshot with the banner, else the error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(appContext, ContentCacheKeys.BLOG, CachedBlogPosts.serializer())
        }
        val posts = cached?.posts.orEmpty()
        if (posts.isNotEmpty()) {
            Log.i(TAG, "blog degrade → cache posts=${posts.size}")
            _state.update {
                it.copy(loading = false, posts = posts, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, posts = emptyList(), error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
