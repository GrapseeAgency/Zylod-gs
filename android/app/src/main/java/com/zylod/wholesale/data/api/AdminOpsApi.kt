package com.zylod.wholesale.data.api

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * t265 — ADMIN OPERATIONS surface: the eight GET endpoints behind the typed
 * admin-operations pageIds (audit-logs / deliveries / inspections / payments
 * / reports / settings / shipping / categories). Every shape below was read
 * from its route handler under src/app/api/admin (the single source of
 * truth), NOT invented:
 *
 *  - GET api/admin/audit-logs      — audit-logs/route.ts. requireUserType
 *    ['admin']; 401-first. Query page/limit/action(CONTAINS)/entityType/
 *    entityId/actorId. Response { success, data: [...], pagination,
 *    summary.byEntityType }.
 *  - GET api/admin/deliveries/…    — NO deliveries/route.ts exists: the
 *    listing surfaces are the two SUB-endpoints. deliveries/assignments/
 *    route.ts GET → { assignments: [...] } (bare object, no success flag);
 *    deliveries/drivers/route.ts GET → { drivers: [...] } (same).
 *  - GET api/admin/inspections     — inspections/route.ts. Query status
 *    (pending|scheduled|completed|failed). Response { success, data:
 *    { inspections, stats } } — pagination-free.
 *  - GET api/admin/payments        — payments/route.ts. Query status
 *    (pending|success|failed|refunded) + page/limit. Response { success,
 *    data, stats, pagination }.
 *  - GET api/admin/reports         — reports/route.ts. Query status/reason/
 *    limit. Response { success, data, metrics } — the row is the Prisma
 *    reportedUsers row SPREAD + reporter + reportedEntity.
 *  - GET api/admin/settings        — settings/route.ts. No query params.
 *    Response { success, data: { settings, dataNotes } } — the registry
 *    whitelist from src/lib/admin-settings.ts; value/defaultValue are
 *    int-or-string-or-null, so they arrive as JsonElement.
 *  - GET api/admin/shipping/…      — NO shipping/route.ts exists: the
 *    surface is the THREE sub-endpoints methods/ + rates/ + zones/ (Task
 *    94). Each returns { success, data: [...], count }.
 *  - GET api/admin/categories      — categories/route.ts. No query params.
 *    Response { success, data: { categories, stats, dataNotes } }.
 *
 * Every call returns Response<T> (CommerceApis convention — never a bare
 * DTO), so HTTP failures and envelope failures stay distinguishable and the
 * shared OkHttp client's Bearer header plus the 401-refresh-authenticator
 * chain apply unchanged.
 *
 * NUMERIC TYPING (AdminApi convention): Prisma Float columns (amount,
 * orderTotal, price, weightMin/Max, freeAbove, ratingAvg) are Double so
 * fractional JSON numbers never break parsing; counts stay Int. Every field
 * is optional-with-default so shape drift degrades gracefully instead of
 * failing the whole screen's parse. All nested JSON object types are
 * pre-declared as their own @Serializable classes below — a missing nested
 * type would be a CI compile failure.
 */
interface AdminOpsApi {

    @GET("api/admin/audit-logs")
    suspend fun auditLogs(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 30,
        // CONTAINS match on the action string (e.g. "payment"); null omits it.
        @Query("action") action: String? = null,
        @Query("entityType") entityType: String? = null,
        @Query("entityId") entityId: String? = null,
        @Query("actorId") actorId: String? = null,
    ): Response<AdminOpsAuditLogsEnvelope>

    @GET("api/admin/deliveries/assignments")
    suspend fun deliveryAssignments(): Response<AdminOpsAssignmentsEnvelope>

    @GET("api/admin/deliveries/drivers")
    suspend fun deliveryDrivers(): Response<AdminOpsDriversEnvelope>

    @GET("api/admin/inspections")
    suspend fun inspections(
        // pending | scheduled | completed | failed; null = no filter.
        @Query("status") status: String? = null,
    ): Response<AdminOpsInspectionsEnvelope>

