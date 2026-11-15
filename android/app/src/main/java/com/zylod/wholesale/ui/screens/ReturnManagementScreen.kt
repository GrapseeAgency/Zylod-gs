package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.ReturnRequestScreen as SharedReturnRequestScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "return-management"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t253 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/returns implementation. The body is a thin delegation to the
 * shared return-request screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/orders/{orderId} item picker with the
 * quantity steppers, per-item reasons, shared comments, estimated-refund
 * summary and the POST api/orders/{orderId}/return submit guard. The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object ReturnManagementPageMeta : NativePageMeta() {
    override val pageId = "return-management"
    override val title = "Return Management"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Returns are started from a specific order. Open one of your delivered orders and choose “Return”."
    override val tabHint = ""
    override val bullets = listOf(
        "No order selected",
        "This order doesn&apos;t contain any line items, so there is nothing to return.",
        "Return Request",
        "Select Items",
        "Nothing to return",
    )
    override val related = listOf(
        NativePageLink("orders", "Orders"),
    )
}

/**
 * Delegation only — the shared [SharedReturnRequestScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/returns, not on this file's own same-named composable).
 */
@Composable
fun ReturnManagementScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedReturnRequestScreen(pageId = "return-management", onBack = onBack, openPage = openPage, query = query)
}
