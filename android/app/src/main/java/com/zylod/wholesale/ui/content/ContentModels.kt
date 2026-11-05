package com.zylod.wholesale.ui.content

import android.content.Context
import android.util.Log
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.BlogPostDto
import com.zylod.wholesale.data.api.BlogPostSummaryDto
import com.zylod.wholesale.data.api.MediaKitDto
import com.zylod.wholesale.data.api.Pagination
import com.zylod.wholesale.data.api.PressListDto
import com.zylod.wholesale.data.api.PressReleaseDto
import com.zylod.wholesale.data.api.PressReleaseRowDto
import com.zylod.wholesale.data.api.TradeEventDto
import kotlinx.serialization.KSerializer
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Typed shared models for the t263 public-content surfaces (blog /
 * blog-post / marketplace-news / press-media / press-release-detail /
 * events / newsletter): the SharedPreferences cache keys + store, the
 * per-screen UI states, and the pure mappers the screens render through.
 *
 * ALL seven pageIds are PUBLIC content — no sign-in gate, no auth branch
 * (the web serves them to guests, so the native screens do too). The
 * caches follow the t255 SupportPublicCacheStore idiom: the SAME
 * "zylod_config" prefs file the rest of the shell uses, one key per
 * payload, corrupt entries read as absent, failures never throw.
 */

/** The device-saved content payload keys — SharedPreferences "zylod_config". */
internal object ContentCacheKeys {
    const val PREFS = "zylod_config"
    const val BLOG = "native_blog_cache"
    const val PRESS = "native_press_cache"
    const val MEDIA_KIT = "native_media_kit_cache"
    const val EVENTS = "native_events_cache"

    /** Per-slug detail keys: "native_blog_post_cache_<slug>" and the press twin. */
    const val BLOG_POST_PREFIX = "native_blog_post_cache_"
    const val PRESS_RELEASE_PREFIX = "native_press_release_cache_"

    fun blogPost(slug: String) = "$BLOG_POST_PREFIX$slug"
    fun pressRelease(slug: String) = "$PRESS_RELEASE_PREFIX$slug"
}

/** blog / marketplace-news snapshot — the raw wire rows (offline render matches live). */
@kotlinx.serialization.Serializable
internal data class CachedBlogPosts(val posts: List<BlogPostSummaryDto> = emptyList())

/** press-media snapshot — the fetched release page + the category chips. */
@kotlinx.serialization.Serializable
internal data class CachedPressList(val list: PressListDto? = null)

/** press-release-detail snapshot — the full row (stored under its own slug key). */
@kotlinx.serialization.Serializable
internal data class CachedPressRelease(val release: PressReleaseDto? = null)

/** blog-post snapshot — the full post (stored under its own slug key). */
@kotlinx.serialization.Serializable
internal data class CachedBlogPost(val post: BlogPostDto? = null)

/** media-kit snapshot — the asset library backing the press screen's kit section. */
@kotlinx.serialization.Serializable
internal data class CachedMediaKit(val kit: MediaKitDto? = null)

/** events snapshot — the active trade fairs. */
@kotlinx.serialization.Serializable
internal data class CachedEvents(val rows: List<TradeEventDto> = emptyList())

/** Generic typed prefs store (SupportPublicCacheStore clone, content keys). */
internal object ContentCacheStore {
    private const val TAG = "ZylodContent"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(ContentCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "content cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(ContentCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
            // t279 — per-slug detail keys grow unbounded; keep the newest 12
            // per family (the shared feeds stay single-key).
            if (key.startsWith(ContentCacheKeys.BLOG_POST_PREFIX)) {
                com.zylod.wholesale.util.CacheTrim.trim(context, ContentCacheKeys.BLOG_POST_PREFIX)
            } else if (key.startsWith(ContentCacheKeys.PRESS_RELEASE_PREFIX)) {
                com.zylod.wholesale.util.CacheTrim.trim(context, ContentCacheKeys.PRESS_RELEASE_PREFIX)
            }
        }.onFailure { Log.w(TAG, "content cache write failed: ${it.message}") }
    }
}

/* ─── wire → screen mappers (pure Kotlin) ────────────────────────────────── */

/**
 * The blog body is PLAIN TEXT — the web blog page renders exactly one <p>
 * per blank-line-separated block (content.split(/\n{2,}/) with
 * whitespace-pre-wrap), never HTML or markdown. Same split here: blank
 * lines are paragraph boundaries, single newlines stay inside a paragraph
 * (Compose Text preserves them, matching the web's whitespace-pre-wrap).
 */
internal fun blogBodyParagraphs(content: String?): List<String> =
    content
        ?.split(Regex("\\n{2,}"))
        ?.map { it.trim() }
        ?.filter(String::isNotBlank)
        .orEmpty()

