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
 * Admin surface — the REAL GET endpoints behind the native Admin Dashboard
 * (pageId "admin-dashboard"). Only endpoints that verifiably exist
 * server-side are declared; every one was read from the admin route handlers
 * under src/app/api/admin:
 *
 *  - GET api/admin/dashboard — admin/dashboard/route.ts. requireUserType with
 *    the admin-only list: non-admins get 403 with an error body ("Admin
 *    access required"), admins get the aggregated platform stats payload.
 *  - GET api/admin/users — admin/users/route.ts. Non-admins get 401. Query
 *    params page/limit/role/status/search; the native rail sends page+limit.
 *  - GET api/admin/orders — admin/orders/route.ts. Non-admins get 401. Query
 *    params paymentStatus/status/q/page/limit; the native rail sends
 *    paymentStatus=all (the handler's bare default is the unpaid
 *    verification queue, which is NOT the dashboard rail's contract).
 *  - GET api/admin/reports — admin/reports/route.ts. Non-admins get 401.
 *    Query params status/reason/limit; the native rail sends status+limit.
 *
 * Every endpoint returns Response<ApiEnvelope<T>> (CommerceApis convention —
 * never a bare DTO), so HTTP failures and envelope failures stay
 * distinguishable and the shared OkHttp client's Bearer header plus the
 * 401-refresh-authenticator chain apply unchanged.
 *
 * WIRE NOTES (verified against the handlers):
 *  - admin/users responds with success, a data array, and a pagination
 *    object shaped page/limit/total/totalPages — exactly the shared
 *    [Pagination] DTO, so it parses into ApiEnvelope for free.
 *  - admin/orders nests pagination INSIDE data next to the orders array, so
 *    its data is typed as [AdminOrdersPageDto] rather than a bare list.
 *  - admin/reports also returns a top-level metrics object — deliberately
 *    NOT typed here (the lenient Json drops unknown keys); the dashboard's
 *    pendingApprovals object carries the same moderation KPIs for the tile
 *    row.
 *  - admin/dashboard's growthData array and the three per-day chart arrays
 *    (registrations, order volume, revenue) are intentionally untyped — the
 *    native screen has no chart surface; every rendered field IS typed.
 *
 * NUMERIC TYPING (DealsApi/SellerApi convention): Prisma Float columns and
 * Float aggregates (totalAmount sums, avgOrderValue, ratingAvg) are Double so
 * fractional JSON numbers never break parsing; count aggregates stay Int.
 * Every field is optional-with-default so shape drift degrades gracefully
 * instead of failing the whole screen's parse.
 */
interface AdminApi {
    @GET("api/admin/dashboard")
    suspend fun dashboard(): Response<ApiEnvelope<AdminDashboardDataDto>>

    @GET("api/admin/users")
    suspend fun users(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 5,
        // t248 moderation filters (admin/users/route.ts, all optional): role
        // buyer|supplier|admin, status active|suspended|banned, search
        // matches email/phone/buyerProfile.fullName/supplierProfile.companyName.
        // Null omits the query param entirely, so the dashboard rail's bare
        // page+limit call stays byte-identical on the wire.
        @Query("role") role: String? = null,
        @Query("status") status: String? = null,
        @Query("search") search: String? = null,
    ): Response<ApiEnvelope<List<AdminUserDto>>>

    @GET("api/admin/orders")
    suspend fun orders(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 5,
        // "all" lists every payment status; the handler's bare default is the
        // unpaid verification queue, not the dashboard rail.
        @Query("paymentStatus") paymentStatus: String = "all",
        // t248 filters (admin/orders/route.ts, both optional): status filters
        // orders with at least one subOrder in that REAL subOrder status
        // (pending|confirmed|packed|shipped|delivered|cancelled|returned);
        // q searches orderNumber / buyer email. Null omits the param.
        @Query("status") status: String? = null,
        @Query("q") q: String? = null,
    ): Response<ApiEnvelope<AdminOrdersPageDto>>

    /**
     * t248 — PATCH api/admin/users (admin/users/route.ts PATCH handler,
     * verified): body EXACTLY { userId, action: "suspend"|"activate"|"ban",
     * reason? } → { success, data: <the updated account row, password-hash
     * fields deliberately excluded server-side> }. Non-admins get 401/403.
     */
    @PATCH("api/admin/users")
    suspend fun updateUserStatus(@Body body: AdminUserActionRequest): Response<ApiEnvelope<AdminUserActionDataDto>>

    /**
     * t248 — POST api/admin/orders/{orderId}/verify-payment (the route file's
     * own contract, verified): human-verified bank-transfer/mobile-banking
     * recording for orders NOT already paid. Body
     * { transactionId, method: "bank_transfer"|"mobile_banking", amount, note? }
     * — amount must match the order total within 0.01 and the transactionId
     * must be unused, or the handler answers 400/409 with an error body.
     * Success → { success, data: { orderNumber, paymentStatus: "paid" } }.
     */
    @POST("api/admin/orders/{orderId}/verify-payment")
    suspend fun verifyPayment(
        @Path("orderId") orderId: String,
        @Body body: AdminVerifyPaymentRequest,
    ): Response<ApiEnvelope<AdminVerifyPaymentDataDto>>

    @GET("api/admin/reports")
    suspend fun reports(
        @Query("status") status: String = "all",
        @Query("limit") limit: Int = 5,
    ): Response<ApiEnvelope<List<AdminReportDto>>>
}

/* ─── GET api/admin/dashboard ────────────────────────────────────────────── */

/** data object of GET api/admin/dashboard — also the on-disk cache payload. */
@Immutable
@Serializable
data class AdminDashboardDataDto(
    val platformOverview: AdminPlatformOverviewDto? = null,
    val pendingApprovals: AdminPendingApprovalsDto? = null,
    val recentActivity: List<AdminActivityDto> = emptyList(),
    val recentUsers: List<AdminDashboardRecentUserDto> = emptyList(),
    val recentOrders: List<AdminDashboardRecentOrderDto> = emptyList(),
    val topRegions: List<AdminRegionCountDto> = emptyList(),
    val categoryBreakdown: List<AdminCategoryCountDto> = emptyList(),
)

/**
 * The handler's platformOverview KPI block, verbatim: totalUsers,
 * activeSuppliers (supplierProfiles count), totalOrders, totalRevenueBDT
 * (orders totalAmount sum), avgOrderValue, totalProducts,
 * pendingApprovalsCount (pending supplier verifications + unapproved
 * products) and the constant systemStatus string.
 */
@Immutable
@Serializable
data class AdminPlatformOverviewDto(
    val totalUsers: Int = 0,
    val activeSuppliers: Int = 0,
    val totalOrders: Int = 0,
    val totalProducts: Int = 0,
    val totalRevenueBDT: Double = 0.0,
    val avgOrderValue: Double = 0.0,
    val pendingApprovalsCount: Int = 0,
    val systemStatus: String? = null,
)

/** The handler's pendingApprovals block: the two queues plus their sum. */
@Immutable
@Serializable
data class AdminPendingApprovalsDto(
    val supplierVerification: Int = 0,
    val productApproval: Int = 0,
    val total: Int = 0,
)

/**
 * One recent-activity feed row (newest registrations + orders merged, take
 * 10). The rows carry no id — the stableKey is a content hash, enough for
 * LazyColumn keys because the feed is static per payload.
 */
@Immutable
@Serializable
data class AdminActivityDto(
    val type: String? = null,
    val text: String? = null,
    val time: String? = null,
) {
    val stableKey: String
        get() = hashCode().toString()
}

/**
 * One recentUsers row (8 newest accounts; label is the handler's
 * email-or-phone-or-id display string).
 */
@Immutable
@Serializable
data class AdminDashboardRecentUserDto(
    val id: String? = null,
    val label: String? = null,
    val userType: String? = null,
    val createdAt: String? = null,
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: label?.takeIf(String::isNotBlank)
            ?: "recent-user-${hashCode()}"
}

/**
 * One recentOrders row (8 newest orders). NOTE: the handler maps the
 * PAYMENT status into the "status" field (status: o.paymentStatus) — there
 * is no fulfillment status on this payload.
 */
@Immutable
@Serializable
data class AdminDashboardRecentOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double? = null,
    val status: String? = null,
    val placedAt: String? = null,
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: orderNumber?.takeIf(String::isNotBlank)
            ?: "recent-order-${hashCode()}"
}

/** Top buyer-address regions (city, address count, rounded percentage). */
@Immutable
@Serializable
data class AdminRegionCountDto(
    val region: String? = null,
    val users: Int = 0,
    val percentage: Int = 0,
)

/** Active categories with live product counts (top 6, products only). */
@Immutable
@Serializable
data class AdminCategoryCountDto(
    val category: String? = null,
    val products: Int = 0,
)

/* ─── GET api/admin/users ────────────────────────────────────────────────── */

/**
 * One admin users-list row (the handler's map over the prisma include):
 * profile display names come from buyerProfile/supplierProfile, counts from
 * the _count aggregates. ratingAvg is a Prisma Float (Double here).
 */
@Immutable
@Serializable
data class AdminUserDto(
    val id: String? = null,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val accountStatus: String? = null,
    val createdAt: String? = null,
    val isEmailVerified: Boolean? = null,
    val isPhoneVerified: Boolean? = null,
    val fullName: String? = null,
    val businessName: String? = null,
    val companyName: String? = null,
    val verificationStatus: String? = null,
    val ratingAvg: Double? = null,
    val orderCount: Int? = null,
    val reviewCount: Int? = null,
    val quoteRequestCount: Int? = null,
) {
    /** Stable identity for LazyColumn keys (account id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "user-${hashCode()}"
}

/* ─── GET api/admin/orders ───────────────────────────────────────────────── */

/**
 * The handler's data object: orders array + pagination nested inside data
 * (unlike admin/users, whose pagination rides the envelope top level).
 */
@Immutable
@Serializable
data class AdminOrdersPageDto(
    val orders: List<AdminOrderDto> = emptyList(),
    val pagination: Pagination? = null,
)

/**
 * One admin order row (the handler's map): status is the handler-DERIVED
 * fulfillment state (delivered/cancelled/shipped/processing — derived from
 * the real subOrder statuses; orders itself has NO status column),
 * paymentStatus is the real orders column, itemCount is the subOrder item
 * sum. t248: payments and subOrders are now TYPED ([AdminOrderPaymentDto] /
 * [AdminOrderSubOrderDto], verbatim handler maps) — the orders screen
 * renders the first payment and the per-subOrder statuses.
 */
@Immutable
@Serializable
data class AdminOrderDto(
    val id: String? = null,
    val orderNumber: String? = null,
    val totalAmount: Double? = null,
    val paymentStatus: String? = null,
    val status: String? = null,
    val placedAt: String? = null,
    val buyer: AdminOrderBuyerDto? = null,
    val itemCount: Int? = null,
    val subOrderCount: Int? = null,
    val payments: List<AdminOrderPaymentDto> = emptyList(),
    val subOrders: List<AdminOrderSubOrderDto> = emptyList(),
) {
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank)
            ?: orderNumber?.takeIf(String::isNotBlank)
            ?: "order-${hashCode()}"
}

/** Buyer brief embedded in each admin order row (name from buyerProfiles). */
@Immutable
@Serializable
data class AdminOrderBuyerDto(
    val id: String? = null,
    val email: String? = null,
    val name: String? = null,
    val userType: String? = null,
)

/**
 * t248 — one row of the order's payments array (verified against the
 * handler's map: id/method/amount/status/transactionId + paidAt ISO). The
 * orders screen renders the FIRST payment as a summary line.
 */
@Immutable
@Serializable
data class AdminOrderPaymentDto(
    val id: String? = null,
    val method: String? = null,
    val amount: Double? = null,
    val status: String? = null,
    val transactionId: String? = null,
    val paidAt: String? = null,
)

/**
 * t248 — one row of the order's subOrders array (id/status/supplierId +
 * itemCount from the _count.items aggregate, verbatim handler map). The
 * derived fulfillment status on [AdminOrderDto.status] comes from these.
 */
@Immutable
@Serializable
data class AdminOrderSubOrderDto(
    val id: String? = null,
    val status: String? = null,
    val supplierId: String? = null,
    val itemCount: Int? = null,
)

/* ─── PATCH api/admin/users · POST api/admin/orders/{id}/verify-payment ─── */

/**
 * PATCH api/admin/users request — the handler destructures EXACTLY
 * { userId, action, reason } (action suspend|activate|ban; reason optional,
 * audit-logged server-side).
 */
@Immutable
@Serializable
data class AdminUserActionRequest(
    val userId: String,
    val action: String,
    val reason: String? = null,
)

/**
 * PATCH api/admin/users response data — the handler's update select,
 * verbatim (id, userType, email, phone, accountStatus, suspensionReason,
 * suspendedAt, createdAt, updatedAt; users' passwordHash/twoFactorSecret
 * are deliberately never echoed server-side).
 */
@Immutable
@Serializable
data class AdminUserActionDataDto(
    val id: String? = null,
    val userType: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val accountStatus: String? = null,
    val suspensionReason: String? = null,
    val suspendedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

/**
 * POST api/admin/orders/{orderId}/verify-payment request — verbatim route
 * contract: transactionId (unique across payments), method limited to
 * bank_transfer|mobile_banking, amount matching the order total (±0.01),
 * note optional (truncated to 300 chars server-side).
 */
@Immutable
@Serializable
data class AdminVerifyPaymentRequest(
    val transactionId: String,
    val method: String,
    val amount: Double,
    val note: String? = null,
)

/** POST verify-payment success data: { orderNumber, paymentStatus: "paid" }. */
@Immutable
@Serializable
data class AdminVerifyPaymentDataDto(
    val orderNumber: String? = null,
    val paymentStatus: String? = null,
)

/* ─── GET api/admin/reports ──────────────────────────────────────────────── */

/**
 * One moderation report row: the reportedUsers prisma row (reason values
 * scam/counterfeit/harassment/inappropriate/fake_listing/other; status
 * pending/under_review/action_taken/dismissed) enriched by the handler with
 * the reporter brief and the reported-entity brief (supplier branch also
 * carries rating — nullable because the user branch omits it).
 */
@Immutable
@Serializable
data class AdminReportDto(
    val id: String? = null,
    val reporterId: String? = null,
    val reportedUserId: String? = null,
    val reason: String? = null,
    val description: String? = null,
    val evidence: String? = null,
    val relatedOrderId: String? = null,
    val status: String? = null,
    val adminNotes: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val reporter: AdminReportPartyDto? = null,
    val reportedEntity: AdminReportedEntityDto? = null,
) {
    /** Stable identity for LazyColumn keys (report id, hash fallback). */
    val stableKey: String
        get() = id?.takeIf(String::isNotBlank) ?: "report-${hashCode()}"
}

/** Reporter brief (name is the handler's profile-or-fallback display name). */
@Immutable
@Serializable
data class AdminReportPartyDto(
    val id: String? = null,
    val name: String? = null,
    val email: String? = null,
    val phone: String? = null,
)

/** Reported-entity brief (type SUPPLIER/user; rating only on suppliers). */
@Immutable
@Serializable
data class AdminReportedEntityDto(
    val id: String? = null,
    val name: String? = null,
    val type: String? = null,
    val status: String? = null,
    val rating: Double? = null,
)
