package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Complaints / dispute + buyer-query surfaces (t261) — the REAL routes behind
 * the twelve native complaints pageIds (buyer-complaints, raise-complaint,
 * dispute-center, disputes-page, raise-dispute, dispute-detail,
 * dispute-resolution, dispute-guide, dispute-resolution-guide,
 * seller-order-disputes, customer-query-detail, arbitration-guide). Every
 * route below was verified against its src/app/api handler AND the SPA
 * component each pageId actually loads (src/lib/page-chunks):
 *
 *  - GET api/complaints (complaints/route.ts GET) — BUYER-SCOPED
 *    (authenticateRequest): a guest gets 401 { error: auth.error } and the
 *    list answers only THIS buyer's rows newest-first. Optional ?status=
 *    (open|in_review|resolved|rejected|withdrawn|all, zod-validated —
 *    anything else is a 400 { error: 'Invalid query parameters', issues })
 *    and ?take (1..100, default 100). The SPA's buyer-complaints /
 *    dispute-center components fetch '?take=100' with no status param; the
 *    native list adds the route's OWN status chips because the route really
 *    supports the filter.
 *  - POST api/complaints (complaints/route.ts POST) — file a complaint.
 *    Zod { category: order_issue|product_quality|delivery|payment|
 *    seller_behavior|other, title 3..120, description 10..5000, orderId?,
 *    subOrderId? }. Errors: 401 first; 400 'Invalid payload' + issues field
 *    map (also 400 'A sub-order reference requires the orderId of the order
 *    it belongs to'); 404 'Order not found' / 403 'Not authorized' when the
 *    orderId does not exist / belongs to another buyer; 400 'Sub-order does
 *    not belong to this order'. Success 201 { success, data: the created
 *    serializeComplaint row (status 'open'), message: 'Complaint filed. Your
 *    reference is <id> — it is now open and waiting for review by the Zylod
 *    team.' }. The cuid id IS the reference — no invented numbers.
 *  - GET api/complaints/[id] (complaints/[id]/route.ts) — one complaint,
 *    owner-or-admin only (403 'Not authorized to view this complaint'
 *    otherwise), 404 'Complaint not found'. data = serializeComplaint +
 *    evidencePhotos (Task 49-b metadata: id, mimeType, sizeBytes, note,
 *    createdAt, url '/api/attachments/<id>'). NOTE: the WEB dispute-detail
 *    pageId renders a static "disputes aren't connected yet" placeholder —
 *    but this detail route is REAL (the web's own buyer-complaints page
 *    consumes it for the per-row evidence manager), so the native
 *    dispute-detail composes it instead of shipping a dead-end.
 *  - POST api/complaints/[id]/withdraw (complaints/[id]/withdraw/route.ts) —
 *    the OWNER pulls the complaint back. Owner ONLY (even an admin gets 403
 *    'Only the buyer who filed this complaint can withdraw it'); only an
 *    'open' complaint can be withdrawn — anything else 409 with the REAL
 *    current status spelled out ("This complaint is currently 'in_review' —
 *    only open complaints can be withdrawn."); 404 'Complaint not found'.
 *    Success 200 { success, data: the withdrawn row, message: 'Complaint
 *    withdrawn. It is closed and will no longer be reviewed.' }.
 *  - GET api/supplier/queries/[id] (supplier/queries/[id]/route.ts GET) —
 *    the REAL thread behind the seller console's query rows (the web
 *    customer-query-detail component's only fetch). requireUserType
 *    (['supplier','admin']) → a buyer session gets 401 with the route's
 *    "Access denied. Required: supplier or admin" auth.error; a session
 *    without a supplierProfile gets 403 SUPPLIER_PROFILE_REQUIRED ('Supplier
 *    profile required. Only registered suppliers can access seller data.');
 *    a foreign/unknown id is 404 'Query not found' (no existence leak).
 *    data = the sellerCustomerQueries row + buyerName (business name ||
 *    full name || 'Anonymous buyer') + productName.
 *  - PATCH api/supplier/queries/[id] — the reply (replyMessage 1..2000)
 *    and/or a status transition (open|replied|resolved|closed). A reply
 *    stamps repliedAt and flips status to 'replied' server-side; an empty
 *    PATCH is 400 'Nothing to update — send replyMessage and/or status.';
 *    400 'Reply message cannot be empty' over the zod limit. Success 200
 *    { success, data: the updated row, message: 'Query updated' }.
 *  - GET api/queries (queries/route.ts GET) — the buyer's OWN query filings
 *    newest-first (supplierName + product name joined). requireUserType
 *    (['buyer']). data = { queries: [...] }. Declared for wire fidelity per
 *    the t261 route survey (the web's buyer-queries-page component consumes
 *    it) — NO t261 pageId hosts that component, so no native screen calls
 *    it; it is NOT rendered from any fabricated list.
 *  - POST api/queries (queries/route.ts POST) — the buyer→seller question
 *    rail: strict zod { productId? | supplierId? (at least one, else
 *    'A store or a product is required'), queryType: pre_order|
 *    custom_request|complaint, subject 3..160, message 5..2000 }. Success
 *    201 { success, data: { id, status: 'open' }, message: 'Query filed —
 *    the seller has been notified.' }. Same declaration-only status as the
 *    GET (the web's seller-storefront ask form consumes it; no t261 pageId
 *    hosts that form).
 *  - POST api/support/report-problem (support/report-problem/route.ts) —
 *    the REAL POST behind BOTH raise-complaint AND raise-dispute (both
 *    pageIds load the SAME web component, raise-complaint-page.tsx, which
 *    files a feedbackSubmissions bug_report row — NOT a complaints row).
 *    Body { issueType, subject, description, pageContext }; the server
 *    400s 'Subject and description are required' when either is missing,
 *    rate-limits 5/min. Success 201 { success, data: the feedback row (the
 *    id is the reference), message: 'Bug report received. Our engineering
 *    team has been notified.' }. Auth is OPTIONAL on this route (a guest
 *    still files, but the web component treats 401/403 as its sign-in gate).
 *
 *  - api/complaints/[id]/evidence (POST multipart upload + DELETE
 *    .../evidence/[photoId]) are deliberately NOT declared: the byte upload
 *    is a multipart file POST the t261 screens do not exercise (no photo
 *    picker on any of the twelve surfaces), and the evidence LIST the
 *    detail screen renders comes from the GET [id] response above. The
 *    photo BYTES stay behind the authed /api/attachments/[id] route, so
 *    the native evidence section renders the honest metadata rows only.
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every response field is
 * nullable-with-default so shape drift degrades into the screen mappers;
 * bodies give their server-required fields NO Kotlin default (the
 * ReturnSubmitBody convention — always serialized). No money fields exist
 * on these routes; timestamps are ISO strings verbatim.
 */
interface ComplaintsApi {

    /* ─── complaints (api/complaints) ─────────────────────────────────────── */

    /**
     * GET api/complaints — the buyer's own complaints, newest-first. The
     * [status] chip values are the route's exact wire tokens (null / "all" =
     * the skip token the server defaults to).
     */
    @GET("api/complaints")
    suspend fun complaints(
        @Query("status") status: String? = null,
        @Query("take") take: Int = 100,
    ): Response<ApiEnvelope<List<ComplaintDto>>>

    /**
     * POST api/complaints — file a complaint. The route's verbatim 400/403/
     * 404 texts (and the 400 issues field map) surface in the screen; the
     * 201 message carries the REAL created id.
     */
    @POST("api/complaints")
    suspend fun fileComplaint(@Body body: ComplaintCreateBody): Response<ComplaintMutationEnvelope>

    /**
     * GET api/complaints/{id} — one complaint + its evidencePhotos metadata.
     * Owner-or-admin only; 404 'Complaint not found' for unknown ids.
     */
    @GET("api/complaints/{id}")
    suspend fun complaintDetail(@Path("id") id: String): Response<ApiEnvelope<ComplaintDetailDto>>

    /**
     * POST api/complaints/{id}/withdraw — owner-only, open-only withdrawal.
     * 409 carries the real current status in its verbatim error text.
     */
    @POST("api/complaints/{id}/withdraw")
    suspend fun withdrawComplaint(@Path("id") id: String): Response<ComplaintMutationEnvelope>

    /* ─── the seller-side query thread (api/supplier/queries/[id]) ────────── */

    /** GET api/supplier/queries/{id} — supplier/admin-scoped query thread. */
    @GET("api/supplier/queries/{id}")
    suspend fun supplierQuery(@Path("id") id: String): Response<ApiEnvelope<SupplierQueryDto>>

    /**
     * PATCH api/supplier/queries/{id} — the seller's reply and/or status
     * transition (the customer-query-detail page's real actions).
     */
    @PATCH("api/supplier/queries/{id}")
    suspend fun updateSupplierQuery(
        @Path("id") id: String,
        @Body body: SupplierQueryPatchBody,
    ): Response<ApiEnvelope<SupplierQueryDto>>

    /* ─── buyer query rail (api/queries — declared, see KDoc) ─────────────── */

    /** GET api/queries — the buyer's own filings (declaration-only; see above). */
    @GET("api/queries")
    suspend fun myQueries(): Response<ApiEnvelope<BuyerQueriesData>>

    /** POST api/queries — the buyer ask-question rail (declaration-only). */
    @POST("api/queries")
    suspend fun askQuery(@Body body: QueryCreateBody): Response<QueryCreateAckEnvelope>

    /* ─── the raise-complaint / raise-dispute pageIds' REAL POST ──────────── */

    /**
     * POST api/support/report-problem — the form BOTH raise pageIds submit
     * (raise-complaint-page.tsx files a feedbackSubmissions bug_report, not
     * a complaints row). The id in the 201 data is the reference the web
     * shows.
     */
    @POST("api/support/report-problem")
    suspend fun reportProblem(@Body body: ReportProblemBody): Response<ReportProblemEnvelope>
}

/* ─── complaints (GET/POST api/complaints, GET [id], POST withdraw) ──────── */

/**
 * One complaints row as serializeComplaint projects it (lib/complaints.ts
 * verbatim field set). The cuid id IS the complaint reference; status is
 * the server-guarded lifecycle token (open | in_review | resolved |
 * rejected | withdrawn) — never client-set.
 */
@Immutable
@Serializable
data class ComplaintDto(
    val id: String? = null,
    val buyerId: String? = null,
    val orderId: String? = null,
    val subOrderId: String? = null,
    val category: String? = null,
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
    val resolutionNote: String? = null,
    val resolvedById: String? = null,
    val resolvedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Stable identity for keyed collections (complaint id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "complaint-${hashCode()}"
}

/**
 * One evidencePhotos metadata row as GET api/complaints/[id] carries it
 * (complaints/[id]/route.ts via lib/evidence listEvidence): the bytes stay
 * behind the authed /api/attachments/[id] route ([url]).
 */
@Immutable
@Serializable
data class ComplaintEvidencePhotoDto(
    val id: String? = null,
    val mimeType: String? = null,
    val sizeBytes: Long? = null,
    val note: String? = null,
    val createdAt: String? = null,
    val url: String? = null,
) {
    /** Stable identity for keyed collections (photo id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "evidence-${hashCode()}"
}

/**
 * data of GET api/complaints/[id] — the full serializeComplaint projection
 * PLUS the evidencePhotos metadata list (empty when the buyer attached no
 * photos; never fabricated).
 */
@Immutable
@Serializable
data class ComplaintDetailDto(
    val id: String? = null,
    val buyerId: String? = null,
    val orderId: String? = null,
    val subOrderId: String? = null,
    val category: String? = null,
    val title: String? = null,
    val description: String? = null,
    val status: String? = null,
    val resolutionNote: String? = null,
    val resolvedById: String? = null,
    val resolvedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val evidencePhotos: List<ComplaintEvidencePhotoDto> = emptyList(),
)

/**
 * Outgoing POST api/complaints body — the route's exact zod field set
 * (complaints/route.ts:20-26). category/title/description have NO Kotlin
 * default (server-required, always serialized); orderId/subOrderId ride
 * only when the buyer named them (the web omits the keys entirely then).
 */
@Immutable
@Serializable
data class ComplaintCreateBody(
    val category: String,
    val title: String,
    val description: String,
    val orderId: String? = null,
    val subOrderId: String? = null,
)

/**
 * Envelope of the POST api/complaints 201 and the POST withdraw 200 —
 * { success, data: the serializeComplaint row, message }. Error answers
 * ({ error } and 401 auth.error) land in the error body, parsed separately.
 */
@Immutable
@Serializable
data class ComplaintMutationEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val data: ComplaintDto? = null,
    val error: String? = null,
)

/**
 * Error body of the complaints routes — the zod 400 shape is
 * { error: 'Invalid payload', issues: { field: [messages] } }; every other
 * failure is { error }. The screen joins the issue messages like the web
 * component does (`msg: fieldErrors.join('; ')`).
 */
@Serializable
data class ComplaintErrorDto(
    val error: String? = null,
    val issues: Map<String, List<String>> = emptyMap(),
) {
    /** The web's exact message composition (verbatim server text). */
    fun displayMessage(fallback: String): String {
        val base = error?.takeIf(String::isNotBlank) ?: return fallback
        val fieldErrors = issues.values.flatten().filter(String::isNotBlank)
        return if (fieldErrors.isEmpty()) base else "$base: ${fieldErrors.joinToString("; ")}"
    }
}

/** Parses a complaints-route error body with the shared lenient Json. */
fun parseComplaintError(body: okhttp3.ResponseBody?): ComplaintErrorDto {
    val raw = body?.string()
    if (raw.isNullOrBlank()) return ComplaintErrorDto()
    return runCatching { ApiClient.json.decodeFromString(ComplaintErrorDto.serializer(), raw) }
        .getOrDefault(ComplaintErrorDto())
}

/* ─── the seller-side query thread (api/supplier/queries/[id]) ───────────── */

/**
 * One sellerCustomerQueries row as GET api/supplier/queries/[id] answers it
 * (the raw prisma columns + the resolved buyerName / productName). The
 * PATCH 200 data is the same row BEFORE the buyer/product names are
 * re-resolved, so those two stay nullable.
 */
@Immutable
@Serializable
data class SupplierQueryDto(
    val id: String? = null,
    val supplierId: String? = null,
    val buyerId: String? = null,
    val productId: String? = null,
    val queryType: String? = null,
    val subject: String? = null,
    val message: String? = null,
    val status: String? = null,
    val replyMessage: String? = null,
    val repliedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val buyerName: String? = null,
    val productName: String? = null,
) {
    /** Stable identity for keyed collections (query id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "query-${hashCode()}"

    /** The web's isClosed gate — the reply composer hides once decided. */
    val isClosed: Boolean
        get() = status == "closed" || status == "resolved"
}

/**
 * Outgoing PATCH api/supplier/queries/[id] body — the route's exact zod
 * field set (replyMessage 1..2000 and/or status open|replied|resolved|
 * closed). Both optional; an all-null body is the route's honest 400
 * ('Nothing to update — send replyMessage and/or status.') which the
 * client guard refuses before the wire anyway.
 */
@Immutable
@Serializable
data class SupplierQueryPatchBody(
    val replyMessage: String? = null,
    val status: String? = null,
)

/* ─── buyer query rail (api/queries — declared per the route survey) ─────── */

/** data of GET api/queries — { queries: [...] } (queries/route.ts:162-178). */
@Immutable
@Serializable
data class BuyerQueriesData(
    val queries: List<BuyerQueryRowDto> = emptyList(),
)

/**
 * One GET api/queries row (queries/route.ts:165-176 verbatim): the buyer's
 * own filing with the seller's companyName and the product name resolved.
 */
@Immutable
@Serializable
data class BuyerQueryRowDto(
    val id: String? = null,
    val queryType: String? = null,
    val subject: String? = null,
    val message: String? = null,
    val status: String? = null,
    val replyMessage: String? = null,
    val repliedAt: String? = null,
    val createdAt: String? = null,
    val supplierName: String? = null,
    val product: BuyerQueryProductDto? = null,
) {
    /** Stable identity for keyed collections (query id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "buyer-query-${hashCode()}"
}

/** The product projection GET api/queries nests on rows with a productId. */
@Immutable
@Serializable
data class BuyerQueryProductDto(
    val id: String? = null,
    val name: String? = null,
)

/**
 * Outgoing POST api/queries body — the route's strict zod field set
 * (queries/route.ts:29-38). queryType/subject/message have NO Kotlin
 * default (server-required); at least one of productId/supplierId must be
 * sent ('A store or a product is required' otherwise).
 */
@Immutable
@Serializable
data class QueryCreateBody(
    val productId: String? = null,
    val supplierId: String? = null,
    val queryType: String,
    val subject: String,
    val message: String,
)

/**
 * Envelope of the POST api/queries 201 — { success, data: { id, status },
 * message: 'Query filed — the seller has been notified.' }.
 */
@Immutable
@Serializable
data class QueryCreateAckEnvelope(
    val success: Boolean = false,
    val data: QueryCreateAckDto? = null,
    val message: String? = null,
    val error: String? = null,
)

/** data of the POST api/queries 201 (queries/route.ts:126 verbatim). */
@Immutable
@Serializable
data class QueryCreateAckDto(
    val id: String? = null,
    val status: String? = null,
)

/* ─── the raise-complaint / raise-dispute pageIds' REAL POST ─────────────── */

/**
 * Outgoing POST api/support/report-problem body — the EXACT field set the
 * web raise-complaint-page.tsx sends (issueType token, the composed
 * subject, the statement, and the fixed pageContext marker). subject/
 * description are server-required (no Kotlin default); the desired-outcome
 * amount the web renders is display-only there and stays display-only here.
 */
@Immutable
@Serializable
data class ReportProblemBody(
    val issueType: String,
    val subject: String,
    val description: String,
    val pageContext: String,
)

/**
 * Envelope of the POST api/support/report-problem 201 — { success, data:
 * the feedbackSubmissions row, message }. The web surfaces ONLY data.id as
 * the reference; the other columns ride for shape fidelity.
 */
@Immutable
@Serializable
data class ReportProblemEnvelope(
    val success: Boolean = false,
    val message: String? = null,
    val data: ReportProblemRowDto? = null,
    val error: String? = null,
)

/**
 * The feedbackSubmissions row the report-problem 201 returns — the id IS
 * the reference (no invented case numbers; the t233-era fake #DSP- ids are
 * gone server-side).
 */
@Immutable
@Serializable
data class ReportProblemRowDto(
    val id: String? = null,
    val type: String? = null,
    val subject: String? = null,
    val status: String? = null,
    val pageContext: String? = null,
)
