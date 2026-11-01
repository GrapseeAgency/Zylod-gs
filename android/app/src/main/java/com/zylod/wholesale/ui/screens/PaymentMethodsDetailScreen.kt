package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.PaymentMethodsDetailScreen as SharedPaymentMethodsDetailScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payment-methods-detail"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared payment-methods-detail screen (pageId-keyed so it keeps its own
 * PaymentMethodsDetailViewModel) — one REAL row of GET api/payment-methods
 * resolved web-style (pinned "id=" query → default row → first row; there
 * is NO GET-by-id under payment-methods/, its [id] file declares DELETE
 * only) with type-appropriate detail rows and the real remove action. The
 * meta object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object PaymentMethodsDetailPageMeta : NativePageMeta() {
    override val pageId = "payment-methods-detail"
    override val title = "Payment Methods Detail"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Payment Methods Detail — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the payment-methods-detail pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedPaymentMethodsDetailScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun PaymentMethodsDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPaymentMethodsDetailScreen(pageId = "payment-methods-detail", onBack = onBack, openPage = openPage, query = query)
}
