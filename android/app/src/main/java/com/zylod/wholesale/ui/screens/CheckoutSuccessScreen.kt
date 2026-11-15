package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.checkout.CheckoutSuccessScreen as SharedCheckoutSuccessScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "checkout-success"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Checkout Success — product discovery and buying on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CheckoutSuccessPageMeta : NativePageMeta() {
    override val pageId = "checkout-success"
    override val title = "Checkout Success"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "This screen shows the details of an order you have placed. Place an order first and its real details will appear here."
    override val tabHint = ""
    override val bullets = listOf(
        "No order to confirm",
        "Order # was created and sent to the supplier item : ’’}.",
        "Order Received",
    )
    override val related = listOf(
        NativePageLink("orders", "Orders"),
        NativePageLink("track-order", "Track Order"),
    )
}

/**
 * t273 — the generic t233 shared-renderer body is GONE: this pageId is now
 * owned by the typed order-confirmation screen. The body is a thin
 * delegation to [com.zylod.wholesale.ui.checkout.CheckoutSuccessScreen] —
 * the order-confirmation-page.tsx port (orderIdFromQuery entry resolution,
 * the GET api/orders/{orderId} confirmation projection and the honest
 * no-order / gate / error states). Its ViewModel is acquired inside the
 * shared screen under the fixed key "checkout-success-checkout-success".
 * The meta object above and the NativePageRegistry composable signature
 * (NativePageRegistry.kt) are unchanged.
 */
@Composable
fun CheckoutSuccessScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCheckoutSuccessScreen(pageId = "checkout-success", onBack = onBack, openPage = openPage, query = query)
}
