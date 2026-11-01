package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Blog / press / events / newsletter surfaces (t263) — the REAL routes
 * behind the seven native content pageIds (blog, blog-post,
 * marketplace-news, press-media, press-release-detail, events,
 * newsletter). Every route was verified against its src/app/api handler:
 *
 *  - GET api/blog (PUBLIC, rate limit 120/min 'blog-public'): 200
 *    { success, data: [row], count } — every isPublished blogPosts row
 *    ordered publishedAt DESC, projected to id/slug/title/excerpt/
 *    category/coverImageUrl/publishedAt. NO pagination params exist — the
 *    route returns the whole published list at once (the web renders what
 *    arrives; so does the native screen — no load-more affordance).
 *  - GET api/blog/{slug} (PUBLIC, same rate limit): 200 { success,
 *    data: { slug, title, content, excerpt, category, coverImageUrl,
 *    publishedAt } } — isPublished is consumed server-side (a DRAFT and a
 *    phantom slug are the SAME 404 { error: "Article not found" }, so
 *    half-written editorials are never discoverable).
 *  - GET api/press?category=&page=&limit= (PUBLIC, no rate limit): 200
 *    { success, data: { releases: [row], categories: [string],
 *    pagination: { page, limit, total, totalPages } } } — the isPublished
 *    pressReleases rows ordered publishedAt DESC (default page 1 / limit
 *    12) + the distinct category list + the page envelope. The web press
 *    page fetches ONCE with NO params and filters client-side; the native
 *    screen mirrors that (category chips filter the fetched page, no
 *    refetch) and keeps the route's real pagination carried.
 *  - GET api/press/{slug} (PUBLIC): 200 { success, data: { ...full row,
 *    related: [summary x3] } } — findFirst on slug + isPublished, then a
 *    views increment, then up to 3 same-category siblings (id/slug/title/
 *    summary/publishedAt/imageUrl). 404 { error: "Press release not
 *    found" }. The full row carries EVERY pressReleases column (the
 *    handler has no select): contentEn/contentBn/authorName/views/
 *    isPublished/createdAt/updatedAt included.
 *  - GET api/press/media-kit (PUBLIC): 200 { success, data: { assets:
 *    [full mediaKitAssets row], grouped: { assetType: [row] },
 *    assetTypes: [string], total } } — every isPublic asset ordered
 *    createdAt ASC. Asset rows carry fileUrl/thumbnailUrl/fileSizeMB/
 *    fileFormat — the native download affordance is an ACTION_VIEW on the
 *    REAL fileUrl (never a fabricated link).
 *  - GET api/events (PUBLIC, no rate limit): 200 { success, data:
 *    [tradeEvents row] } — isActive rows ordered startsAt ASC, take 30.
 *    Full rows (no select): id/title/description/location/startsAt/endsAt/
 *    websiteUrl/isActive/createdAt. The web renders ONE list (no
 *    upcoming/past split) with an Enquire button per row — mirrored.
 *  - POST api/newsletter (PUBLIC, rate limit 5/min 'newsletter-post'):
 *    body { email, source? } — email trimmed + lowercased server-side.
 *    400 { error: "Please enter a valid email address" } when the email
 *    fails the route's EMAIL_RE; 429 { error: "Too many requests. Try
 *    again in Ns." }; ALREADY subscribed → 200 { success, data:
 *    { alreadySubscribed: true } }; NEW → 201 { success, data:
 *    { alreadySubscribed: false } }. There is NO GET on api/newsletter —
 *    the subscriber list is private, so the native screen renders no
 *    fabricated "subscription status" readback.
 *
 * AUTH: all eight routes are PUBLIC — no sign-in gate anywhere (the t255
 * SupportPublicApi convention: no per-call @Header; the shared ApiClient
 * OkHttp client attaches the Bearer token when a session exists and every
 * route here ignores it).
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into tolerant mappers
 * instead of failing the whole screen's parse; unknown siblings (the blog
 * route's `count`, the media-kit route's `grouped` map when the native
 * screen only needs `assets`) are either carried tolerant or ignored by
 * the shared Json parser (ignoreUnknownKeys).
 */
