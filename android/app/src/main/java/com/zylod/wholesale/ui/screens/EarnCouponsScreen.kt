package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.coupons.EarnCouponsScreen as TypedEarnCouponsScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "earn-coupons"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t300 — the curated-metadata body is GONE: this pageId is now owned by the
 * NEW typed ui/coupons reward-tasks implementation. The body is a thin
 * delegation to the shared [TypedEarnCouponsScreen] — the REAL Task 111
 * reward rail the web's EarnCouponsPage renders for this id: GET
 * api/coupons/earn (active tasks; signed-in rows carry the server's claimed
 * flag + REAL proof progress), POST api/coupons/earn { taskId } (201 → the
 * created voucher; 403/409 surface the server's own shortfall/already-
 * claimed wording), the soft sign-in CTA for guests and the offline
 * saved-tasks banner. The meta object below keeps its registry identity and
 * the NativePageRegistry composable signature is unchanged.
 */
data object EarnCouponsPageMeta : NativePageMeta() {
    override val pageId = "earn-coupons"
    override val title = "Earn Coupons"
    override val category = "Marketing & Rewards"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Every reward is verified against your real account activity — orders placed, reviews written, check-ins kept — before the voucher lands in your vault."
    override val tabHint = ""
    override val bullets = listOf(
        "Earn Free Vouchers",
        "Check back soon — new ways to earn are added by the platform team.",
        "Complete Business Milestones to Earn Vouchers",
        "Available Tasks ( )",
        "No reward tasks are live right now",
    )
    override val related = listOf(
        NativePageLink("my-coupons", "My Coupons"),
    )
}

/**
 * Delegation only — the shared [TypedEarnCouponsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/coupons, not on
 * this file's own same-named composable).
 */
@Composable
fun EarnCouponsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedEarnCouponsScreen(onBack = onBack, openPage = openPage, query = query)
}
