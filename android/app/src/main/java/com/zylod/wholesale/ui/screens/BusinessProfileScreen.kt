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
    override val summary = "Address fields are not implemented yet — the platform has no storage for them, so what you type here is not saved. Only the business name, trade license, and category persist."
    override val tabHint = ""
    override val bullets = listOf(
        "Registered Business Entity",
        "Official commercial registration and trade license credentials.",
        "Commercial Entity Details",
        "Trade License verified through Zylod Merchant KYC.",
        "Registered Commercial Address",
        "Commercial Document Archive",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
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
