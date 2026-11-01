package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.PaymentHubScreen as SharedPaymentHubScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "payment"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The web "?page=payment" component is the
 * wallet-overview experience (GenericFinancePage), so the body is a thin
 * delegation to the shared payment-hub screen (pageId-keyed so it keeps its
 * own ViewModel): the signed-in user's REAL wallet balance (the EXISTING
 * WalletApi — never redeclared), the REAL default payment-method row
 * (FinanceApi.paymentMethods, t256), and link cards ONLY into live native
 * surfaces (payment-history / payment-pending / payment-failed /
 * payment-method / add-payment-method / wallet). The meta object below and
 * the NativePageRegistry composable signature are unchanged.
 */
data object PaymentPageMeta : NativePageMeta() {
    override val pageId = "payment"
    override val title = "Payment"
    override val category = "Zylod Marketplace"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Payment — a Zylod marketplace surface. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the payment pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("home", "Home"),
        NativePageLink("category-browser", "Category Browser"),
        NativePageLink("help-center", "Help Center"),
    )
}

/**
 * Delegation only — the shared [SharedPaymentHubScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun PaymentScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedPaymentHubScreen(pageId = "payment", onBack = onBack, openPage = openPage, query = query)
}
