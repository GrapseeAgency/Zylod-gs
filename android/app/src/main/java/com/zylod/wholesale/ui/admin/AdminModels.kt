package com.zylod.wholesale.ui.admin

import com.zylod.wholesale.data.api.AdminActivityDto
import com.zylod.wholesale.data.api.AdminCategoryCountDto
import com.zylod.wholesale.data.api.AdminDashboardDataDto
import com.zylod.wholesale.data.api.AdminDashboardRecentOrderDto
import com.zylod.wholesale.data.api.AdminDashboardRecentUserDto
import com.zylod.wholesale.data.api.AdminOrderDto
import com.zylod.wholesale.data.api.AdminOrderPaymentDto
import com.zylod.wholesale.data.api.AdminOrdersPageDto
import com.zylod.wholesale.data.api.AdminPendingApprovalsDto
import com.zylod.wholesale.data.api.AdminPlatformOverviewDto
import com.zylod.wholesale.data.api.AdminRegionCountDto
import com.zylod.wholesale.data.api.AdminReportDto
import com.zylod.wholesale.data.api.AdminUserDto
import com.zylod.wholesale.data.api.ApiEnvelope
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.wallet.formatRelativeDate
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Admin Dashboard domain models plus DTO-to-domain mappers (pure Kotlin — no
 * Android imports) so AdminDashboardViewModel stays a thin fetch/degrade
 * shell and the screen renders typed rows instead of wire DTOs. Same file
 * contract as ui/seller/SellerModels.kt.
 *
 * MAPPER RECEIVERS (all verified against the AdminApi.kt envelope types —
 * each mapper is declared ON the exact envelope type its endpoint returns,
 * so the VM cannot call it on the wrong receiver):
 *  - ApiEnvelope<AdminDashboardDataDto>.toDomain() — the dashboard payload of
 *    record. It pre-fills users/orders from the dashboard's recentUsers /
 *    recentOrders rows so an offline or degraded render still has real rows;
 *    the rich per-endpoint lists replace them when their fetch succeeds.
 *  - ApiEnvelope<List<AdminUserDto>>.toUserRows() — GET api/admin/users.
 *  - ApiEnvelope<AdminOrdersPageDto>.toOrderRows() — GET api/admin/orders
 *    (the orders array rides INSIDE data next to its pagination).
 *  - ApiEnvelope<List<AdminReportDto>>.toReportRows() — GET api/admin/reports.
 *
 * Every rendered row carries a fully-prefixed stable `key` (user-, rep-,
 * ord-, act-) so the LazyColumn can key rows directly with no extra
 * prefixing at the call site, and `dateLabel` is precomputed here (pure JVM
 * formatters) so the screen never formats per recomposition.
 */

data class AdminDashboardContent(
    val overview: AdminOverview,
    val pending: AdminPendingApprovals?,
    val users: List<AdminUserRow>,
    val reports: List<AdminReportRow>,
    val orders: List<AdminOrderRow>,
    val activity: List<AdminActivityItem>,
    val topRegions: List<AdminRegionSlice>,
    val topCategories: List<AdminCategorySlice>,
)

/** The handler's platformOverview block — every KPI tile number is real. */
data class AdminOverview(
    val totalUsers: Int,
    val activeSuppliers: Int,
    val totalOrders: Int,
    val totalProducts: Int,
    val totalRevenueBDT: Double,
    val avgOrderValue: Double,
    val pendingApprovalsCount: Int,
    val systemStatus: String?,
)

/** The handler's pendingApprovals block (the two queues plus their sum). */
data class AdminPendingApprovals(
    val supplierVerification: Int,
    val productApproval: Int,
    val total: Int,
)

/**
 * One users-row. Rich rows (GET api/admin/users) carry the profile names,
 * account status and real order counts; dashboard-fallback rows (the
 * dashboard's recentUsers) carry only the handler's display label — the
 * nullable fields make the difference honest on screen.
 *
 * t248 users-screen extras (all defaulted, so the dashboard mappers/fallback
 * rows compile untouched): [id] is the raw account id the moderation PATCH
 * needs, [verificationStatus] the supplier-profile state, [ratingLine] the
 * precomputed "★ 4.5 · 3 orders" text (null unless the rating is real) and
 * [joinedLabel] the precomputed "Joined <relative>" text (null when the
 * createdAt instant is unparsable — never invented).
 */