    @GET("api/admin/payments")
    suspend fun payments(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        // pending | success | failed | refunded; null = no filter (the UI's
        // "All" chip omits the param, matching the handler's bare default).
        @Query("status") status: String? = null,
    ): Response<AdminOpsPaymentsEnvelope>

    @GET("api/admin/reports")
    suspend fun reports(
        // all | pending | under_review | action_taken | dismissed.
        @Query("status") status: String = "all",
        @Query("reason") reason: String = "all",
        @Query("limit") limit: Int = 50,
    ): Response<AdminOpsReportsEnvelope>

    @GET("api/admin/settings")
    suspend fun settings(): Response<AdminOpsSettingsEnvelope>

    @GET("api/admin/shipping/methods")
    suspend fun shippingMethods(): Response<AdminOpsShippingMethodsEnvelope>

    @GET("api/admin/shipping/rates")
    suspend fun shippingRates(): Response<AdminOpsShippingRatesEnvelope>

    @GET("api/admin/shipping/zones")
    suspend fun shippingZones(): Response<AdminOpsShippingZonesEnvelope>

    @GET("api/admin/categories")
    suspend fun categories(): Response<AdminOpsCategoriesEnvelope>
}

/* ── audit-logs (GET api/admin/audit-logs) ──────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsAuditLogsEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsAuditLogRow> = emptyList(),
    val pagination: Pagination? = null,
    val summary: AdminOpsAuditLogsSummary? = null,
)

@Immutable
@Serializable
data class AdminOpsAuditLogRow(
    val id: String? = null,
    val action: String? = null,
    val entityType: String? = null,
    val entityId: String? = null,
    /** Prisma `metadata String?` — audit rows stringify their JSON. */
    val metadata: String? = null,
    val createdAt: String? = null,
    val actor: AdminOpsAuditLogActor? = null,
)

@Immutable
@Serializable
data class AdminOpsAuditLogActor(
    val id: String? = null,
    val email: String? = null,
    val userType: String? = null,
    /** buyerProfile.fullName || supplierProfile.companyName || email. */
    val name: String? = null,
)

@Immutable
@Serializable
data class AdminOpsAuditLogsSummary(
    val byEntityType: List<AdminOpsEntityTypeCount> = emptyList(),
)

@Immutable
@Serializable
data class AdminOpsEntityTypeCount(
    val entityType: String? = null,
    val count: Int = 0,
)

/* ── deliveries (GET api/admin/deliveries/{assignments,drivers}) ────────── */

/** Bare-object response: `{ assignments: [...] }` — no success flag on the wire. */
@Immutable
@Serializable
data class AdminOpsAssignmentsEnvelope(
    val assignments: List<AdminOpsDeliveryAssignment> = emptyList(),
)

@Immutable
@Serializable
data class AdminOpsDeliveryAssignment(
    val id: String? = null,
    val subOrderId: String? = null,
    val orderId: String? = null,
    val subOrderStatus: String? = null,
    /** active | completed | cancelled. */
    val status: String? = null,
    val assignedAt: String? = null,
    val completedAt: String? = null,
    val driver: AdminOpsDriverRef? = null,
)

@Immutable
@Serializable
data class AdminOpsDriverRef(
    val id: String? = null,
    /** email local-part || phone || id — the route's own display fallback. */
    val name: String? = null,
)

/** Bare-object response: `{ drivers: [...] }`. */
@Immutable
@Serializable
data class AdminOpsDriversEnvelope(
    val drivers: List<AdminOpsDriverAccount> = emptyList(),
)

@Immutable
@Serializable
data class AdminOpsDriverAccount(
    val id: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val accountStatus: String? = null,
    val createdAt: String? = null,
)

