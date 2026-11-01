package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.CreditLimitScreen as SharedCreditLimitScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "credit-limit"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared trade-credit screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL GET api/credits/limit find-or-create facility (credit gauge
 * with limit vs used vs available, grace period, next settlement date) and
 * the REAL POST underwriting request with the inline referenceId. The meta
 * object below and the NativePageRegistry composable signature are
 * unchanged.
 */
data object CreditLimitPageMeta : NativePageMeta() {
    override val pageId = "credit-limit"
    override val title = "Credit Limit"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Credit Limit — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the credit-limit pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedCreditLimitScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun CreditLimitScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedCreditLimitScreen(pageId = "credit-limit", onBack = onBack, openPage = openPage, query = query)
}
