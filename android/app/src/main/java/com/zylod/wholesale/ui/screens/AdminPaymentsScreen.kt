package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminPaymentsOpsScreen as SharedAdminPaymentsOpsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-payments"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/adminops implementation. The body is a thin delegation to the
 * shared payments-ops screen (pageId-keyed so it keeps its own ViewModel) —
 * the REAL GET api/admin/payments feed: the platform-wide status strip, the
 * status filter chips, and one card per payment in the manual payment
 * chain. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object AdminPaymentsPageMeta : NativePageMeta() {
    override val pageId = "admin-payments"
    override val title = "Admin Payments"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Every buyer payment submission across the platform — verify after confirming money arrived. Every action is audit-logged."
    override val tabHint = ""
    override val bullets = listOf(
        "Admin access required",
        "&page&limit * (+ whole-table stats: the 4 real statuses + total) * POST /api/admin/payments/[id]/verify — * the admin-override decision on a pending * submission (honest partial math…",
        "Payment Verification",
        "Buyer submissions appear here the moment POST /api/orders/[id]/payment-submit records them. Nothing is marked paid until a seller, an admin, or the verified webhook confirms it.",
        "Could not load the queue",
        "This tab reflects the real payments table — counts in the strip above are platform-wide.",
    )        "Admin access required",
        "&page&limit * (+ whole-table stats: the 4 real statuses + total) * POST /api/admin/payments/[id]/verify — * the admin-override decision on a pending * submission (honest partial math…",
        "Payment Verification",
        "Every buyer payment submission across the platform — verify after confirming money arrived. Every action is audit-logged.",
        "Could not load the queue",
        "Buyer submissions appear here the moment POST /api/orders/[id]/payment-submit records them. Nothing is marked paid until a seller, an admin, or the verified webhook confirms it.",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [SharedAdminPaymentsOpsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/adminops, not on this file's own same-named composable).
 */
@Composable
fun AdminPaymentsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminPaymentsOpsScreen(pageId = "admin-payments", onBack = onBack, openPage = openPage, query = query)
}