interface ContentApi {
    /* ── Blog (blog / blog-post / marketplace-news) ──────────────────────── */

    /** GET api/blog — every published post, newest first (no pagination). */
    @GET("api/blog")
    suspend fun blogPosts(): Response<ApiEnvelope<List<BlogPostSummaryDto>>>

    /** GET api/blog/{slug} — one published post (draft == phantom == 404). */
    @GET("api/blog/{slug}")
    suspend fun blogPost(@Path("slug") slug: String): Response<ApiEnvelope<BlogPostDto>>

    /* ── Press (press-media / press-release-detail) ──────────────────────── */

    /** GET api/press — the published-releases page + categories + pagination. */
    @GET("api/press")
    suspend fun pressReleases(
        @Query("category") category: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 12,
    ): Response<ApiEnvelope<PressListDto>>

    /** GET api/press/{slug} — the full release (+ views increment + related). */
    @GET("api/press/{slug}")
    suspend fun pressRelease(@Path("slug") slug: String): Response<ApiEnvelope<PressReleaseDto>>

    /** GET api/press/media-kit — the public brand-asset library. */
    @GET("api/press/media-kit")
    suspend fun mediaKit(): Response<ApiEnvelope<MediaKitDto>>

    /* ── Events (events) ─────────────────────────────────────────────────── */

    /** GET api/events — the active trade fairs, soonest first (max 30). */
    @GET("api/events")
    suspend fun events(): Response<ApiEnvelope<List<TradeEventDto>>>

    /* ── Newsletter (newsletter) ─────────────────────────────────────────── */

    /** POST api/newsletter — the deduplicated subscribe (200 already / 201 new). */
    @POST("api/newsletter")
    suspend fun subscribeNewsletter(@Body body: NewsletterSubscribeBody): Response<NewsletterAckDto>
}

/* ─── blog rows ──────────────────────────────────────────────────────────── */

/**
 * One blogPosts row as the LIST route's select projects it: id/slug/title/
 * excerpt/category/coverImageUrl/publishedAt — no content column (the body
 * lives behind the per-slug route).
 */
