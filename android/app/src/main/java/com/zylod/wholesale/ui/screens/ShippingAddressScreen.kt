package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.AddressBookScreen as SharedAddressBookScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "shipping-address"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t279 — the curated-metadata body is GONE. Checkout's Shipping Address
 * card opened THIS pageId via "Edit", but the doc page had no address data,
 * no selection and no way to change anything — while the REAL typed address
 * book (ui/returns: GET api/addresses, radio-select, pencil-edit) served
 * only "address-book". The web maps BOTH pageIds to the same
 * shipping-address-page.tsx; the native registry split was a plain mapping
 * bug. This is now a thin delegation to the shared typed screen (pageId-
 * keyed so it keeps its own ViewModel) — exactly the t253 pattern the
 * address-book pageId already uses. The meta object and the
 * NativePageRegistry composable signature are unchanged.
 */
data object ShippingAddressPageMeta : NativePageMeta() {
    override val pageId = "shipping-address"
    override val title = "Shipping Address"
    override val category = "Orders & Logistics"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Shipping Address — your saved delivery addresses, selectable for checkout."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the shipping-address pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("order-tracking", "Order Tracking"),
        NativePageLink("shipping-info", "Shipping Info"),
    )
}

/**
 * Delegation only — the shared [SharedAddressBookScreen] owns the rendering
 * and the wire calls (the REAL GET api/addresses book with radio-selectable
 * cards, the Default badge, pencil-edit and add-address); this file keeps
 * the registry-facing signature (the aliased import is what makes the
 * delegation land on ui/returns, not on a same-named composable here).
 */
@Composable
fun ShippingAddressScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddressBookScreen(pageId = "shipping-address", onBack = onBack, openPage = openPage, query = query)
}