data class AdminUserRow(
    val key: String,
    val label: String,
    val userType: String?,
    val accountStatus: String?,
    val email: String?,
    val phone: String?,
    val orderCount: Int,
    val dateLabel: String,
    val id: String? = null,
    val verificationStatus: String? = null,
    val ratingLine: String? = null,
    val joinedLabel: String? = null,
)

/**
 * One orders-row. Rich rows (GET api/admin/orders) carry the derived
 * fulfillment status, real paymentStatus, buyer name and item count;
 * dashboard-fallback rows carry only orderNumber/totalAmount and the PAYMENT
 * status (the dashboard payload maps paymentStatus into its status field) —
 * status is null there and the screen renders the chip accordingly.
 *
 * t248 orders-screen extras (all defaulted, so the dashboard mappers/fallback
 * rows compile untouched): [id] the raw order id the verify-payment POST
 * needs, [buyerEmail] the buyer brief's email, [subOrderCount] the real
 * subOrder array length, [relativeLabel] the precomputed "3h ago" text for
 * placedAt, [paymentSummary] the precomputed first-payment line
 * ("bkash · pending · ৳1,500"), [subOrderStatuses] the real per-subOrder
 * states and [hasPendingPayment] marking an order the verify-payment
 * endpoint will accept (paymentStatus unpaid/partial — the handler 409s only
 * when already paid).
 */
data class AdminOrderRow(
    val key: String,
    val orderNumber: String,
    val status: String?,
    val paymentStatus: String?,
    val buyerName: String?,
    val itemCount: Int,
    val totalAmount: Double,
    val dateLabel: String,
    val id: String? = null,
    val buyerEmail: String? = null,
    val subOrderCount: Int = 0,
    val relativeLabel: String? = null,
    val paymentSummary: String? = null,
    val subOrderStatuses: List<String> = emptyList(),
    val hasPendingPayment: Boolean = false,
)

/** One moderation-report row from GET api/admin/reports. */
data class AdminReportRow(
    val key: String,
    val reason: String,
    val status: String?,
    val description: String?,
    val reporterName: String?,
    val reportedName: String?,
    val reportedType: String?,
    val dateLabel: String,
)

/** One recent-activity feed row (registrations + orders merged, take 10). */
data class AdminActivityItem(
    val key: String,
    val type: String?,
    val text: String,
    val dateLabel: String,
)

data class AdminRegionSlice(
    val region: String,
    val users: Int,
    val percentage: Int,
)

data class AdminCategorySlice(
    val category: String,
    val products: Int,
)

/**
 * Maps the dashboard envelope to renderable content, or null when the
 * payload lacks its overview core (a success body with no platformOverview
 * is a shape drift — the VM degrades to cache/error instead of rendering
 * zeros that would look like real stats).
 */
fun ApiEnvelope<AdminDashboardDataDto>.toDomain(): AdminDashboardContent? {
    val data = data ?: return null
    val overview = data.platformOverview?.toDomain() ?: return null
    return AdminDashboardContent(
        overview = overview,
        pending = data.pendingApprovals?.toDomain(),
        users = data.recentUsers.map { it.toUserRow() },
        reports = emptyList(), // no reports in the dashboard payload — filled by the reports mapper
        orders = data.recentOrders.map { it.toOrderRow() },
        activity = data.recentActivity.map { it.toActivityItem() },
        topRegions = data.topRegions.map { it.toDomain() },
        topCategories = data.categoryBreakdown.map { it.toDomain() },
    )
}

/** Rich users page (GET api/admin/users) — typed on ITS envelope type. */
fun ApiEnvelope<List<AdminUserDto>>.toUserRows(): List<AdminUserRow> =
    data.orEmpty().map { it.toUserRow() }

/** Rich reports page (GET api/admin/reports) — typed on ITS envelope type. */
fun ApiEnvelope<List<AdminReportDto>>.toReportRows(): List<AdminReportRow> =
    data.orEmpty().map { it.toReportRow() }

