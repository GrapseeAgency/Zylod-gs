package com.zylod.wholesale.ui.screens

import androidx.compose.runtime.Composable
import com.zylod.wholesale.ui.account.ProfilePhotoScreen as SharedProfilePhotoScreen
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/**
 * t233 — NATIVE Kotlin screen for the SPA pageId "profile-photo"
 * (src/lib/page-loader.ts registry entry, now owned by Compose — the
 * WebView is fallback-only for unregistered ids).
 *
 * t280 — the curated-metadata body is GONE: this pageId is now owned by the
 * typed ui/account implementation (the profile-photo port: multipart upload (field photo) against api/profile/photo, persisted since t280). The meta object below and the
 * NativePageRegistry composable signature are unchanged (the t264/t279
 * delegate pattern).
 */
data object ProfilePhotoPageMeta : NativePageMeta() {
    override val pageId = "profile-photo"
    override val title = "Profile Photo"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null
    override val summary = "Profile Photo — upload, preview and remove the avatar on your account."
    override val tabHint = ""
    override val bullets = listOf(
        "Typed native screen — live data from the account settings API family.",
        "Honest states: loading, retry, signed-out wall — never fabricated data.",
        "Native ownership: this Kotlin screen owns the profile-photo pageId via RouteOwnership.",
    )
    override val related = listOf(
        NativePageLink("profile", "Profile"),
        NativePageLink("edit-profile", "Edit Profile"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * Delegation only — the shared [SharedProfilePhotoScreen] owns the rendering and the
 * wire calls; this file keeps the registry-facing signature (the aliased
 * import is what makes the delegation land on ui/account, not on this
 * file's own same-named composable).
 */
@Composable
fun ProfilePhotoScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SharedProfilePhotoScreen(onBack = onBack, openPage = openPage)
}
