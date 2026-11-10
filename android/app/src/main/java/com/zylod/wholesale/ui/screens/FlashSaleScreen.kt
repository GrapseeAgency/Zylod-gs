package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.deals.DealBrowseScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "flash-sale".
 *
 * t299 — DEAL BROWSE parity: the body is a thin delegation to the shared
 * [DealBrowseScreen] (pageId-keyed ViewModel) — the REAL merged flash+daily
 * deals the web's GenericDealsPage renders for every DEAL_IDS id:
 * GET api/deals?limit=20 with the web's own merge + dedupe by productId,
 * the DEAL_META banner copy + gradients verbatim, the deal card with the
 * -N% badge, the t285 nowrap MOQ/claimed row and the 1..50 stock urgency
 * gate, hearts via ApiClient.wishlistApi, and the web's honest empty state.
 * The old body rendered the generic pipeline — several rows actively
 * fetched the WRONG surface (pre-order/sample-orders/cross-border pulled
 * api/orders/my-orders, the buyer's ORDER LIST, under a deal banner;
 * clearance/seasonal-offers invented query params the route ignores; five
 * fetched nothing). The meta object below keeps its registry identity
 * (title/kind/related unchanged; endpoint + summary now state the row's
 * REAL data source) and the NativePageRegistry composable signature is
 * unchanged.
 */
data object FlashSalePageMeta : NativePageMeta() {
    override val pageId = "flash-sale"
    override val title = "Flash Sale"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.DEALS
    override val endpoint: String? = "api/deals?limit=20"
    override val summary = "Flash Sale — the native deal browse: the grid streams the REAL merged flash + daily deals from the Zylod API (api/deals?limit=20), the same data the web's deals page renders for this id."
    override val tabHint = ""
    override val bullets = listOf(
        "Live deals grid — the server's own merged rows, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the flash-sale pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("coupons", "Coupons"),
        NativePageLink("vip-club", "VIP Club"),
        NativePageLink("referral-program", "Referral Program"),
    )
}

@Composable
fun FlashSaleScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    DealBrowseScreen(
        pageId = "flash-sale",
        title = "Flash Sale",
        onBack = onBack,
        openPage = openPage,
        query = query,
    )
}
