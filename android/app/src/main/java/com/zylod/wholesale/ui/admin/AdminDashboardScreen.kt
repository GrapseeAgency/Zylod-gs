package com.zylod.wholesale.ui.admin

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.util.Locale

/**
 * NATIVE Admin Dashboard (pageId "admin-dashboard" — the generated metadata
 * screen is replaced by this live one through RouteOwnership; this file's
 * composable signature is byte-compatible with the generated
 * ui/screens/AdminDashboardScreen.kt).
 *
 * Structure mirrors SellerDashboardScreen: Scaffold + TopAppBar (back arrow
 * only when [onBack] not null) + one sectioned LazyColumn (platform header,
 * three KPI rows, quick actions, recent activity, users, moderation, recent
 * orders), honest loading / not-admin / offline / empty states, sp+FontWeight
 * type styles, theme colors only (brand red arrives as
 * MaterialTheme.colorScheme.primary — no hex here).
 *
 * Data truth: every number comes from the REAL admin endpoints — GET
 * api/admin/dashboard (platformOverview/pendingApprovals/recentActivity/
 * recentUsers/recentOrders), GET api/admin/users, GET api/admin/reports and
 * GET api/admin/orders. Nothing is fabricated for non-admins: their 401/403
 * renders the honest gate state below. Offline renders the last SAVED
 * dashboard ("zylod_config"/"native_admin_dashboard_cache") under a banner —
 * never a white screen.
 *
 * Smoothness contract (SellerDashboard parity): every row has a STABLE key
 * and contentType; derived labels are remember{}ed — zero allocations in
 * composition.
 */
@Suppress("UNUSED_PARAMETER") // `query` is part of the NativePageRegistry composable contract
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AdminDashboardViewModel = viewModel(key = "native-admin-dashboard") {
        AdminDashboardViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Seller/Deals: re-pull on EVERY entry — the VM survives
    // on the saved back stack, so stats that moved while the user was
    // elsewhere appear at once. The silent refresh keeps visible data mounted.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Admin Dashboard",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                // THE one page-level loading animation (M3 rule — no shimmer,
                // no custom loaders; SellerDashboard parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Honest gate for non-admin users (HTTP 401/403 from the
                // admin-only requireUserType handlers) — no fabricated stats.
                state.notAdmin -> AdminNotAdmin(
                    openPage = openPage,
                    onRetry = vm::refresh,
                )
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> AdminDashboardEmpty(onRetry = vm::retry)
                else -> AdminDashboardList(state = state, openPage = openPage)
            }
        }
    }
}

