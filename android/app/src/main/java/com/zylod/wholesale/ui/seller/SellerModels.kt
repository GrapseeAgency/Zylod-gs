package com.zylod.wholesale.ui.seller

import com.zylod.wholesale.data.api.SellerDashboardEnvelope
import com.zylod.wholesale.data.api.SellerInventoryAlertDto
import com.zylod.wholesale.data.api.SellerOrderDto
import com.zylod.wholesale.data.api.SellerStatsDto
import com.zylod.wholesale.data.api.SellerStoreDto
import com.zylod.wholesale.data.api.SellerSubOrderDto
import com.zylod.wholesale.data.api.SellerTopProductDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Seller Dashboard domain models + DTO→domain mappers (pure Kotlin — no
 * Android imports) so SellerDashboardViewModel stays a thin fetch/degrade
 * shell and the screen renders typed rows instead of wire DTOs.
 *
 * One rendered shape per section:
 *  - [SellerOrderRow] is fed by GET api/supplier/orders (`toOrderRow`, with
 *    buyer + payment status + parent orderId) and falls back to the
 *    dashboard's recentSubOrders (`SellerSubOrderDto.toOrderRow`) when the
 *    orders call fails — the screen renders either identically.
 *  - `dateLabel` is precomputed here (pure JVM formatters) so the screen never
 *    formats per recomposition.
 */

data class SellerDashboardContent(
    val store: SellerStoreInfo,
    val stats: SellerStats,
    val recentOrders: List<SellerOrderRow>,
    val topProducts: List<SellerTopProductRow>,
    val lowStockAlerts: List<SellerStockAlertRow>,
)

data class SellerStoreInfo(
    /** Handler defaults to "Your Store" when no companyName exists. */
    val companyName: String,
    val verificationStatus: String?,
    val ratingAvg: Double?,
)

data class SellerStats(
    val totalProducts: Int,
    val totalOrders: Int,
    val pendingOrders: Int,
    val lowStockCount: Int,
    val totalRevenueBDT: Double,
    val pendingPaymentBDT: Double,
    val thisMonthRevenue: Double,
    val totalBuyers: Int,
)

/**
 * One recent-order row. `orderId` (parent order id, t229) is present only on
 * rows that came from GET api/supplier/orders — dashboard-fallback rows are
 * not deep-linkable and render non-clickable.
 */
data class SellerOrderRow(
    val key: String,
    val orderId: String?,
    val orderNumber: String,
    val status: String?,
    val paymentStatus: String?,
    val buyerName: String?,
    val itemCount: Int,
    val primaryItemName: String,
    /** First line item's product thumbnail (server-relative) — null on dashboard-fallback rows. */
    val imageUrl: String?,
    val totalAmount: Double,
    val dateLabel: String,
)

data class SellerTopProductRow(
    val key: String,
    val name: String,
    val basePrice: Double,
    val stockQuantity: Double,
    val soldCount: Double,
    val category: String,
)

data class SellerStockAlertRow(
    val key: String,
    val name: String,
    val currentStock: Double,
    val threshold: Double?,
    val critical: Boolean,
)

/**
 * Maps the dashboard envelope to renderable content, or null when the
 * payload lacks its stats core (a success:true body with no data/stats is a
 * shape drift — the VM degrades to cache/error instead of rendering zeros
 * that would look like real numbers).
 */
fun SellerDashboardEnvelope.toDomain(): SellerDashboardContent? {
    val data = data ?: return null
    val stats = data.stats?.toDomain() ?: return null
    val store = (data.supplier ?: SellerStoreDto()).toDomain()
    return SellerDashboardContent(
        store = store,
        stats = stats,
        recentOrders = data.recentSubOrders.map { it.toOrderRow() },
        topProducts = data.topProducts.map { it.toDomain() },
        lowStockAlerts = data.inventoryAlerts.map { it.toDomain() },
    )
}

