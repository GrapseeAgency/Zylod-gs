package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.adminops.AdminShippingScreen as SharedAdminShippingScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "admin-shipping"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t265 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/adminops implementation. The body is a thin delegation to the
 * shared shipping screen (pageId-keyed so it keeps its own ViewModel) — the
 * REAL GET api/admin/shipping/{methods,rates,zones} feed rendered as a
 * three-section surface. The meta object below and the NativePageRegistry
 * composable signature are unchanged.
 */
data object AdminShippingPageMeta : NativePageMeta() {
    override val pageId = "admin-shipping"
    override val title = "Admin Shipping"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Zones, carriers and the weight-band price book buyers are quoted at checkout."
    override val tabHint = ""
    override val bullets = listOf(
        "Admin access required",
        "Shipping configuration is restricted to platform administrators.",
        "Shipping configuration",
        "No zones yet. Create one to start covering districts.",
        "Live quote tester",
        "No methods yet. Add the carriers you actually ship with.",
    )
    override val related = listOf(
        NativePageLink("admin-dashboard", "Admin Dashboard"),
    )
}

/**
 * Delegation only — the shared [SharedAdminShippingScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/adminops, not on
 * this file's own same-named composable).
 */
@Composable
fun AdminShippingScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAdminShippingScreen(pageId = "admin-shipping", onBack = onBack, openPage = openPage, query = query)
}