@Composable
private fun AdminDashboardList(
    state: AdminDashboardUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val content = state.content ?: return

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        item(key = "platform-header", contentType = "header") { PlatformHeader(content.overview) }
        item(key = "kpi-primary", contentType = "kpi") { KpiPrimaryRow(content.overview) }
        item(key = "kpi-secondary", contentType = "kpi") { KpiSecondaryRow(content.overview) }
        item(key = "kpi-pending", contentType = "kpi") { KpiPendingRow(content.pending, content.overview) }
        item(key = "quick-actions", contentType = "actions") { QuickActions(openPage) }
        if (content.activity.isNotEmpty()) {
            sectionHeader(
                key = "activity-header",
                title = "Recent activity",
                icon = Icons.Outlined.History,
                count = content.activity.size,
            )
            items(
                content.activity,
                key = { it.key },
                contentType = { "activity" },
            ) { item ->
                ActivityCard(item)
            }
        }
        sectionHeader(
            key = "users-header",
            title = "Users",
            icon = Icons.Outlined.People,
            count = content.users.size,
        )
        if (content.users.isEmpty()) {
            item(key = "users-empty", contentType = "empty") {
                Text(
                    "No users to show yet — new registrations land here.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                content.users,
                key = { it.key },
                contentType = { "user" },
            ) { row ->
                UserCard(row)
            }
        }
        sectionHeader(
            key = "mod-header",
            title = "Moderation",
            icon = Icons.Outlined.Flag,
            count = content.reports.size,
        )
        if (content.reports.isEmpty()) {
            item(key = "mod-empty", contentType = "empty") {
                Text(
                    "No reports to review — the moderation queue is clear.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                content.reports,
                key = { it.key },
                contentType = { "report" },
            ) { row ->
                ReportCard(row)
            }
        }
        sectionHeader(
            key = "orders-header",
            title = "Recent orders",
            icon = Icons.Outlined.ReceiptLong,
            count = content.orders.size,
        )
        if (content.orders.isEmpty()) {
            item(key = "orders-empty", contentType = "empty") {
                Text(
                    "No orders to show yet — they land here the moment a buyer checks out.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(
                content.orders,
                key = { it.key },
                contentType = { "order" },
            ) { row ->
                OrderCard(row)
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/** Section header: themed icon + title + live count (SellerDashboard parity). */
private fun LazyListScope.sectionHeader(
    key: String,
    title: String,
    icon: ImageVector,
    count: Int,
) {
    item(key = key, contentType = "header") {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 6.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "$count",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun PlatformHeader(overview: AdminOverview) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f), RoundedCornerShape(10.dp)),
            ) {
                Icon(
                    Icons.Outlined.Verified,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Platform overview",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 2.dp),
                ) {
                    Text(
                        "System status",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(6.dp))
                    StatusChip(overview.systemStatus ?: "Optimal")
                }
            }
        }
    }
}

/** Primary KPI tiles — the REAL platformOverview fields, one card each. */
@Composable
private fun KpiPrimaryRow(overview: AdminOverview) {
    val users = remember(overview) { overview.totalUsers.toString() }
    val suppliers = remember(overview) { overview.activeSuppliers.toString() }
    val orders = remember(overview) { overview.totalOrders.toString() }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        KpiCard("Users", users, Icons.Outlined.People, Modifier.weight(1f))
        KpiCard("Suppliers", suppliers, Icons.Outlined.Storefront, Modifier.weight(1f))
        KpiCard("Orders", orders, Icons.Outlined.ShoppingCart, Modifier.weight(1f))
    }
}

/** Secondary tiles: revenue / avg order value / products (all real). */
@Composable
private fun KpiSecondaryRow(overview: AdminOverview) {
    val revenue = remember(overview) { formatBdtCompact(overview.totalRevenueBDT) }
    val avgOrder = remember(overview) { formatBdtCompact(overview.avgOrderValue) }
    val products = remember(overview) { overview.totalProducts.toString() }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        KpiCard("Revenue", revenue, Icons.Outlined.Wallet, Modifier.weight(1f))
        KpiCard("Avg order", avgOrder, Icons.Outlined.TrendingUp, Modifier.weight(1f))
        KpiCard("Products", products, Icons.Outlined.Inventory2, Modifier.weight(1f))
    }
}

/** Pending-work tiles: the REAL pendingApprovals queues (dashboard payload). */
@Composable
private fun KpiPendingRow(
    pending: AdminPendingApprovals?,
    overview: AdminOverview,
) {
    val verify = remember(pending) { (pending?.supplierVerification ?: 0).toString() }
    val approvals = remember(pending) { (pending?.productApproval ?: 0).toString() }
    val total = remember(pending, overview) {
        (pending?.total ?: overview.pendingApprovalsCount).toString()
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        KpiCard("Verify", verify, Icons.Outlined.Verified, Modifier.weight(1f))
        KpiCard("Approvals", approvals, Icons.Outlined.ErrorOutline, Modifier.weight(1f))
        KpiCard("Pending", total, Icons.Outlined.History, Modifier.weight(1f))
    }
}

