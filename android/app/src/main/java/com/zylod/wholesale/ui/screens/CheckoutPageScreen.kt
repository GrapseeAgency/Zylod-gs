package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.checkout.CheckoutScreen as SharedCheckoutScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "checkout-page"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Checkout Page — product discovery and buying on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CheckoutPagePageMeta : NativePageMeta() {
    override val pageId = "checkout-page"
    override val title = "Checkout Page"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Checkout Page — product discovery and buying on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the checkout-page pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("all-products", "All Products"),
        NativePageLink("flash-deals", "Flash Deals"),
        NativePageLink("category-browser", "Category Browser"),
    )
}

/**
 * t273 — the generic t233 shared-renderer body is GONE: this pageId now
 * renders the SAME typed checkout money-path screen the "checkout" pageId
 * renders (the web lazy-loads checkout-page for both). The body is a thin
 * delegation to [com.zylod.wholesale.ui.checkout.CheckoutScreen] under its
 * OWN pageId, so its ViewModel is acquired under the independent key
 * "checkout-checkout-page" (never shared state with the "checkout" entry).
 * The meta object above and the NativePageRegistry composable signature
 * (NativePageRegistry.kt) are unchanged.
 */
@Composable
fun CheckoutPageScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCheckoutScreen(pageId = "checkout-page", onBack = onBack, openPage = openPage, query = query)
}
