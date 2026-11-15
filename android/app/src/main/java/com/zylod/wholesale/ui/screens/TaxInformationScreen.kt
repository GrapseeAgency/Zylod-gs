package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.account.TaxInformationScreen as TypedTaxInformationScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "tax-information"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t303 — the WebScreen forward is RETIRED: this pageId is now owned by the
 * typed ui/account implementation. The body is a thin delegation to the
 * shared [TypedTaxInformationScreen] — the REAL wire the web page renders, with the
 * same honesty contract. The meta object keeps its registry identity and the
 * NativePageRegistry composable signature is unchanged.
 */
data object TaxInformationPageMeta : NativePageMeta() {
    override val pageId = "tax-information"
    override val title = "Tax Information"
    override val category = "Settings & App"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Tax Information — GET/PATCH api/profile/tax with the web honesty contract: guests get the account gate, ‘Not Set’/‘N/A’ sentinels render as empty fields, and the buyer 501 surfaces as not-implemented, never a fake success."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Real wire — the same endpoints the web page calls, rendered natively.",
        "Honest states: sign-in gates, verbatim server errors, never fabricated data.",
        "Native ownership: this Kotlin screen owns the tax-information pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("business-profile", "Business Profile"),
        NativePageLink("account-settings", "Account Settings"),
        NativePageLink("seller-verification", "Seller Verification"),
    )
}

/**
 * Delegation only — the shared typed screen owns the rendering and the wire
 * calls; this file keeps the registry-facing signature (the aliased import
 * is what makes the delegation land on ui.account.TaxInformationScreen, not on this file's own
 * same-named composable).
 */
@Composable
fun TaxInformationScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    com.zylod.wholesale.ui.account.TaxInformationScreen(onBack = onBack, openPage = openPage)
}
