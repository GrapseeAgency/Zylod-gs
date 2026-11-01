package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminDeliveriesScreen as SharedAdminDeliveriesScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-deliveries"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/adminops implementation. The body is a thin delegation to the
 * shared deliveries screen (pageId-keyed so it keeps its own ViewModel) —
 * the REAL GET api/admin/deliveries/assignments + /drivers feed rendered as
 * two sections. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object AdminDeliveriesPageMeta : NativePageMeta() {
    override val pageId = "admin-deliveries"
    override val title = "Admin Deliveries"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Admin Deliveries — operational dashboards and analytics surfaces. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the admin-deliveries pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [SharedAdminDeliveriesScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/adminops, not on this file's own same-named composable).
 */
@Composable
fun AdminDeliveriesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminDeliveriesScreen(pageId = "admin-deliveries", onBack = onBack, openPage = openPage, query = query)
}