@Immutable
@Serializable
data class BlogPostSummaryDto(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val excerpt: String? = null,
    val category: String? = null,
    val coverImageUrl: String? = null,
    val publishedAt: String? = null,
) {
    /** Stable identity for keyed collections (post id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "blog-post-${hashCode()}"
}

/**
 * One PUBLISHED post as the per-slug route returns it (isPublished is
 * stripped server-side before the wire). [content] is PLAIN TEXT — the web
 * blog page renders it as one <p> per blank-line-separated block
 * (content.split(/\n{2,}/)), never as HTML or markdown.
 */
@Immutable
@Serializable
data class BlogPostDto(
    val slug: String? = null,
    val title: String? = null,
    val content: String? = null,
    val excerpt: String? = null,
    val category: String? = null,
    val coverImageUrl: String? = null,
    val publishedAt: String? = null,
)

/* ─── press rows ─────────────────────────────────────────────────────────── */

/** One pressReleases row as the LIST route's select projects it. */
@Immutable
@Serializable
data class PressReleaseRowDto(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val summary: String? = null,
    /** company_news | product_launch | partnership | funding | award | milestone */
    val category: String? = null,
    val imageUrl: String? = null,
    val authorName: String? = null,
    val publishedAt: String? = null,
    val views: Int = 0,
) {
    /** Stable identity for keyed collections (release id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "press-release-${hashCode()}"
}

/** GET api/press data — the releases page + the distinct category list. */
@Immutable
@Serializable
data class PressListDto(
    val releases: List<PressReleaseRowDto> = emptyList(),
    val categories: List<String> = emptyList(),
    /** The route's own page envelope ({ page, limit, total, totalPages }). */
    val pagination: Pagination? = null,
)

/**
 * One FULL pressReleases row (the [slug] handler has NO select — every
 * schema column arrives) + the 3 same-category related summaries.
 * contentEn is PLAIN TEXT on the web (a single whitespace-pre-wrap block,
 * NOT paragraph-split like the blog body); contentBn is optional.
 */
@Immutable
@Serializable
data class PressReleaseDto(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val summary: String? = null,
    val contentEn: String? = null,
    val contentBn: String? = null,
    val category: String? = null,
    val imageUrl: String? = null,
    val authorName: String? = null,
    val isPublished: Boolean = true,
    val publishedAt: String? = null,
    val views: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val related: List<PressRelatedDto> = emptyList(),
)

/** One related-release summary (the [slug] route's take-3 projection). */
@Immutable
@Serializable
data class PressRelatedDto(
    val id: String? = null,
    val slug: String? = null,
    val title: String? = null,
    val summary: String? = null,
    val publishedAt: String? = null,
    val imageUrl: String? = null,
) {
    /** Stable identity for keyed collections (related id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "press-related-${hashCode()}"
}

/* ─── media kit ──────────────────────────────────────────────────────────── */

/**
 * One mediaKitAssets row (the handler has no select): the assetType groups
 * (logo | brand_guideline | photography | executive_photo |
 * product_screenshot | press_photo), the human title/description and the
 * REAL file coordinates the download affordance opens.
 */
@Immutable
@Serializable
data class MediaKitAssetDto(
    val id: String? = null,
    val assetType: String? = null,
    val title: String? = null,
    val description: String? = null,
    val fileUrl: String? = null,
    val thumbnailUrl: String? = null,
    val fileSizeMB: Double? = null,
    val fileFormat: String? = null,
    val isPublic: Boolean = true,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (asset id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "media-kit-${hashCode()}"
}

/** GET api/press/media-kit data — flat rows + the server's own grouping. */
@Immutable
@Serializable
data class MediaKitDto(
    val assets: List<MediaKitAssetDto> = emptyList(),
    /** { assetType: [rows] } straight from the handler (carried tolerant). */
    val grouped: Map<String, List<MediaKitAssetDto>> = emptyMap(),
    val assetTypes: List<String> = emptyList(),
    val total: Int = 0,
)

/* ─── events ─────────────────────────────────────────────────────────────── */

/**
 * One tradeEvents row (the handler has no select): title/description/
 * location/startsAt (+ optional endsAt/websiteUrl). isActive is consumed
 * server-side — everything on the wire is an ACTIVE event.
 */
@Immutable
@Serializable
data class TradeEventDto(
    val id: String? = null,
    val title: String? = null,
    val description: String? = null,
    val location: String? = null,
    val startsAt: String? = null,
    val endsAt: String? = null,
    /** External registration link if the fair has one (carried tolerant). */
    val websiteUrl: String? = null,
    val isActive: Boolean = true,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (event id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "trade-event-${hashCode()}"
}

/* ─── newsletter ─────────────────────────────────────────────────────────── */

/**
 * POST api/newsletter body — the route reads email (required) and source
 * (optional, trimmed to 40 chars, default 'footer'). The native screen is
 * the footer bar's twin and keeps the same constant source.
 */
@Immutable
@Serializable
data class NewsletterSubscribeBody(
    val email: String,
    /** The web footer's constant — kept verbatim. */
    val source: String = "footer",
)

/**
 * POST api/newsletter success body: { success, data: { alreadySubscribed }
 * } (200 when the email was already on the list, 201 when freshly created).
 * Error statuses (400 invalid email / 429 rate limit / 500) carry
 * { error } instead — parsed via [parseErrorBody].
 */
@Immutable
@Serializable
data class NewsletterAckDto(
    val success: Boolean = false,
    val data: NewsletterAckDataDto? = null,
    val error: String? = null,
)

/** The alreadySubscribed flag — the verbatim message branch selector. */
@Immutable
@Serializable
data class NewsletterAckDataDto(
    val alreadySubscribed: Boolean = false,
)