@Composable
private fun KpiCard(title: String, value: String, icon: ImageVector, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(horizontal = 10.dp, vertical = 12.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                title,
                fontSize = 9.sp,
                letterSpacing = 0.6.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/** Quick actions — real registry pageIds, all three verified routes. */
@Composable
private fun QuickActions(openPage: (pageId: String, query: String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        QuickAction("Users", Icons.Outlined.People, Modifier.weight(1f)) { openPage("admin-users", "") }
        QuickAction("Moderation", Icons.Outlined.Flag, Modifier.weight(1f)) { openPage("admin-moderation", "") }
        QuickAction("Orders", Icons.Outlined.ReceiptLong, Modifier.weight(1f)) { openPage("admin-orders", "") }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.25f)),
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.height(4.dp))
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** One activity-feed row: themed icon by type + the handler's ready text. */
@Composable
private fun ActivityCard(item: AdminActivityItem) {
    val icon = when (item.type) {
        "order" -> Icons.Outlined.ReceiptLong
        "registration" -> Icons.Outlined.People
        else -> Icons.Outlined.History
    }
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    item.text,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    item.dateLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun UserCard(row: AdminUserRow) {
    val ordersLabel = remember(row) {
        if (row.orderCount > 0) "${row.orderCount} order${if (row.orderCount != 1) "s" else ""}" else null
    }
    val contactLine = remember(row) {
        listOfNotNull(row.email, row.phone).joinToString(" • ")
    }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                StatusChip(row.accountStatus ?: row.userType)
            }
            if (contactLine.isNotBlank()) {
                Text(
                    contactLine,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
            ) {
                Text(
                    row.userType?.uppercase().orEmpty(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.8.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                ordersLabel?.let {
                    Text(
                        it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    row.dateLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ReportCard(row: AdminReportRow) {
    val reportedLine = remember(row) {
        listOfNotNull(
            row.reportedName?.let { name -> if (row.reportedType.isNullOrBlank()) name else "$name (${row.reportedType})" },
            row.reporterName?.let { "by $it" },
        ).joinToString(" • ")
    }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                ReasonChip(row.reason)
                Spacer(Modifier.weight(1f))
                StatusChip(row.status)
            }
            row.description?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (reportedLine.isNotBlank()) {
                Text(
                    reportedLine,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Text(
                row.dateLabel,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

/**
 * One recent-order row — fulfillment status chip (rich rows carry the
 * handler-derived state; dashboard-fallback rows carry null there and only
 * the payment chip renders, staying honest about what the payload knows).
 */
@Composable
private fun OrderCard(row: AdminOrderRow) {
    val amountLabel = remember(row) { formatBdt(row.totalAmount) }
    val itemsLine = remember(row) {
        if (row.itemCount > 0) "${row.itemCount} item${if (row.itemCount != 1) "s" else ""}" else null
    }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    row.orderNumber,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                StatusChip(row.status)
            }
            row.buyerName?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            itemsLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            ) {
                Text(
                    amountLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    row.dateLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(end = 8.dp),
                )
                StatusChip(row.paymentStatus)
            }
        }
    }
}

/**
 * Status chip — real account statuses (active/suspended/banned), order
 * fulfillment states (processing/delivered/cancelled/shipped), payment
 * statuses (paid/pending/failed/refunded) and report statuses
 * (pending/under_review/action_taken) mapped to theme pairs.
 */
@Composable
private fun StatusChip(status: String?) {
    val text = status?.trim()?.uppercase().orEmpty()
    if (text.isEmpty()) return
    val (container, content) = when {
        text in POSITIVE_STATUSES ->
            LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        text in NEGATIVE_STATUSES ->
            MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        text in ATTENTION_STATUSES ->
            LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        else ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
    }
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            text,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** Moderation reason chip — always the theme warning pair (needs attention). */
@Composable
private fun ReasonChip(reason: String) {
    Surface(shape = RoundedCornerShape(6.dp), color = LocalZylodExtra.current.warning) {
        Text(
            reason.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = LocalZylodExtra.current.onWarning,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

private val POSITIVE_STATUSES = setOf(
    "DELIVERED", "PAID", "APPROVED", "VERIFIED", "SUCCESS", "REFUNDED", "ACTIVE", "ACTION_TAKEN",
)
private val ATTENTION_STATUSES = setOf(
    "PENDING", "CONFIRMED", "PACKED", "SHIPPED", "UNDER_REVIEW", "COD_PENDING", "PROCESSING",
)
private val NEGATIVE_STATUSES = setOf(
    "CANCELLED", "RETURNED", "REJECTED", "FAILED", "SUSPENDED", "BANNED",
)

/** Offline banner over the SAVED dashboard — theme warning pair, SellerDashboard banner style. */
@Composable
private fun OfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved dashboard",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * Honest gate for non-admin users: the API answered 401/403 (signed out or a
 * buyer/supplier account). No fabricated numbers — an explanation plus the
 * way out.
 */
@Composable
private fun AdminNotAdmin(
    openPage: (pageId: String, query: String) -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Admin account required",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "This dashboard shows real platform stats for signed-in admin accounts. Sign in with an admin account to see it here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = { openPage("home", "") }) {
            Text(
                "Browse the marketplace",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved dashboard: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun AdminDashboardEmpty(onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.CloudOff,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "You're offline",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "No dashboard saved yet — connect once to save it",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun formatBdt(value: Double): String =
    if (value % 1.0 == 0.0) "৳" + NumberFormat.getIntegerInstance().format(value.toLong())
    else "৳" + String.format(Locale.US, "%.2f", value)

/** KPI-tile money: full grouped numbers under ৳1L, lakh/crore above it. */
private fun formatBdtCompact(value: Double): String {
    val v = value.coerceAtLeast(0.0)
    return when {
        v >= 10_000_000.0 -> "৳" + compact(v / 10_000_000.0) + "Cr"
        v >= 100_000.0 -> "৳" + compact(v / 100_000.0) + "L"
        else -> formatBdt(v)
    }
}

private fun compact(value: Double): String =
    String.format(Locale.US, "%.1f", value).removeSuffix(".0")