/* ── inspections (GET api/admin/inspections) ────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsInspectionsEnvelope(
    val success: Boolean = false,
    val data: AdminOpsInspectionsData? = null,
)

@Immutable
@Serializable
data class AdminOpsInspectionsData(
    val inspections: List<AdminOpsInspectionRow> = emptyList(),
    val stats: AdminOpsInspectionStats? = null,
)

@Immutable
@Serializable
data class AdminOpsInspectionRow(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val orderTotal: Double? = null,
    val buyerName: String? = null,
    /** self | third_party. */
    val inspectorType: String? = null,
    /** pending | scheduled | completed | failed. */
    val status: String? = null,
    val reportUrl: String? = null,
    val scheduledAt: String? = null,
    val completedAt: String? = null,
    val createdAt: String? = null,
)

/** Stats keys are dynamic on the wire (…status groupBy spread) — all four + total. */
@Immutable
@Serializable
data class AdminOpsInspectionStats(
    val total: Int = 0,
    val pending: Int = 0,
    val scheduled: Int = 0,
    val completed: Int = 0,
    val failed: Int = 0,
)

/* ── payments (GET api/admin/payments) ──────────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsPaymentsEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsPaymentRow> = emptyList(),
    val stats: AdminOpsPaymentStats? = null,
    val pagination: Pagination? = null,
)

@Immutable
@Serializable
data class AdminOpsPaymentRow(
    val id: String? = null,
    val orderId: String? = null,
    val orderNumber: String? = null,
    val orderTotal: Double? = null,
    val orderPaymentStatus: String? = null,
    /** cod | bank_transfer | card | mobile_banking | wallet. */
    val method: String? = null,
    /** Buyer-submitted brand parsed out of gatewayResponse JSON (may be null). */
    val brand: String? = null,
    val amount: Double? = null,
    /** pending | success | failed | refunded. */
    val status: String? = null,
    val transactionId: String? = null,
    val submittedAt: String? = null,
    val paidAt: String? = null,
    val buyer: AdminOpsPaymentBuyer? = null,
    val suppliers: List<String> = emptyList(),
)

@Immutable
@Serializable
data class AdminOpsPaymentBuyer(
    /** buyerProfiles.fullName — null stays null, never invented. */
    val displayName: String? = null,
)

/** Platform-wide groupBy counts — independent of the current filter. */
@Immutable
@Serializable
data class AdminOpsPaymentStats(
    val pending: Int = 0,
    val success: Int = 0,
    val failed: Int = 0,
    val refunded: Int = 0,
    val total: Int = 0,
)

/* ── reports (GET api/admin/reports) ────────────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsReportsEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsReportRow> = emptyList(),
    val metrics: AdminOpsReportMetrics? = null,
)

/**
 * The handler spreads the raw reportedUsers row and enriches it — every
 * spread field that the screen renders is declared here.
 */
@Immutable
@Serializable
data class AdminOpsReportRow(
    val id: String? = null,
    val reporterId: String? = null,
    val reportedUserId: String? = null,
    /** scam | counterfeit | harassment | inappropriate | fake_listing | other. */
    val reason: String? = null,
    val description: String? = null,
    /** JSON string of evidence file URLs (kept as the raw string). */
    val evidence: String? = null,
    val relatedOrderId: String? = null,
    /** pending | under_review | action_taken | dismissed. */
    val status: String? = null,
    val adminNotes: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val reporter: AdminOpsReportParty? = null,
    val reportedEntity: AdminOpsReportedEntity? = null,
)

@Immutable
@Serializable
data class AdminOpsReportParty(
    val id: String? = null,
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
)

@Immutable
@Serializable
data class AdminOpsReportedEntity(
    val id: String? = null,
    val name: String? = null,
    /** SUPPLIER | buyer | supplier | UNKNOWN — whatever the user row carries. */
    val type: String? = null,
    val status: String? = null,
    /** supplierProfiles.ratingAvg when the entity is a supplier. */
    val rating: Double? = null,
)

@Immutable
@Serializable
data class AdminOpsReportMetrics(
    val total: Int = 0,
    val pending: Int = 0,
    val actionTaken: Int = 0,
    val dismissed: Int = 0,
)