/** Rich orders page (GET api/admin/orders) — typed on ITS envelope type. */
fun ApiEnvelope<AdminOrdersPageDto>.toOrderRows(): List<AdminOrderRow> =
    data?.orders.orEmpty().map { it.toOrderRow() }

private fun AdminPlatformOverviewDto.toDomain() = AdminOverview(
    totalUsers = totalUsers,
    activeSuppliers = activeSuppliers,
    totalOrders = totalOrders,
    totalProducts = totalProducts,
    totalRevenueBDT = totalRevenueBDT,
    avgOrderValue = avgOrderValue,
    pendingApprovalsCount = pendingApprovalsCount,
    systemStatus = systemStatus?.takeIf(String::isNotBlank),
)

private fun AdminPendingApprovalsDto.toDomain() = AdminPendingApprovals(
    supplierVerification = supplierVerification,
    productApproval = productApproval,
    total = total,
)

private fun AdminRegionCountDto.toDomain() = AdminRegionSlice(
    region = region?.takeIf(String::isNotBlank) ?: "Unknown",
    users = users,
    percentage = percentage,
)

private fun AdminCategoryCountDto.toDomain() = AdminCategorySlice(
    category = category?.takeIf(String::isNotBlank) ?: "Other",
    products = products,
)

private fun AdminActivityDto.toActivityItem() = AdminActivityItem(
    key = "act-$stableKey",
    type = type?.takeIf(String::isNotBlank),
    text = text.orEmpty().ifBlank { "Platform activity" },
    dateLabel = formatAdminDate(time),
)

/** Fallback users-row from the dashboard's recentUsers (no profile fields). */
fun AdminDashboardRecentUserDto.toUserRow() = AdminUserRow(
    key = "user-$stableKey",
    label = label?.takeIf(String::isNotBlank) ?: "User",
    userType = userType?.takeIf(String::isNotBlank),
    accountStatus = null, // the dashboard payload carries no account status
    email = null,
    phone = null,
    orderCount = 0,
    dateLabel = formatAdminDate(createdAt),
    id = id?.takeIf(String::isNotBlank),
    joinedLabel = joinedLabelOf(createdAt),
)

/** Rich users-row from GET api/admin/users. */
fun AdminUserDto.toUserRow() = AdminUserRow(
    key = "user-$stableKey",
    // Handler-side display priority: buyer name, supplier company, then the
    // account identity (email/phone), then a truncated id.
    label = fullName?.takeIf(String::isNotBlank)
        ?: companyName?.takeIf(String::isNotBlank)
        ?: businessName?.takeIf(String::isNotBlank)
        ?: email?.takeIf(String::isNotBlank)
        ?: phone?.takeIf(String::isNotBlank)
        ?: "User ${(id ?: "").takeLast(6)}",
    userType = userType?.takeIf(String::isNotBlank),
    accountStatus = accountStatus?.takeIf(String::isNotBlank),
    email = email?.takeIf(String::isNotBlank),
    phone = phone?.takeIf(String::isNotBlank),
    orderCount = orderCount ?: 0,
    dateLabel = formatAdminDate(createdAt),
    id = id?.takeIf(String::isNotBlank),
    verificationStatus = verificationStatus?.takeIf(String::isNotBlank),
    ratingLine = ratingLineOf(ratingAvg, orderCount ?: 0),
    joinedLabel = joinedLabelOf(createdAt),
)

/** Fallback orders-row from the dashboard's recentOrders (payment status only). */
fun AdminDashboardRecentOrderDto.toOrderRow() = AdminOrderRow(
    key = "ord-$stableKey",
    orderNumber = orderNumber.orEmpty().ifBlank { "--" },
    status = null, // the dashboard payload has no fulfillment status at all
    paymentStatus = status?.takeIf(String::isNotBlank), // handler maps paymentStatus into status
    buyerName = null, // no buyer fields in the dashboard payload
    itemCount = 0,
    totalAmount = totalAmount ?: 0.0,
    dateLabel = formatAdminDate(placedAt),
    id = id?.takeIf(String::isNotBlank),
    relativeLabel = relativeLabelOf(placedAt),
)

