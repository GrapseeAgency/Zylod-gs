package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.returns.AddAddressScreen as SharedAddAddressScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "add-address"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t253 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/returns implementation. The body is a thin delegation to the
 * shared add-address screen (pageId-keyed so it keeps its own ViewModel)
 * — the REAL POST api/addresses form (the web page's exact Contact
 * Details/Address fields, validation copy, default toggle and Save/Cancel
 * pair; success pops back). The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object AddAddressPageMeta : NativePageMeta() {
    override val pageId = "add-address"
    override val title = "Add Address"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Add Address — account, identity and money surfaces for the signed-in user. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the add-address pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedAddAddressScreen] owns the rendering
 * and the wire calls; this file keeps the registry-facing signature (the
 * aliased import is what makes the delegation land on ui/returns, not on
 * this file's own same-named composable).
 */
@Composable
fun AddAddressScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedAddAddressScreen(pageId = "add-address", onBack = onBack, openPage = openPage, query = query)
}
