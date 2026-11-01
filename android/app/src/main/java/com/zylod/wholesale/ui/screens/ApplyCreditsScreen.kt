package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.finance.ApplyCreditsScreen as SharedApplyCreditsScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "apply-credits"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t257 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. MIRROR NOTE: the web apply-credits page
 * is NOT the credit-limit request flow — it is the "Apply Wallet Credit"
 * page (the REAL GET api/wallet/balance balance plus the web page's own
 * honest notice that checkout does not deduct from the wallet yet), so the
 * delegation lands on the shared apply-credits screen that mirrors THAT
 * (the brief's "if the web page differs, mirror the web instead" rule).
 * The meta object below and the NativePageRegistry composable signature
 * are unchanged.
 */
data object ApplyCreditsPageMeta : NativePageMeta() {
    override val pageId = "apply-credits"
    override val title = "Apply Credits"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Apply Credits — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the apply-credits pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedApplyCreditsScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/finance, not on
 * this file's own same-named composable).
 */
@Composable
fun ApplyCreditsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedApplyCreditsScreen(pageId = "apply-credits", onBack = onBack, openPage = openPage, query = query)
}
