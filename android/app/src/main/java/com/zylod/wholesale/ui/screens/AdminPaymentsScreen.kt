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
    override val summary = "Payment verification console — the real payments table with paginated status counts and the admin verify decision."
    override val tabHint = ""
    override val bullets = listOf(
        "GET api/admin/payments renders the four real statuses plus the platform-wide total in the strip.",
        "POST api/admin/payments/[id]/verify records the admin-override decision on a pending submission — every action is audit-logged.",
        "Buyer submissions appear the moment payment-submit records them; nothing is marked paid until someone verifies the money.",
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
