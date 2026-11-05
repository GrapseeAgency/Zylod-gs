package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.profile.EditProfileFocus
import com.zylod.wholesale.ui.profile.EditProfileScreen as TypedEditProfileScreen

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "edit-profile"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t279 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/profile form. The Profile hub's tappable completion chip ("75%")
 * used to land HERE on a static essay while the server exposes the SAME
 * GET/PATCH api/profile/me contract the web edit-profile page drives — a
 * signed-in user could not change their name/phone/business identity
 * anywhere in the native app. The meta object below and the
 * NativePageRegistry composable signature are unchanged.
 */
data object EditProfilePageMeta : NativePageMeta() {
    override val pageId = "edit-profile"
    override val title = "Edit Profile"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Edit Profile — your identity, contact and business details, saved to your account."
    override val tabHint = ""
    override val bullets = listOf(
        "Curated native content — no fabricated server data, ever.",
        "Offline-safe: the last-saved payload renders first — never a white screen.",
        "Native ownership: this Kotlin screen owns the edit-profile pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("address-book", "Address Book"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the typed [TypedEditProfileScreen] owns the rendering
 * and the wire calls (GET api/profile/me prefill → PATCH save); this file
 * keeps the registry-facing signature.
 */
@Composable
fun EditProfileScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    TypedEditProfileScreen(
        focus = EditProfileFocus.GENERAL,
        onBack = onBack,
        openPage = openPage,
    )
}