/** Rich orders-row from GET api/admin/orders (buyer + item count + statuses). */
fun AdminOrderDto.toOrderRow() = AdminOrderRow(
    key = "ord-$stableKey",
    orderNumber = orderNumber.orEmpty().ifBlank { "--" },
    status = status?.takeIf(String::isNotBlank),
    paymentStatus = paymentStatus?.takeIf(String::isNotBlank),
    buyerName = buyer?.name?.takeIf(String::isNotBlank)
        ?: buyer?.email?.takeIf(String::isNotBlank),
    itemCount = itemCount ?: 0,
    totalAmount = totalAmount ?: 0.0,
    dateLabel = formatAdminDate(placedAt),
    id = id?.takeIf(String::isNotBlank),
    buyerEmail = buyer?.email?.takeIf(String::isNotBlank),
    subOrderCount = subOrderCount ?: subOrders.size,
    relativeLabel = relativeLabelOf(placedAt),
    paymentSummary = paymentSummaryOf(payments),
    subOrderStatuses = subOrders.mapNotNull { it.status?.takeIf(String::isNotBlank) },
    hasPendingPayment = paymentStatus?.trim()?.lowercase(Locale.US).let { it == "unpaid" || it == "partial" },
)

/** Rich moderation-row from GET api/admin/reports. */
fun AdminReportDto.toReportRow() = AdminReportRow(
    key = "rep-$stableKey",
    reason = reason?.takeIf(String::isNotBlank) ?: "other",
    status = status?.takeIf(String::isNotBlank),
    description = description?.takeIf(String::isNotBlank),
    reporterName = reporter?.name?.takeIf(String::isNotBlank),
    reportedName = reportedEntity?.name?.takeIf(String::isNotBlank),
    reportedType = reportedEntity?.type?.takeIf(String::isNotBlank),
    dateLabel = formatAdminDate(createdAt),
)

/**
 * "12 Aug 2025, 9:41 AM" from the handlers' ISO strings
 * (createdAt/placedAt toISOString()) — parsed as UTC into the device's zone
 * with SimpleDateFormat (JVM classes only — AdminModels stays Android-free
 * AND minSdk-24-safe: java.time needs API 26/desugaring this project has
 * neither of). Falls back to the raw date prefix (YYYY-MM-DD) when parsing
 * fails, never throws.
 */
fun formatAdminDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "--"
    return runCatching {
        val utc = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        val date = utc.parse(iso.take(19))
            ?: return iso.take(10)
        SimpleDateFormat("d MMM yyyy, h:mm a", Locale.US).format(date)
    }.getOrElse { iso.take(10) }
}

/* ─── t248 mapper precomputes (pure JVM, main-thread like formatAdminDate;
       formatRelativeDate/formatBdt are the shared WalletFormat helpers) ─── */

/** "Joined 3d ago" — null when the instant is missing/unparsable (honest). */
private fun joinedLabelOf(iso: String?): String? {
    val relative = formatRelativeDate(iso)
    return relative.takeIf(String::isNotBlank)?.let { "Joined $it" }
}

/** "3h ago" for placedAt — null when the instant is missing/unparsable. */
private fun relativeLabelOf(iso: String?): String? =
    formatRelativeDate(iso).takeIf(String::isNotBlank)

/** "★ 4.5 · 3 orders" — null unless the rating is a real positive value. */
private fun ratingLineOf(ratingAvg: Double?, orderCount: Int): String? {
    val rating = ratingAvg?.takeIf { it > 0.0 } ?: return null
    val stars = String.format(Locale.US, "%.1f", rating)
    return if (orderCount > 0) "★ $stars · $orderCount order${if (orderCount != 1) "s" else ""}" else "★ $stars"
}

/** First-payment line "bkash · pending · ৳1,500" — null with no payments. */
private fun paymentSummaryOf(payments: List<AdminOrderPaymentDto>): String? {
    val first = payments.firstOrNull() ?: return null
    val parts = listOfNotNull(
        first.method?.takeIf(String::isNotBlank),
        first.status?.takeIf(String::isNotBlank),
        first.amount?.takeIf { it > 0.0 }?.let { formatBdt(it) },
    )
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}
