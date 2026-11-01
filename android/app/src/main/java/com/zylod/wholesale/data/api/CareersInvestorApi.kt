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
 * Careers / company / investor-relations surfaces (t264) — the REAL routes
 * behind the twelve native pageIds (careers, careers-page, career-page,
 * career-benefits, career-culture, career-life, career-internships,
 * company-milestones, company-values, investor-relations,
 * investor-presentation, investor-contact). Every route was verified
 * against its src/app/api handler:
 *
 *  - GET api/careers?department=&locationType=&employmentType=&featured=
 *    (PUBLIC, no rate limit): 200 { success, data: { jobs: [row], total,
 *    departmentCounts: {dept: n}, departments: [string] } } — every
 *    isActive jobListings row whose expiresAt is null or in the future,
 *    ordered isFeatured DESC then createdAt DESC, projected to id/title/
 *    slug/department/locationType/location/employmentType/salaryMin/
 *    salaryMax/currency/isFeatured/applicationCount/expiresAt/createdAt.
 *    The web careers page fetches ONCE with NO params and filters
 *    client-side (department chips) — the native screen mirrors that.
 *  - GET api/careers/{id} (PUBLIC): id-or-slug lookup on an ACTIVE row →
 *    200 { success, data: { ...full jobListings row, applicationCount:
 *    _count.applications, similarJobs: [summary x3], isExpired } }.
 *    404 { error: "Job not found or no longer active" }. The web composes
 *    this behind the job-detail page; the native careers screen composes
 *    it for the INLINE apply card (the Role Overview the candidate sees
 *    before the web's Apply button) — the only screen-reachable consumer
 *    in this batch.
 *  - POST api/careers/apply (PUBLIC, rate limit 5/min 'careers-apply'):
 *    body { jobId, applicantName, applicantEmail, applicantPhone?,
 *    resumeUrl?, coverLetter?, portfolioUrl?, linkedInUrl?, yearsExp? } —
 *    the handler is a plain destructure, NOT zod: only jobId +
 *    applicantName + applicantEmail are REQUIRED (the web form's HTML
 *    `required` on phone/resume is stricter than the wire). 400 { error:
 *    "jobId, applicantName, and applicantEmail are required" }; 404
 *    "Job listing not found or no longer accepting applications"; 409
 *    "You have already applied for this position" (same email + job);
 *    429 the shared 'Too many requests. Try again in Ns.' envelope; 201
 *    { success, message: "Application submitted successfully! We will
 *    review and be in touch.", data: { applicationId, applicationRef:
 *    "APP-XXXXXXXX", jobTitle, status: "submitted", appliedAt } }.
 *    yearsExp is parsed server-side via parseInt when truthy — a blank or
 *    non-numeric value is sent as ABSENT, never fabricated.
 *  - GET api/investor?docType=&fiscalYear= (PUBLIC, no rate limit): 200
 *    { success, data: { documents: [full investorDocuments row], grouped:
 *    {docType: [row]}, years: [string], docTypes: [string], total } } —
 *    every isPublished doc ordered fiscalYear DESC then publishedAt DESC.
 *    The web maps investor-relations onto the BARE route (client groups)
 *    and investor-presentation onto docType=investor_presentation — the
 *    native screens compose the exact same two calls.
 *  - POST api/investor/contact (PUBLIC, rate limit 5/min
 *    'investor-contact'): body { name, email, phone?, company?,
 *    inquiryType, message } — again a plain destructure: name + email +
 *    inquiryType + message required (400 "name, email, inquiryType, and
 *    message are required"), inquiryType checked against the route's
 *    7-value list (400 "Invalid inquiry type"; the web select offers six
 *    of them — shareholder_services exists on the wire but no web UI
 *    offers it, so the native form mirrors the web's six). 201 { success,
 *    message: "Your investor inquiry has been received and saved for
 *    review.", data: { inquiryId, ref: "IR-XXXXXXXX", submittedAt } }.
 *  - GET api/about/milestones?year= (PUBLIC, no rate limit): 200 { success,
 *    data: { milestones: [full companyMilestones row], years: [int],
 *    total } } — isPublished rows ordered year ASC then sortOrder ASC.
 *    Rides in this interface because the company-milestones screen (this
 *    batch) is its only native consumer.
 *
 *  HONEST OMISSION: GET api/investor/{id} exists on the web but NO web
 *  page composes it (doc cards anchor straight to fileUrl; verified by
 *  grep) and no screen in this batch reaches it — so it is NOT declared
 *  here (the "only what screens use" rule; dead Retrofit declarations
 *  would be untestable wire claims).
 *
 * AUTH: all six routes are PUBLIC — no sign-in gate anywhere (the t255
 * SupportPublicApi convention: no per-call @Header; the shared ApiClient
 * OkHttp client attaches the Bearer token when a session exists and every
 * route here ignores it).
 *
 * WIRE NOTES (dc74841 lesson applied everywhere): every field is
 * nullable-with-default so shape drift degrades into tolerant mappers
 * instead of failing the whole screen's parse; POST bodies keep the
 * required fields non-null (mirroring the handlers' destructure) and the
 * optionals nullable (explicitNulls drops them from the JSON when unset).
 */
interface CareersInvestorApi {
    /* ── Careers (careers / careers-page / career-page) ─────────────────── */

    /** GET api/careers — every active, unexpired opening + the dept stats. */
    @GET("api/careers")
    suspend fun careers(
        @Query("department") department: String? = null,
        @Query("locationType") locationType: String? = null,
        @Query("employmentType") employmentType: String? = null,
        @Query("featured") featured: Boolean? = null,
    ): Response<ApiEnvelope<CareersListDto>>

    /** GET api/careers/{id} — one ACTIVE job by id OR slug (404 → verbatim). */
    @GET("api/careers/{id}")
    suspend fun careerJob(@Path("id") id: String): Response<ApiEnvelope<CareerJobDetailDto>>

    /** POST api/careers/apply — the 5/min-capped application submit. */
    @POST("api/careers/apply")
    suspend fun applyToJob(@Body body: CareersApplyBody): Response<CareersApplyAckDto>

    /* ── Investor documents (investor-relations / investor-presentation) ── */

    /** GET api/investor — published docs (optionally server-filtered by type). */
    @GET("api/investor")
    suspend fun investorDocs(
        @Query("docType") docType: String? = null,
        @Query("fiscalYear") fiscalYear: String? = null,
    ): Response<ApiEnvelope<InvestorListDto>>

    /** POST api/investor/contact — the IR inquiry (201 with the IR-ref). */
    @POST("api/investor/contact")
    suspend fun submitInvestorContact(@Body body: InvestorContactBody): Response<InvestorContactAckDto>

    /* ── Company milestones (company-milestones) ────────────────────────── */

    /** GET api/about/milestones — the published journey timeline. */
    @GET("api/about/milestones")
    suspend fun milestones(@Query("year") year: Int? = null): Response<ApiEnvelope<MilestonesListDto>>
}

/* ─── careers rows ───────────────────────────────────────────────────────── */

/**
 * One jobListings row as the LIST route's select projects it — exactly the
 * fourteen projected columns (id/title/slug/department/locationType/
 * location/employmentType/salaryMin/salaryMax/currency/isFeatured/
 * applicationCount/expiresAt/createdAt).
 */
@Immutable
@Serializable
data class CareerJobRowDto(
    val id: String? = null,
    val title: String? = null,
    val slug: String? = null,
    /** Engineering | Design | Marketing | Sales | Operations | Legal | Finance | HR */
    val department: String? = null,
    /** remote | onsite | hybrid */
    val locationType: String? = null,
    val location: String? = null,
    /** full_time | part_time | contract | intern */
    val employmentType: String? = null,
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val currency: String? = null,
    val isFeatured: Boolean = false,
    val applicationCount: Int = 0,
    val expiresAt: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (job id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "career-job-${hashCode()}"

    /**
     * The detail-route lookup key — the web navigates with
     * { id: job.slug || job.id }, so the slug wins when the payload has one.
     */
    val lookupKey: String
        get() = slug?.takeIf(String::isNotBlank)
            ?: id?.takeIf(String::isNotBlank)
            ?: stableKey
}

/** GET api/careers data — the openings page + the server's department stats. */
@Immutable
@Serializable
data class CareersListDto(
    val jobs: List<CareerJobRowDto> = emptyList(),
    val total: Int = 0,
    /** { department: count } straight from the handler (carried tolerant). */
    val departmentCounts: Map<String, Int> = emptyMap(),
    val departments: List<String> = emptyList(),
)

/** One same-department sibling (the [id] route's take-3 projection). */
@Immutable
@Serializable
data class CareerSimilarJobDto(
    val id: String? = null,
    val title: String? = null,
    val slug: String? = null,
    val department: String? = null,
    val locationType: String? = null,
    val employmentType: String? = null,
) {
    /** Stable identity for keyed collections (sibling id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "career-similar-${hashCode()}"
}

/**
 * One FULL jobListings row (the [id] handler has NO select — every schema
 * column arrives, descriptionEn/requirementsEn/benefitsEn included) + the
 * application count (server-side _count.applications), the 3 same-department
 * siblings and the server's own isExpired verdict.
 */
@Immutable
@Serializable
data class CareerJobDetailDto(
    val id: String? = null,
    val title: String? = null,
    val slug: String? = null,
    val department: String? = null,
    val locationType: String? = null,
    val location: String? = null,
    val employmentType: String? = null,
    val salaryMin: Int? = null,
    val salaryMax: Int? = null,
    val currency: String? = null,
    /** PLAIN TEXT — the web renders it whitespace-pre-wrap, one block. */
    val descriptionEn: String? = null,
    val requirementsEn: String? = null,
    val benefitsEn: String? = null,
    val isActive: Boolean = true,
    val isFeatured: Boolean = false,
    val expiresAt: String? = null,
    val applicationCount: Int = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val similarJobs: List<CareerSimilarJobDto> = emptyList(),
    val isExpired: Boolean = false,
)

/* ─── careers apply ──────────────────────────────────────────────────────── */

/**
 * POST api/careers/apply body — the handler's exact destructure. The three
 * required fields are non-null (the client gate blocks a blank name/email
 * with the route's verbatim 400 text before any wire call); the optionals
 * are nullable and dropped from the JSON entirely when unset
 * (ApiClient.json sets explicitNulls = false). yearsExp is an Int — the
 * route parseInts a truthy string; the native screen only sends it when
 * the candidate typed a whole number (never a fabricated default).
 */
@Immutable
@Serializable
data class CareersApplyBody(
    val jobId: String,
    val applicantName: String,
    val applicantEmail: String,
    val applicantPhone: String? = null,
    val resumeUrl: String? = null,
    val coverLetter: String? = null,
    val portfolioUrl: String? = null,
    val linkedInUrl: String? = null,
    val yearsExp: Int? = null,
)

/**
 * POST api/careers/apply success body (201): { success, message, data:
 * { applicationId, applicationRef, jobTitle, status, appliedAt } }. Error
 * statuses (400 / 404 / 409 / 429 / 500) carry { error } instead — parsed
 * via [parseErrorBody].
 */
@Immutable
@Serializable
data class CareersApplyAckDto(
    val success: Boolean = false,
    val message: String? = null,
    val data: CareersApplyAckDataDto? = null,
    val error: String? = null,
)

/** The application receipt — applicationRef is the APP-XXXXXXXX code. */
@Immutable
@Serializable
data class CareersApplyAckDataDto(
    val applicationId: String? = null,
    val applicationRef: String? = null,
    val jobTitle: String? = null,
    val status: String? = null,
    val appliedAt: String? = null,
)

/* ─── investor documents ─────────────────────────────────────────────────── */

/**
 * One investorDocuments row (the handler has NO select): docType/title/
 * fiscalYear/fiscalQ/fileUrl/summary/isPublished/publishedAt/createdAt.
 * fileUrl is the REAL document link the download affordance opens
 * (ACTION_VIEW, http/https only).
 */
@Immutable
@Serializable
data class InvestorDocDto(
    val id: String? = null,
    /** annual_report | quarterly_report | financial_filing | investor_presentation | shareholder_letter */
    val docType: String? = null,
    val title: String? = null,
    val fiscalYear: String? = null,
    val fiscalQ: String? = null,
    val fileUrl: String? = null,
    val summary: String? = null,
    val isPublished: Boolean = true,
    val publishedAt: String? = null,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (doc id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "investor-doc-${hashCode()}"
}

/** GET api/investor data — flat rows + the server's own grouping + years. */
@Immutable
@Serializable
data class InvestorListDto(
    val documents: List<InvestorDocDto> = emptyList(),
    /** { docType: [rows] } straight from the handler (carried tolerant). */
    val grouped: Map<String, List<InvestorDocDto>> = emptyMap(),
    val years: List<String> = emptyList(),
    val docTypes: List<String> = emptyList(),
    val total: Int = 0,
)

/* ─── investor contact ───────────────────────────────────────────────────── */

/**
 * POST api/investor/contact body — the handler's exact destructure with the
 * four required fields non-null (the client gate blocks blanks with the
 * route's verbatim 400 text) and phone/company nullable (dropped when
 * unset). inquiryType is one of the web select's six values (the wire
 * accepts a seventh, shareholder_services, that no web UI offers).
 */
@Immutable
@Serializable
data class InvestorContactBody(
    val name: String,
    val email: String,
    val inquiryType: String,
    val message: String,
    val phone: String? = null,
    val company: String? = null,
)

/**
 * POST api/investor/contact success body (201): { success, message, data:
 * { inquiryId, ref, submittedAt } } — ref is the IR-XXXXXXXX code the web
 * success card prints. Error statuses carry { error } — parsed via
 * [parseErrorBody].
 */
@Immutable
@Serializable
data class InvestorContactAckDto(
    val success: Boolean = false,
    val message: String? = null,
    val data: InvestorContactAckDataDto? = null,
    val error: String? = null,
)

/** The inquiry receipt — ref is the IR-XXXXXXXX code. */
@Immutable
@Serializable
data class InvestorContactAckDataDto(
    val inquiryId: String? = null,
    val ref: String? = null,
    val submittedAt: String? = null,
)

/* ─── company milestones ─────────────────────────────────────────────────── */

/**
 * One companyMilestones row (the handler has no select): year/month/title/
 * description/iconType/sortOrder/isPublished/createdAt. iconType is one of
 * the admin console's eight glyphs (star/rocket/users/package/globe/award/
 * building/trending); anything else renders the honest Star default — the
 * same fallback the web page uses.
 */
@Immutable
@Serializable
data class MilestoneDto(
    val id: String? = null,
    val year: Int = 0,
    val month: Int? = null,
    val title: String? = null,
    val description: String? = null,
    val iconType: String? = null,
    val sortOrder: Int = 0,
    val isPublished: Boolean = true,
    val createdAt: String? = null,
) {
    /** Stable identity for keyed collections (milestone id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "milestone-${hashCode()}"
}

/** GET api/about/milestones data — the timeline + the covered years. */
@Immutable
@Serializable
data class MilestonesListDto(
    val milestones: List<MilestoneDto> = emptyList(),
    val years: List<Int> = emptyList(),
    val total: Int = 0,
)
