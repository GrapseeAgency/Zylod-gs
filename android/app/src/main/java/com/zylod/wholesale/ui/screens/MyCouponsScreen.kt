package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.coupons.CouponsScreen as TypedMyCouponsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "my-coupons"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t300 — the curated-metadata body is GONE: this pageId is now owned by the
 * EXISTING typed ui/coupons implementation. The body is a thin delegation
 * to the shared [TypedMyCouponsScreen] — the REAL buyer voucher vault the
 * web's MyCouponsPage renders for this id (GET api/coupons/my with the
 * route's active/used statuses, campaign claiming via GET api/coupons +
 * POST api/coupons/claim, and the loyalty-points rail via GET api/rewards),
 * with its honest loading/sign-in/offline/empty states. The meta object
 * below keeps its registry identity and the NativePageRegistry composable
 * signature is unchanged.
 */
data object MyCouponsPageMeta : NativePageMeta() {
    override val pageId = "my-coupons"
    override val title = "My Coupons"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "My Coupons — the buyer's voucher vault (GET api/coupons/my, active + used), the campaign claim rail (GET api/coupons + POST api/coupons/claim) and the loyalty-points rail (GET api/rewards) — the same data the web's MyCouponsPage renders."
    override val tabHint = ""
    override val bullets = listOf(
        "Real vouchers — the vault streams the buyer's own rows from the Zylod API, never fabricated.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the my-coupons pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("coupons", "Coupons"),
        NativePageLink("earn-coupons", "Earn Coupons"),
        NativePageLink("redeem-points", "Redeem Points"),
    )
}

/**
 * Delegation only — the shared [TypedMyCouponsScreen] owns the rendering and
 * the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/coupons, not on
 * this file's own same-named composable).
 */
@Composable
fun MyCouponsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedMyCouponsScreen(onBack = onBack, openPage = openPage, query = query)
}
