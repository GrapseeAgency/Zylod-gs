package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Support surfaces — the REAL endpoints behind the seven native support /
 * help pageIds (t255: faq-page + helpdesk + docs-page + system-status +
 * system-health + contact-page + feedback-page). Every route was verified
 * against its src/app/api route handlers (Kotlin block comments nest — a
 * literal glob star-slash-star here would open an unterminated comment):
 *
 *  - GET api/support/faqs?category= (PUBLIC): 200 { success, data: [row],
 *    total } — the isActive faqItems rows ordered sortOrder/createdAt ASC.
 *    `category` is dropped for "all" exactly like the web. NOTE: the
 *    handler ignores any `limit` param (helpdesk passes ?limit=4 and the
 *    server still returns every row — the web renders what arrives).
 *  - POST api/support/faqs/{id}/vote (PUBLIC, rate limit 30/min → 429):
 *    body { helpful: Boolean }; 200 { success, data: updatedFaqRow } —
 *    the web faq page's helpful Yes/No vote (POST api/support/faqs itself
 *    is the ADMIN-ONLY FAQ creator — never called by any support page).
 *  - GET api/support/policies (PUBLIC): 200 { success, data:
 *    { tableOfContents: [{ category, articles: [{ id, slug, titleEn,
 *    titleBn, views }] }], totalArticles, articles } } — the docs
 *    browser's sidebar TOC (docs-browser-page.tsx reads ONLY
 *    tableOfContents; the full articles array is carried tolerant).
 *  - GET api/support/articles?category=&q= (PUBLIC): 200 { success,
 *    data: [summary] } — the published helpArticles projection (id,
 *    category, slug, titleEn, titleBn, views, createdAt, updatedAt).
 *  - GET api/support/articles/{slug} (PUBLIC): 200 { success, data:
 *    fullArticle } / 404 { error: "Article not found" } — the docs
 *    browser's detail fetch (also increments views server-side).
 *  - POST api/support/articles/{slug}/feedback (PUBLIC, optional auth,
 *    rate limit 20/min): body { helpful, comment? }; 200 { success,
 *    message } — the docs page's "Was this documentation helpful?" widget.
 *  - GET api/support/status (PUBLIC): 200 { success, data:
 *    { overallStatus, lastChecked, services: [{ name, status, latencyMs,
 *    uptimePercent }] } } — the helpdesk System Status banner.
 *  - GET api/app/diagnostics (PUBLIC): NOT enveloped — 200 { success,
 *    status, timestamp, latencyMs, metrics{...}, services[...] } straight
 *    at the top level (500 { success: false, status: "degraded", error }).
 *    This is the payload of record for the shared service-status screen —
 *    service-status-page.tsx calls /api/app/diagnostics, NOT
 *    /api/support/status (which helpdesk uses).
 *  - GET api/settings/public (PUBLIC, rate limit 60/min): 200 { success,
 *    data: { settings, updatedAt } } — the owner-published support.email /
 *    support.phone the helpdesk "Reach the Team" card and the contact
 *    page's email card render (values may be string|number|boolean on the
 *    wire, so the maps carry JsonElement and the mappers keep primitives).
 *  - POST api/support/contact (PUBLIC, optional auth, rate limit 5/min →
 *    429): body { name, email, phone?, category, subject, message };
 *    400 "Name, email, subject, and message are required"; 201 { success,
 *    data: submission, message: "Your inquiry has been submitted..." }.
 *  - GET+POST api/support/feedback (PUBLIC, optional auth, POST rate
 *    limit 10/min): GET ?type=&limit= (max 50) → 200 { success, data:
 *    [communityWallRow] } — the wall NEVER carries submitter identity
 *    columns (the select projection is the exact shape below). POST body
 *    { type, subject, description, rating, pageContext? }; 400 "Type,
 *    subject, and description are required"; 201 { success, data: row,
 *    message: "Thank you for your feedback!..." }.
 *
 * AUTH: like every other authed API in this client (AddressesApi,
 * ReturnsApi, ReviewsApi …) there is NO per-call @Header — the shared
 * ApiClient OkHttp client attaches the Bearer token and owns the
 * 401→refresh→retry chain; all twelve routes here are public and simply
 * ignore the header when one is present (contact/feedback/diagnostics
 * accept it optionally to attribute the submission).
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into tolerant mappers
 * instead of failing the whole screen's parse; every nested type is
 * itself @Serializable; unknown siblings (e.g. the faqs route's `total`)
 * are ignored by the shared Json parser.
 */
interface SupportPublicApi {
    /* ── FAQs (faq-page) ─────────────────────────────────────────────────── */

    /** GET api/support/faqs?category= — active FAQ rows, category optional. */
    @GET("api/support/faqs")
    suspend fun faqs(@Query("category") category: String? = null): Response<ApiEnvelope<List<SupportFaqDto>>>

    /** POST api/support/faqs/{id}/vote — the helpful Yes/No vote. */
    @POST("api/support/faqs/{faqId}/vote")
    suspend fun voteFaq(
        @Path("faqId") faqId: String,
        @Body body: SupportFaqVoteBody,
    ): Response<ApiEnvelope<SupportFaqDto>>

    /* ── Docs browser (docs-page) ────────────────────────────────────────── */

    /** GET api/support/policies — the docs sidebar TOC (+ full article rows). */
    @GET("api/support/policies")
    suspend fun policies(): Response<ApiEnvelope<SupportPoliciesDto>>

    /** GET api/support/articles — the published-article list projection. */
    @GET("api/support/articles")
    suspend fun articles(
        @Query("category") category: String? = null,
        @Query("q") q: String? = null,
    ): Response<ApiEnvelope<List<SupportArticleSummaryDto>>>

    /** GET api/support/articles/{slug} — the full article detail (404 → error). */
    @GET("api/support/articles/{slug}")
    suspend fun article(@Path("slug") slug: String): Response<ApiEnvelope<SupportArticleDto>>

    /** POST api/support/articles/{slug}/feedback — the helpful widget. */
    @POST("api/support/articles/{slug}/feedback")
    suspend fun articleFeedback(
        @Path("slug") slug: String,
        @Body body: SupportArticleFeedbackBody,
    ): Response<SupportActionAckDto>

    /* ── Status (helpdesk banner + shared service-status screen) ─────────── */

    /** GET api/support/status — the helpdesk System Status banner payload. */
    @GET("api/support/status")
    suspend fun status(): Response<ApiEnvelope<SupportStatusDto>>

    /** GET api/app/diagnostics — the service-status screen's live probes. */
    @GET("api/app/diagnostics")
    suspend fun diagnostics(): Response<SupportDiagnosticsEnvelope>

    /* ── Owner-published contacts (helpdesk + contact-page) ──────────────── */

    /** GET api/settings/public — the isPublic admin settings registry. */
    @GET("api/settings/public")
    suspend fun publicSettings(): Response<ApiEnvelope<SupportPublicSettingsDto>>

    /* ── Contact form (contact-page) ─────────────────────────────────────── */

    /** POST api/support/contact — the inquiry form (201 with the message). */
    @POST("api/support/contact")
    suspend fun submitContact(@Body body: SupportContactBody): Response<SupportActionAckDto>

    /* ── Community feedback (feedback-page) ──────────────────────────────── */

    /** GET api/support/feedback?type=&limit= — the community wall. */
    @GET("api/support/feedback")
    suspend fun feedback(
        @Query("type") type: String? = null,
        @Query("limit") limit: Int = 20,
    ): Response<ApiEnvelope<List<SupportFeedbackItemDto>>>

    /** POST api/support/feedback — the Share Idea form (201 with message). */
    @POST("api/support/feedback")
    suspend fun submitFeedback(@Body body: SupportFeedbackBody): Response<SupportActionAckDto>
}

/* ─── faq rows (legalFaqs table) ─────────────────────────────────────────── */

/**
 * One faqItems row — the GET handler's exact projection (no select clause,
 * so every schema column can arrive). questionBn/answerBn back the page's
 * real EN/BN language toggle; helpfulYes/helpfulNo are the LIVE vote
 * counters the Yes/No buttons display.
 */
@Immutable
@Serializable
data class SupportFaqDto(
    val id: String? = null,
    /** The schema @map("docType") column — category values like "orders". */
    val category: String? = null,
    val questionEn: String? = null,
    val questionBn: String? = null,
    val answerEn: String? = null,
    val answerBn: String? = null,
    val sortOrder: Int = 0,
    val isActive: Boolean = true,
    val helpfulYes: Int = 0,
    val helpfulNo: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Stable identity for keyed collections (faq id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "support-faq-${hashCode()}"
}

/** POST api/support/faqs/{id}/vote body — the handler's exact destructure. */
@Immutable
@Serializable
data class SupportFaqVoteBody(val helpful: Boolean)

/* ─── help articles ──────────────────────────────────────────────────────── */

/**
 * One helpArticles row as the LIST route's select projects it (id,
 * category, slug, titleEn, titleBn, views, createdAt, updatedAt — no
 * content columns).
 */
@Immutable
@Serializable
data class SupportArticleSummaryDto(
    val id: String? = null,
    val category: String? = null,
    val slug: String? = null,
    val titleEn: String? = null,
    val titleBn: String? = null,
    val views: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/** One full helpArticles row — the [slug] detail route's projection. */
@Immutable
@Serializable
data class SupportArticleDto(
    val id: String? = null,
    val category: String? = null,
    val titleEn: String? = null,
    val contentEn: String? = null,
    val titleBn: String? = null,
    val contentBn: String? = null,
    val slug: String? = null,
    val views: Int = 0,
    val isPublished: Boolean = true,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Stable identity for keyed collections (article slug, hash fallback). */
    val stableSlug: String
        get() = slug?.takeIf(String::isNotBlank) ?: "support-article-${hashCode()}"
}

/** GET api/support/policies data — TOC sections + the full article rows. */
@Immutable
@Serializable
data class SupportPoliciesDto(
    val tableOfContents: List<SupportTocSectionDto> = emptyList(),
    val totalArticles: Int = 0,
    val articles: List<SupportArticleDto> = emptyList(),
)

/** One TOC section — the docs sidebar's grouped category heading. */
@Immutable
@Serializable
data class SupportTocSectionDto(
    val category: String? = null,
    val articles: List<SupportTocArticleDto> = emptyList(),
)

/** One TOC article link — id/slug/titles/views (no content). */
@Immutable
@Serializable
data class SupportTocArticleDto(
    val id: String? = null,
    val slug: String? = null,
    val titleEn: String? = null,
    val titleBn: String? = null,
    val views: Int = 0,
) {
    /** Stable identity for keyed collections (slug, hash fallback). */
    val stableKey: String
        get() = slug?.takeIf(String::isNotBlank) ?: "support-toc-${hashCode()}"
}

/** POST api/support/articles/{slug}/feedback body — handler destructure. */
@Immutable
@Serializable
data class SupportArticleFeedbackBody(
    val helpful: Boolean,
    val comment: String? = null,
)

/* ─── status payloads ────────────────────────────────────────────────────── */

/** GET api/support/status data — the helpdesk System Status banner. */
@Immutable
@Serializable
data class SupportStatusDto(
    /** "All Systems Operational" | "Partially Degraded" (server strings). */
    val overallStatus: String? = null,
    val lastChecked: String? = null,
    val services: List<SupportStatusServiceDto> = emptyList(),
)

/** One probed service row on the /status payload. */
@Immutable
@Serializable
data class SupportStatusServiceDto(
    val name: String? = null,
    val status: String? = null,
    val latencyMs: Int = 0,
    val uptimePercent: Double = 0.0,
)

/**
 * GET api/app/diagnostics — the RAW top-level body (NOT an ApiEnvelope:
 * success/status/timestamp/latencyMs/metrics/services all sit at the root,
 * and the 500 failure keeps the same shape with success=false + error).
 */
@Immutable
@Serializable
data class SupportDiagnosticsEnvelope(
    val success: Boolean = false,
    /** "operational" | "degraded" (the web's Overall Status card, verbatim). */
    val status: String? = null,
    val timestamp: String? = null,
    val latencyMs: Int = 0,
    val metrics: SupportDiagnosticsMetricsDto? = null,
    val services: List<SupportDiagnosticsServiceDto> = emptyList(),
    val error: String? = null,
)

/** The diagnostics metrics block (server uptime / db ping / memory). */
@Immutable
@Serializable
data class SupportDiagnosticsMetricsDto(
    val serverUptimeHours: Int = 0,
    val databaseLatencyMs: Int = 0,
    val activeProductRecords: Int = 0,
    val memoryUsageMB: Int = 0,
    val nodeEnvironment: String? = null,
)

/** One appDiagnostics row on the diagnostics services array. */
@Immutable
@Serializable
data class SupportDiagnosticsServiceDto(
    val serviceName: String? = null,
    val status: String? = null,
    val responseTimeMs: Int = 0,
    /** detailsJson parsed server-side — arbitrary JSON, kept tolerant. */
    val details: JsonElement? = null,
)

/* ─── public settings ────────────────────────────────────────────────────── */

/**
 * GET api/settings/public data. The registry types values as
 * string|number|boolean on the wire, so both maps carry JsonElement and
 * the mappers keep only string primitives — the web pickStringRecord's
 * exact behavior (non-string entries are dropped, never misrendered).
 */
@Immutable
@Serializable
data class SupportPublicSettingsDto(
    val settings: Map<String, JsonElement> = emptyMap(),
    val updatedAt: Map<String, JsonElement> = emptyMap(),
)

/** POST api/support/contact body — the handler's exact destructure. */
@Immutable
@Serializable
data class SupportContactBody(
    val name: String,
    val email: String,
    /** The web always sends the key ("" when empty → the route stores null). */
    val phone: String = "",
    val category: String,
    val subject: String,
    val message: String,
    /** Omitted from the wire (explicitNulls) — the native form has no upload. */
    val attachmentUrl: String? = null,
)

/* ─── community feedback ─────────────────────────────────────────────────── */

/**
 * One feedbackSubmissions row as the GET's community-wall select projects
 * it: id/type/subject/description/rating/status/pageContext/createdAt —
 * NO submitter identity columns (the route's select omits them by design).
 */
@Immutable
@Serializable
data class SupportFeedbackItemDto(
    val id: String? = null,
    /** suggestion | bug_report | feature_request | general_feedback | rating. */
    val type: String? = null,
    val subject: String? = null,
    val description: String? = null,
    val rating: Int? = null,
    /** new | reviewed | implemented | dismissed (GET filters to first three). */
    val status: String? = null,
    val pageContext: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (feedback id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "support-feedback-${hashCode()}"
}

/** POST api/support/feedback body — the handler's exact destructure. */
@Immutable
@Serializable
data class SupportFeedbackBody(
    val type: String,
    val subject: String,
    val description: String,
    /** The web form carries its constant default 5 — ported verbatim. */
    val rating: Int? = null,
    /** Omitted from the wire — the route defaults pageContext to its own. */
    val pageContext: String? = null,
)

/** The three POSTs' shared success body: { success, message } (+ data dropped). */
@Immutable
@Serializable
data class SupportActionAckDto(
    val success: Boolean = false,
    val message: String? = null,
)
