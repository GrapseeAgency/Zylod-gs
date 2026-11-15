package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.checkout.CheckoutScreen as SharedCheckoutScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "checkout"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * No obvious SPA endpoint feeds this page — it renders its curated Kotlin metadata.
"Checkout — product discovery and buying on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
 */
data object CheckoutPageMeta : NativePageMeta() {
    override val pageId = "checkout"
    override val title = "Checkout"
    override val category = "Shopping & Products"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "” saved you . )} saved you . )} + Shipping = )} . The order is NOT confirmed until payment is verified — submit your payment reference from My Orders. )}"
    override val tabHint = ""
    override val bullets = listOf(
        "Order Created",
        "You need a buyer account to check out — your cart, addresses and payment methods live in your account.",
        "Sign in required",
        "Nothing to check out. Browse the catalog and add products first.",
        "Your cart is empty",
        "A product in this shipment has no weight on file — shipping settles directly with the supplier.",
    )} saved you . )} + Shipping = )} . The order is NOT confirmed until payment is verified — submit your payment reference from My Orders. )}",
        "Sign in required",
        "You need a buyer account to check out — your cart, addresses and payment methods live in your account.",
        "Your cart is empty",
        "Nothing to check out. Browse the catalog and add products first.",
    )
    override val related = listOf(
        NativePageLink("orders", "Orders"),
        NativePageLink("shipping-address", "Shipping Address"),
        NativePageLink("add-address", "Add Address"),
    )
}

/**
 * t273 — the generic t233 shared-renderer body is GONE: this pageId is now
 * owned by the typed checkout money-path screen. The body is a thin
 * delegation to [com.zylod.wholesale.ui.checkout.CheckoutScreen] — the
 * checkout-page.tsx port (session + 401 sign-in walls, the live address
 * book, per-supplier shipping quotes, the coupon rail, wallet/bank/COD
 * payment methods and the VERBATIM place-order ladder). Its ViewModel is
 * acquired inside the shared screen under the fixed key "checkout-checkout".
 * The meta object above and the NativePageRegistry composable signature
 * (NativePageRegistry.kt) are unchanged.
 */
@Composable
fun CheckoutScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCheckoutScreen(pageId = "checkout", onBack = onBack, openPage = openPage, query = query)
}
