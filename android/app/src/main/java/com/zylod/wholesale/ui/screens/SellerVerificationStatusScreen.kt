package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.sellerops.SellerVerificationStatusScreen as SharedSellerVerificationStatusScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId
 * "seller-verification-status" (src/lib/page-loader.ts registry entry, now
 * owned by Compose — the WebView is fallback-only for unregistered ids).
 *
 * t266 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/sellerops implementation. The body is a thin delegation to the
 * shared verification-status screen (pageId-keyed so it keeps its own
 * ViewModel) — the REAL GET api/supplier/verification book: the honest
 * progress card, the required-types checklist and the uploaded-document
 * rows. The meta object below and the NativePageRegistry composable
 * signature are unchanged.
 */
data object SellerVerificationStatusPageMeta : NativePageMeta() {
    override val pageId = "seller-verification-status"
    override val title = "Seller Verification Status"
    override val category = "Seller & Supplier"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Seller Verification Status — the seller and supplier toolchain on the Zylod marketplace. This long-tail page renders its honest on-device content and links into the live native surfaces around it."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the seller-verification-status pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("seller-dashboard", "Seller Dashboard"),
        NativePageLink("supplier-center", "Supplier Center"),
        NativePageLink("product-upload", "Product Upload"),
    )
}

/**
 * Delegation only — the shared [SharedSellerVerificationStatusScreen] owns
 * the rendering and the wire calls; this file keeps the registry-facing
 * signature (the aliased import is what makes the delegation land on
 * ui/sellerops, not on this file's own same-named composable).
 */
@Composable
fun SellerVerificationStatusScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedSellerVerificationStatusScreen(pageId = "seller-verification-status", onBack = onBack, openPage = openPage, query = query)
}