/**
 * The press release body is ALSO plain text but the web renders it as ONE
 * whitespace-pre-wrap block (press-release-detail-page.tsx:73) — no
 * paragraph splitting. Native keeps that exact shape: a single Text with
 * the raw string (newlines preserved). Null → absent, never fabricated.
 */
internal fun pressBodyText(content: String?): String? =
    content?.takeIf(String::isNotBlank)

/** The press category's chip label — the web's exact cat.replace('_', ' '). */
internal fun pressCategoryLabel(category: String?): String =
    category?.replace('_', ' ').orEmpty()

/**
 * The press-release-detail entry slug fallback — the web's verbatim
 * pageParams?.slug || 'zylod-secures-series-a-to-digitize-bangladesh-wholesale'.
 */
internal const val PRESS_DETAIL_DEFAULT_SLUG =
    "zylod-secures-series-a-to-digitize-bangladesh-wholesale"

/** The one server-side email rule (newsletter/route.ts EMAIL_RE, verbatim). */
internal val NEWSLETTER_EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")

/**
 * Wire ISO timestamp → the web's en-GB display strings. The wire carries
 * ISO instants ("2025-01-15T10:30:00.000Z"); the web shows
 * toLocaleDateString('en-GB', …) variants, so the same locale + pattern
 * set is used here. Unparseable input renders the raw string (honest —
 * never a fabricated stand-in for a date the payload did carry).
 */
internal fun contentDateString(iso: String?, pattern: String): String {
    if (iso.isNullOrBlank()) return ""
    return try {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
        val parsed = parser.parse(iso.take(19))
        if (parsed == null) iso else SimpleDateFormat(pattern, Locale.ENGLISH).format(parsed)
    } catch (_: ParseException) {
        iso
    }
}

/* ─── per-screen UI states ───────────────────────────────────────────────── */

/** blog / marketplace-news list state (one VM per pageId). */
data class BlogUiState(
    val loading: Boolean = true,
    val posts: List<BlogPostSummaryDto> = emptyList(),
    /** Fetch failure with nothing renderable (error card + Retry). */
    val error: String? = null,
    /** The visible payload came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

/** blog-post detail state — 404 is its OWN state (the web's "does not exist"). */
data class BlogPostUiState(
    val loading: Boolean = true,
    val slug: String = "",
    val post: BlogPostDto? = null,
    /** 404 (draft == phantom — the web's postMissing branch). */
    val notFound: Boolean = false,
    /** Non-404 failure with nothing renderable (error card + Retry). */
    val error: String? = null,
    val offlineFromCache: Boolean = false,
)

/** press-media state — releases + category chips + the media-kit section. */
data class PressUiState(
    val loading: Boolean = true,
    val releases: List<PressReleaseRowDto> = emptyList(),
    val categories: List<String> = emptyList(),
    /** The route's own page envelope (carried; the web never pages either). */
    val pagination: Pagination? = null,
    /** 'all' or one of [categories] — the web's client-side filter. */
    val selectedCategory: String = "all",
    val releasesError: String? = null,
    val mediaKitLoading: Boolean = true,
    val mediaKit: MediaKitDto? = null,
    val mediaKitError: String? = null,
    val offlineFromCache: Boolean = false,
) {
    /** The web's exact client-side category filter (selectedCat === 'all'). */
    val filteredReleases: List<PressReleaseRowDto>
        get() = if (selectedCategory == "all") {
            releases
        } else {
            releases.filter { it.category == selectedCategory }
        }
}

/** press-release-detail state (404: the web's "Press release not found."). */
data class PressReleaseDetailUiState(
    val loading: Boolean = true,
    val slug: String = "",
    val release: PressReleaseDto? = null,
    val notFound: Boolean = false,
    val error: String? = null,
    val offlineFromCache: Boolean = false,
)

/** events state — ONE list (the web has no upcoming/past split). */
data class EventsUiState(
    val loading: Boolean = true,
    val events: List<TradeEventDto> = emptyList(),
    val error: String? = null,
    val offlineFromCache: Boolean = false,
)

/** newsletter state — the footer subscribe bar's POST-only twin. */
data class NewsletterUiState(
    val email: String = "",
    /** POST in flight — the subscribe button's disabled state. */
    val submitting: Boolean = false,
    /** 200/201 resolve — the verbatim message (already-subscribed branch included). */
    val successMessage: String? = null,
    /** 400/429/500 server text verbatim, or the client validation line. */
    val error: String? = null,
)

/* ─── shared small composables (content-scoped names, one definition) ────── */

/**
 * Error card with Retry — the t255 SupportErrorCard idiom, content-scoped
 * so ui/content stays self-contained (distinct name, same visual language).
 */
@Composable
internal fun ContentErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over a cached snapshot (SupportOfflineBanner's twin). */
@Composable
internal fun ContentOfflineBanner(text: String) {
    val warning = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
