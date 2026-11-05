package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.profile.EditProfileFocus
import com.zylod.wholesale.ui.profile.EditProfileScreen as TypedEditProfileScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "business-profile"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t279 — the curated-metadata body is GONE: the Profile hub's "Business
 * profile" link used to land HERE on a static essay while the server
 * exposes the SAME GET/PATCH api/profile/me contract the web drives (the
 * buyer's businessName/businessType, the supplier's companyName/
 * tradeLicenseNumber all persist through it). Now a delegation to the
 * typed ui/profile form in business focus. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object BusinessProfilePageMeta : NativePageMeta() {
    override val pageId = "business-profile"
    override val title = "Business Profile"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Business Profile — your registered business identity, saved to your account."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the business-profile pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("buyer-orders", "Buyer Orders"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the typed [TypedEditProfileScreen] in business focus
 * owns the rendering and the wire calls; this file keeps the
 * registry-facing signature.
 */
@Composable
fun BusinessProfileScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedEditProfileScreen(
        focus = EditProfileFocus.BUSINESS,
        onBack = onBack,
        openPage = openPage,
    )
}
