package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.support.ServiceStatusScreen as SharedServiceStatusScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "system-status"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t255 — the curated-metadata body is GONE: the web SPA serves this
 * pageId (and "system-health") from service-status-page.tsx, and this
 * pageId is now owned by the typed ui/support implementation. The body is
 * a thin delegation to the SHARED service-status screen (pageId-keyed so
 * it keeps its own ViewModel) — the REAL GET api/app/diagnostics probes
 * (the payload the web status page actually renders), the stat cards, the
 * per-service rows and the Re-probe button. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object SystemStatusPageMeta : NativePageMeta() {
    override val pageId = "system-status"
    override val title = "System Status"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = "api/app/diagnostics"
    override val summary = "System Status — the live subsystem health probes and microservice latency metrics, streaming from the Zylod diagnostics API through the shared native status screen."
    override val tabHint = ""
    override val bullets = listOf(
        "Live data renders from the Zylod API when an endpoint feeds this page.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the system-status pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("system-health", "System Health"),
        NativePageLink("maintenance-mode", "Maintenance Mode"),
        NativePageLink("helpdesk", "Helpdesk"),
    )
}

/**
 * Delegation only — the shared [SharedServiceStatusScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/support, not on a same-named local composable).
 */
@Composable
fun SystemStatusScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedServiceStatusScreen(pageId = "system-status", onBack = onBack, openPage = openPage, query = query)
}