/* ── settings (GET api/admin/settings) ──────────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsSettingsEnvelope(
    val success: Boolean = false,
    val data: AdminOpsSettingsData? = null,
)

@Immutable
@Serializable
data class AdminOpsSettingsData(
    val settings: List<AdminOpsSettingRow> = emptyList(),
    val dataNotes: List<String> = emptyList(),
)

/**
 * One registry setting (src/lib/admin-settings.ts whitelist). value /
 * defaultValue are int-or-string on the wire (valueType decides) and null
 * means "not set" — typed as JsonElement so both primitives parse honestly.
 */
@Immutable
@Serializable
data class AdminOpsSettingRow(
    val key: String? = null,
    val label: String? = null,
    /** returns | support — the registry's category strings. */
    val category: String? = null,
    val description: String? = null,
    /** int | string. */
    val valueType: String? = null,
    val isPublic: Boolean = false,
    val value: JsonElement? = null,
    val defaultValue: JsonElement? = null,
    val updatedAt: String? = null,
)

/* ── shipping (GET api/admin/shipping/{methods,rates,zones}) ────────────── */

@Immutable
@Serializable
data class AdminOpsShippingMethodsEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsShippingMethodRow> = emptyList(),
    val count: Int = 0,
)

@Immutable
@Serializable
data class AdminOpsShippingMethodRow(
    val id: String? = null,
    val name: String? = null,
    val description: String? = null,
    /** Free-text estimate on the wire (e.g. "2-4 days"). */
    val estimatedDays: String? = null,
    val isActive: Boolean = false,
    /** Live _count.shippingRates aggregate. */
    val rateCount: Int = 0,
)

@Immutable
@Serializable
data class AdminOpsShippingRatesEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsShippingRateRow> = emptyList(),
    val count: Int = 0,
)

@Immutable
@Serializable
data class AdminOpsShippingRateRow(
    val id: String? = null,
    val zoneId: String? = null,
    val methodId: String? = null,
    val zoneName: String? = null,
    val methodName: String? = null,
    /** kg band — Prisma Float columns. */
    val weightMin: Double = 0.0,
    /** null = the band runs to infinity. */
    val weightMax: Double? = null,
    val price: Double = 0.0,
    /** Free-shipping threshold; null = never free. */
    val freeAbove: Double? = null,
)

@Immutable
@Serializable
data class AdminOpsShippingZonesEnvelope(
    val success: Boolean = false,
    val data: List<AdminOpsShippingZoneRow> = emptyList(),
    val count: Int = 0,
)

@Immutable
@Serializable
data class AdminOpsShippingZoneRow(
    val id: String? = null,
    val name: String? = null,
    /** parseDistricts() output — the parsed district list. */
    val districts: List<String> = emptyList(),
    val isActive: Boolean = false,
    val rateCount: Int = 0,
    val createdAt: String? = null,
)

/* ── categories (GET api/admin/categories) ──────────────────────────────── */

@Immutable
@Serializable
data class AdminOpsCategoriesEnvelope(
    val success: Boolean = false,
    val data: AdminOpsCategoriesData? = null,
)

@Immutable
@Serializable
data class AdminOpsCategoriesData(
    val categories: List<AdminOpsCategoryRow> = emptyList(),
    val stats: AdminOpsCategoryStats? = null,
    val dataNotes: List<String> = emptyList(),
)

/** serializeAdminCategory() shape (src/lib/admin-categories.ts). */
@Immutable
@Serializable
data class AdminOpsCategoryRow(
    val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val parentId: String? = null,
    val parentName: String? = null,
    val iconUrl: String? = null,
    val isActive: Boolean = false,
    val sortOrder: Int = 0,
    val createdAt: String? = null,
    /** Counts every linked product — inactive/unapproved included. */
    val productCount: Int = 0,
    val childrenCount: Int = 0,
)

@Immutable
@Serializable
data class AdminOpsCategoryStats(
    val total: Int = 0,
    val active: Int = 0,
    val inactive: Int = 0,
    val roots: Int = 0,
)
