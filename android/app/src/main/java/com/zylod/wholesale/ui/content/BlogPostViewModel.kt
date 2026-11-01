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
 * Blog post VM — the record for the native "blog-post" pageId (the web's
 * blog-page.tsx single-post branch: ?page=blog-post&slug=…).
 *
 * Data truth: GET api/blog/{slug} (PUBLIC, rate limit 120/min) — 200
 * { success, data: { slug, title, content, excerpt, category,
 * coverImageUrl, publishedAt } }; a DRAFT and a phantom slug are the SAME
 * 404 { error: "Article not found" } (the web's postMissing branch shows
 * its honest "This article does not exist" card — mirrored verbatim, with
 * the "All articles" button back to the blog list). Non-404 failures
 * degrade to the per-slug native_blog_post_cache_<slug> snapshot with the
 * offline banner, else the error card. The 404 NEVER falls back to cache —
 * it is a definitive answer, not a network failure. PUBLIC content:
 * works signed-out.
 */
class BlogPostViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(BlogPostUiState())
    val state: StateFlow<BlogPostUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var loadJob: Job? = null

    /** Entry resolve — the query's "slug=" pair seeds the post (web pageParams). */
    fun load(query: String?) {
        val slug = slugFromQuery(query).orEmpty()
        _state.update {
            it.copy(
                slug = slug,
                loading = slug.isNotBlank(),
                post = null,
                notFound = false,
                error = null,
                offlineFromCache = false,
            )
        }
        if (slug.isBlank()) {
            // No slug in the query — the web readSlug='' falls to list mode;
            // the native detail page has nothing to fetch, so it parks on the
            // honest not-found card (same copy — there is no article to show).
            _state.update { it.copy(loading = false, notFound = true) }
            return
        }
        fetchPost(slug)
    }

    fun retry() {
        val slug = _state.value.slug
        if (slug.isBlank()) return
        _state.update { it.copy(loading = true, notFound = false, error = null, offlineFromCache = false) }
        fetchPost(slug)
    }

    private fun fetchPost(slug: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch blog post slug=$slug pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.contentApi(base).blogPost(slug)
                val payload = response.body()
                if (response.code() == 404) {
                    // Draft == phantom — the definitive answer, no cache fallback.
                    Log.i(TAG, "blog post 404 slug=$slug")
                    _state.update { it.copy(loading = false, notFound = true, error = null) }
                    return@launch
                }
                val post = payload?.data
                    ?.takeIf { response.isSuccessful && payload?.success == true && it.slug == slug }
                if (post == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load this article (HTTP ${response.code()})."
                    Log.w(TAG, "blog post error: $message")
                    degrade(slug, message)
                    return@launch
                }
                Log.i(TAG, "blog post loaded slug=$slug title=${post.title.orEmpty().take(40)}")
                _state.update { it.copy(loading = false, post = post, error = null) }
                withContext(Dispatchers.IO) {
                    ContentCacheStore.write(
                        appContext,
                        ContentCacheKeys.blogPost(slug),
                        CachedBlogPost.serializer(),
                        CachedBlogPost(post = post),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "blog post fetch failed: ${e.message}")
                degrade(slug, "Network error while loading this article. Check your connection and retry.")
            }
        }
    }

    /** Failure: the saved SAME-slug post with the banner, else the error card. */
    private suspend fun degrade(slug: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            ContentCacheStore.read(
                appContext,
                ContentCacheKeys.blogPost(slug),
                CachedBlogPost.serializer(),
            )
        }
        val post = cached?.post
        if (post != null && post.slug == slug) {
            Log.i(TAG, "blog post degrade → cache slug=$slug")
            _state.update {
                it.copy(loading = false, post = post, error = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodContent"
    }
}
