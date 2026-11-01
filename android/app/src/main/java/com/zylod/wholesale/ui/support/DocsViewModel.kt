package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportArticleDto
import com.zylod.wholesale.data.api.SupportArticleFeedbackBody
import com.zylod.wholesale.data.api.SupportTocSectionDto
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
 * Docs VM — the two payloads the web docs-browser-page.tsx pulls, as the
 * record for the native "docs-page" pageId:
 *
 *  1. GET api/support/policies — the sidebar TOC (the web reads ONLY
 *     data.tableOfContents; the payload's full article rows are carried
 *     but unused there and here). The web swallows TOC failures into an
 *     empty sidebar; native keeps the rest honest with an error + Retry
 *     (or the saved snapshot with the offline banner).
 *  2. GET api/support/articles/{slug} — the detail pane. The entry query's
 *     "slug=" pair seeds the active article (web pageParams.slug ||
 *     'how-it-works'); selecting a sidebar row re-fetches.
 *
 *  3. POST api/support/articles/{slug}/feedback { helpful } — the "Was
 *     this documentation helpful?" widget, ONE tap per article view (web
 *     feedbackSent guard, the thank-you state shows regardless of the
 *     POST outcome — mirrored verbatim from handleFeedback's
 *     fire-and-forget catch).
 *
 * EN⇄BN toggle renders titleBn/contentBn when present (web exact
 * ternaries); the sidebar filter matches titleEn (lowercased) / titleBn
 * raw (the web's exact predicate). PUBLIC routes: no sign-in gate.
 */
data class DocsUiState(
    /** GET api/support/policies resolve. */
    val tocLoading: Boolean = true,
    val toc: List<SupportTocSectionDto> = emptyList(),
    /** TOC failure with nothing renderable (error card + Retry). */
    val tocError: String? = null,
    /** GET api/support/articles/{slug} resolve. */
    val articleLoading: Boolean = true,
    val activeSlug: String = DOCS_DEFAULT_SLUG,
    val article: SupportArticleDto? = null,
    /** Article failure with nothing renderable (error card + Retry). */
    val articleError: String? = null,
    /** "en" | "bn" (web language, default "en"). */
    val language: String = FaqCategories.EN,
    /** Sidebar filter (web searchQuery). */
    val searchQuery: String = "",
    /** One-shot helpful widget state (web feedbackSent). */
    val feedbackSent: Boolean = false,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
) {
    /** The web's per-section filter (blank query keeps every section). */
    val filteredToc: List<SupportTocSectionDto>
        get() {
            val q = searchQuery.trim()
            if (q.isEmpty()) return toc
            val lowered = q.lowercase()
            return toc.mapNotNull { section ->
                val filteredArticles = section.articles.filter { art ->
                    art.titleEn?.lowercase()?.contains(lowered) == true ||
                        (art.titleBn?.contains(q) == true)
                }
                if (filteredArticles.isEmpty()) null
                else section.copy(articles = filteredArticles)
            }
        }

    /** bn && titleBn ? titleBn : titleEn (web exact ternary). */
    val articleTitle: String?
        get() {
            val art = article ?: return null
            return if (language == FaqCategories.BN && art.titleBn?.isNotBlank() == true) {
                art.titleBn
            } else {
                art.titleEn
            }
        }

    /** bn && contentBn ? contentBn : contentEn (web exact ternary). */
    val articleContent: String?
        get() {
            val art = article ?: return null
            return if (language == FaqCategories.BN && art.contentBn?.isNotBlank() == true) {
                art.contentBn
            } else {
                art.contentEn
            }
        }
}

/** The web's initialSlug fallback: pageParams.slug || 'how-it-works'. */
internal const val DOCS_DEFAULT_SLUG = "how-it-works"

class DocsViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(DocsUiState())
    val state: StateFlow<DocsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var tocJob: Job? = null
    private var articleJob: Job? = null

    /** Entry resolve (called on EVERY entry; the query seeds the slug). */
    fun load(query: String?) {
        val queriedSlug = slugFromQuery(query)
        _state.update {
            it.copy(
                activeSlug = queriedSlug
                    ?: it.activeSlug.takeIf(String::isNotBlank)
                    ?: DOCS_DEFAULT_SLUG,
                tocLoading = true,
                tocError = null,
                articleLoading = true,
                articleError = null,
                offlineFromCache = false,
            )
        }
        fetchToc()
        fetchArticle(_state.value.activeSlug)
    }

    /** Sidebar article tap (web handleSelectArticle). */
    fun selectArticle(slug: String) {
        if (_state.value.activeSlug == slug) return
        _state.update {
            it.copy(
                activeSlug = slug,
                articleLoading = true,
                articleError = null,
                article = null,
                feedbackSent = false,
            )
        }
        fetchArticle(slug)
    }

    /** Sidebar filter input (web setSearchQuery). */
    fun setSearch(query: String) {
        _state.update { it.copy(searchQuery = query) }
    }

    /** EN⇄BN toggle (web setLanguage). */
    fun toggleLanguage() {
        _state.update {
            it.copy(language = if (it.language == FaqCategories.EN) FaqCategories.BN else FaqCategories.EN)
        }
    }

    /** The helpful widget — one shot per article view (web handleFeedback). */
    fun sendFeedback(helpful: Boolean) {
        val slug = _state.value.article?.slug?.takeIf(String::isNotBlank) ?: return
        if (_state.value.feedbackSent) return
        _state.update { it.copy(feedbackSent = true) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                ApiClient.supportPublicApi(base)
                    .articleFeedback(slug, SupportArticleFeedbackBody(helpful = helpful))
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                // Web parity: the thank-you already shows — failures stay silent.
                Log.w(TAG, "docs feedback failed: ${e.message}")
            }
        }
    }

    fun retryToc() {
        _state.update { it.copy(tocLoading = true, tocError = null, offlineFromCache = false) }
        fetchToc()
    }

    fun retryArticle() {
        val slug = _state.value.activeSlug
        _state.update { it.copy(articleLoading = true, articleError = null, offlineFromCache = false) }
        fetchArticle(slug)
    }

    private fun fetchToc() {
        tocJob?.cancel()
        tocJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch policies pageId=$pageId")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).policies()
                val payload = response.body()
                val toc = payload?.data?.takeIf { response.isSuccessful && payload?.success == true }
                    ?.tableOfContents.orEmpty()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load the documentation (HTTP ${response.code()})."
                    Log.w(TAG, "policies error: $message")
                    degradeToc(message)
                    return@launch
                }
                Log.i(TAG, "policies loaded sections=${toc.size}")
                _state.update { it.copy(tocLoading = false, toc = toc, tocError = null) }
                withContext(Dispatchers.IO) {
                    SupportPublicCacheStore.write(
                        appContext,
                        SupportPublicCacheKeys.DOCS,
                        CachedSupportDocs.serializer(),
                        // Read-modify-write: the article half is this screen's other fetch.
                        (SupportPublicCacheStore.read(
                            appContext,
                            SupportPublicCacheKeys.DOCS,
                            CachedSupportDocs.serializer(),
                        ) ?: CachedSupportDocs()).copy(toc = toc),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "policies fetch failed: ${e.message}")
                degradeToc("Network error while loading the documentation. Check your connection and retry.")
            }
        }
    }

    private fun fetchArticle(slug: String) {
        if (slug.isBlank()) {
            _state.update { it.copy(articleLoading = false) }
            return
        }
        articleJob?.cancel()
        articleJob = viewModelScope.launch {
            try {
                Log.i(TAG, "fetch article slug=$slug")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportPublicApi(base).article(slug)
                val payload = response.body()
                if (!response.isSuccessful || payload?.success != true) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not load this article (HTTP ${response.code()})."
                    Log.w(TAG, "article error: $message")
                    degradeArticle(slug, message)
                    return@launch
                }
                val article = payload?.data
                if (article == null) {
                    degradeArticle(slug, "Could not load this article (HTTP ${response.code()}).")
                    return@launch
                }
                _state.update {
                    it.copy(articleLoading = false, article = article, articleError = null)
                }
                withContext(Dispatchers.IO) {
                    SupportPublicCacheStore.write(
                        appContext,
                        SupportPublicCacheKeys.DOCS,
                        CachedSupportDocs.serializer(),
                        (SupportPublicCacheStore.read(
                            appContext,
                            SupportPublicCacheKeys.DOCS,
                            CachedSupportDocs.serializer(),
                        ) ?: CachedSupportDocs()).copy(article = article),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "article fetch failed: ${e.message}")
                degradeArticle(slug, "Network error while loading this article. Check your connection and retry.")
            }
        }
    }

    /** TOC failure: the saved TOC with the banner, else the error card. */
    private suspend fun degradeToc(message: String) {
        val cached = withContext(Dispatchers.IO) {
            SupportPublicCacheStore.read(appContext, SupportPublicCacheKeys.DOCS, CachedSupportDocs.serializer())
        }
        val toc = cached?.toc.orEmpty()
        if (toc.isNotEmpty()) {
            Log.i(TAG, "toc degrade → cache sections=${toc.size}")
            _state.update {
                it.copy(tocLoading = false, toc = toc, tocError = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(tocLoading = false, tocError = message) }
        }
    }

    /** Article failure: the saved SAME-slug article with the banner, else error. */
    private suspend fun degradeArticle(slug: String, message: String) {
        val cached = withContext(Dispatchers.IO) {
            SupportPublicCacheStore.read(appContext, SupportPublicCacheKeys.DOCS, CachedSupportDocs.serializer())
        }
        val article = cached?.article
        if (article != null && article.slug == slug) {
            Log.i(TAG, "article degrade → cache slug=$slug")
            _state.update {
                it.copy(articleLoading = false, article = article, articleError = null, offlineFromCache = true)
            }
        } else {
            _state.update { it.copy(articleLoading = false, articleError = message) }
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
    }
}

/* ─── query helper ───────────────────────────────────────────────────────── */

/** Extracts the entry slug from the page's "slug=x" query pair. */
fun slugFromQuery(query: String?): String? =
    query?.trim()
        ?.let { raw -> Regex("(?:^|&)slug=([^&]+)").find(raw)?.groupValues?.get(1) }
        ?.takeIf(String::isNotBlank)
