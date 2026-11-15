package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminSettingsOpsScreen as SharedAdminSettingsOpsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-settings"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/adminops implementation. The body is a thin delegation to the
 * shared settings-ops screen (pageId-keyed so it keeps its own ViewModel) —
 * the REAL GET api/admin/settings registry list with honest unset/default
 * rendering and the route's data notes. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object AdminSettingsPageMeta : NativePageMeta() {
    override val pageId = "admin-settings"
    override val title = "Admin Settings"
    override val category = "Dashboards & Analytics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Platform settings are restricted to Zylod admins. Sign in with an admin account to view and change real settings."
    override val tabHint = ""
    override val bullets = listOf(
        "Admin access required",
        "Real platform settings stored in the adminSettings table. Every change is a real, audit-logged database write and takes effect for its documented consumer immediately. Nothing here is…",
        "Admin Settings",
        "The settings registry (src/lib/admin-settings.ts) currently defines no keys — nothing is invented here.",
        "Could not load settings",
        "No settings registered",
    )
    override val related = listOf(
        NativePageLink("dashboard", "Dashboard"),
        NativePageLink("analytics-dashboard", "Analytics Dashboard"),
        NativePageLink("store-analytics", "Store Analytics"),
    )
}

/**
 * Delegation only — the shared [SharedAdminSettingsOpsScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/adminops, not on this file's own same-named composable).
 */
@Composable
fun AdminSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminSettingsOpsScreen(pageId = "admin-settings", onBack = onBack, openPage = openPage, query = query)
}
