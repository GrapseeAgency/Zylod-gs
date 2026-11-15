package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.finance.AddPaymentMethodScreen as SharedAddPaymentMethodScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "add-payment-method"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t256 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/finance implementation. The body is a thin delegation to the
 * shared add-payment-method screen (pageId-keyed so it keeps its own
 * AddPaymentMethodViewModel) — the REAL POST api/payment-methods with its
 * two families behind a segmented toggle: Mobile Wallet (bKash/Nagad/Upay/
 * Rocket chips, required label, the Bangladeshi phone regex mirrored
 * client-side) and Card (the tokenized last-4-only contract, required
 * holder, MM/YY expiry, debit/credit + network pickers); the route's real
 * 400 text surfaces verbatim. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object AddPaymentMethodPageMeta : NativePageMeta() {
    override val pageId = "add-payment-method"
    override val title = "Add Payment Method"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "The server validates the Bangladeshi mobile format — an invalid number is refused with the real reason."
    override val tabHint = ""
    override val bullets = listOf(
        "Add Payment Method",
        "Debit / Credit / Corporate Card",
        "Mobile Financial Services",
        "Corporate Bank Account / L/C",
    )
    override val related = listOf(
        NativePageLink("payment-method", "Payment Method"),
    )
}

/**
 * Delegation only — the shared [SharedAddPaymentMethodScreen] owns the
 * rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/finance, not on this file's own same-named composable).
 */
@Composable
fun AddPaymentMethodScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddPaymentMethodScreen(pageId = "add-payment-method", onBack = onBack, openPage = openPage, query = query)
}