private fun SellerStatsDto.toDomain() = SellerStats(
    totalProducts = totalProducts,
    totalOrders = totalOrders,
    pendingOrders = pendingOrders,
    lowStockCount = lowStockCount,
    totalRevenueBDT = totalRevenueBDT,
    pendingPaymentBDT = pendingPaymentBDT,
    thisMonthRevenue = thisMonthRevenue,
    totalBuyers = totalBuyers,
)

private fun SellerStoreDto.toDomain() = SellerStoreInfo(
    companyName = companyName?.takeIf(String::isNotBlank) ?: "Your Store",
    verificationStatus = verificationStatus?.takeIf(String::isNotBlank),
    ratingAvg = ratingAvg,
)

private fun SellerTopProductDto.toDomain() = SellerTopProductRow(
    key = stableKey,
    name = name.orEmpty().ifBlank { "--" },
    basePrice = basePrice ?: 0.0,
    stockQuantity = stockQuantity ?: 0.0,
    soldCount = soldCount ?: 0.0,
    category = category?.takeIf(String::isNotBlank) ?: "General",
)

private fun SellerInventoryAlertDto.toDomain() = SellerStockAlertRow(
    key = stableKey,
    name = name.orEmpty().ifBlank { "--" },
    currentStock = currentStock ?: 0.0,
    threshold = threshold,
    // severity is handler-computed ('critical' when stock is 0, else 'warning').
    critical = severity == "critical" || (currentStock ?: 0.0) <= 0.0,
)

/** Rich row from GET api/supplier/orders (buyer + payment + parent orderId). */
fun SellerOrderDto.toOrderRow() = SellerOrderRow(
    key = "ord-$stableKey",
    orderId = orderId?.takeIf(String::isNotBlank),
    orderNumber = orderNumber.orEmpty().ifBlank { "--" },
    status = status?.takeIf(String::isNotBlank),
    paymentStatus = paymentStatus?.takeIf(String::isNotBlank),
    // The web orders page displays the BUSINESS name, falling back to the
    // buyer's name, then "Buyer" (supplier/orders/route.ts:73-74).
    buyerName = buyerCompanyName?.takeIf(String::isNotBlank)
        ?: buyerName?.takeIf(String::isNotBlank)
        ?: "Buyer",
    itemCount = items.size,
    primaryItemName = items.firstOrNull()?.name?.takeIf(String::isNotBlank) ?: "Products",
    imageUrl = items.firstOrNull()?.imageUrl?.takeIf(String::isNotBlank),
    totalAmount = totalAmount ?: 0.0,
    dateLabel = formatSellerDate(createdAt),
)

/** Fallback row from the dashboard's recentSubOrders when the orders call fails. */
fun SellerSubOrderDto.toOrderRow() = SellerOrderRow(
    key = "sub-$stableKey",
    orderId = null, // the dashboard payload carries no parent order id
    orderNumber = orderNumber.orEmpty().ifBlank { "--" },
    status = status?.takeIf(String::isNotBlank),
    paymentStatus = null,
    buyerName = null, // no buyer fields in the dashboard payload
    itemCount = itemCount ?: 0,
    primaryItemName = primaryItemName?.takeIf(String::isNotBlank) ?: "Products",
    imageUrl = null, // the dashboard payload carries no thumbnails
    totalAmount = totalAmount ?: 0.0,
    dateLabel = formatSellerDate(date),
)

/**
 * "12 Aug 2025, 9:41 AM" from the handlers' ISO strings
 * (subOrder.createdAt.toISOString()) — parsed as UTC into the device's zone
 * with SimpleDateFormat (JVM classes only — SellerModels stays Android-free
 * AND minSdk-24-safe: java.time needs API 26/desugaring this project has
 * neither of). Falls back to the raw date prefix (YYYY-MM-DD) when parsing
 * fails, never throws.
 */
fun formatSellerDate(iso: String?): String {
    if (iso.isNullOrBlank()) return "--"
    return runCatching {
        val utc = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        val date = utc.parse(iso.take(19))
            ?: return iso.take(10)
        SimpleDateFormat("d MMM yyyy, h:mm a", Locale.US).format(date)
    }.getOrElse { iso.take(10) }
}
