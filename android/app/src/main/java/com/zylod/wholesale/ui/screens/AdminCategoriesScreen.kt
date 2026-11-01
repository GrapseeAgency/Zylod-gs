package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminCategoriesScreen as SharedAdminCategoriesScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-categories"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the shared NativePageBody renderer is GONE: this pageId is now
 * owned by the typed ui/adminops implementation. The body is a thin
 * delegation to the shared categories screen (pageId-keyed so it keeps its
 * own ViewModel) — the REAL GET api/admin/categories admin tree with real
 * product/children counts and tree stats. The meta object below (kind
 * CATEGORIES and the legacy endpoint string included, byte-identical) and
 * the NativePageRegistry composable signature are unchanged.
 */
data object AdminCategoriesPageMeta : NativePageMeta() {
    override val pageId = "admin-categories"
    override val title = "Admin Categories"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CATEGORIES
    override val endpoint: String? = "api/categories"
    override val summary = "Admin Categories — operational dashboards and analytics surfaces. Content streams live from the Zylod API and renders through the shared native page model."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the admin-categories pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [SharedAdminCategoriesScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/adminops, not on this file's own same-named composable).
 */
@Composable
fun AdminCategoriesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminCategoriesScreen(pageId = "admin-categories", onBack = onBack, openPage = openPage, query = query)
}
