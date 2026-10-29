package com.zylod.wholesale.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta

/** t233 page metadata — Kotlin registry entry for the "profile" pageId. */
data object ProfilePageMeta : NativePageMeta() {
    override val pageId = "profile"
    override val title = "Profile"
    override val category = "Account & Profile"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null // identity comes from the paired session cache
    override val summary =
        "The account hub: session identity from the same UserProfileSeed the WebView bridge " +
            "uses, quick access to native orders, wishlist, wallet and settings."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Guests never land here — an unauthenticated profile request opens native login.",
        "Verification badges mirror the server's own flags (email / phone / KYC).",
        "Sign-out clears the native session AND the cart (SessionManager.clear contract).",
    )
    override val related = listOf(
        NativePageLink("buyer-orders", "My Orders"),
        NativePageLink("wishlist", "Wishlist"),
        NativePageLink("account-settings", "Account Settings"),
    )
}

/**
 * NATIVE Profile (t233). Tab-like destination (profile tab highlighted,
 * onBack == null); system Back pops to Home.
 */
@Composable
fun ProfileScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val vm: ProfileViewModel = viewModel { ProfileViewModel() }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-read the session on every entry — profile may have been re-hydrated
    // (or expired) while the user was on another tab.
    LaunchedEffect(Unit) { vm.refresh() }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "title", contentType = "header") {
            Text(
                "Profile",
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        if (!state.signedIn) {
            item(key = "guest", contentType = "guest") {
                GuestState(openPage = openPage)
            }
        } else {
            item(key = "identity", contentType = "identity") {
                IdentityCard(state, openPage)
            }
            item(key = "links-header", contentType = "header") {
                Text(
                    "Account",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            val links = listOf(
                Triple(Icons.Outlined.ShoppingBag, "My Orders", "buyer-orders"),
                Triple(Icons.Outlined.FavoriteBorder, "Wishlist", "wishlist"),
                Triple(Icons.Outlined.Wallet, "Wallet", "my-wallet"),
                Triple(Icons.Outlined.ReceiptLong, "Transaction history", "transaction-history"),
                Triple(Icons.Outlined.Notifications, "Notifications", "notifications"),
                Triple(Icons.Outlined.Settings, "Account settings", "account-settings"),
                Triple(Icons.Outlined.Storefront, "Business profile", "business-profile"),
                Triple(Icons.Outlined.Verified, "Verification center", "verification-center"),
            )
            links.forEach { (icon, label, pageId) ->
                item(key = "link-$pageId", contentType = "link") {
                    ProfileLinkRow(icon, label) { openPage(pageId, "") }
                }
            }
            item(key = "signout", contentType = "action") {
                Button(
                    onClick = vm::signOut,
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainer,
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Sign out", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun IdentityCard(state: ProfileUiState, openPage: (pageId: String, query: String) -> Unit) {
    val profile = state.profile
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(14.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(52.dp)
                    .background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(50)),
            ) {
                Icon(Icons.Outlined.Person, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    profile?.fullName?.takeIf(String::isNotBlank)
                        ?: profile?.businessName?.takeIf(String::isNotBlank)
                        ?: "Zylod buyer",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    profile?.email ?: profile?.phone ?: "Signed in",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    val verified = profile?.isEmailVerified == true || profile?.isPhoneVerified == true
                    Icon(
                        Icons.Outlined.Verified,
                        null,
                        tint = if (verified) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(13.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        if (verified) "Verified account" else "Verification pending",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if ((profile?.profileCompletionPct ?: 0) in 1..99) {
                Text(
                    "${profile?.profileCompletionPct}%",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable { openPage("edit-profile", "") },
                )
            }
        }
    }
}

@Composable
private fun ProfileLinkRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            Text("›", fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun GuestState(openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(24.dp),
        ) {
            Icon(
                Icons.Outlined.Person,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
            Text(
                "You're browsing as a guest",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "Sign in to see your orders, wishlist and wallet.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = { openPage("login", "") },
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .padding(top = 16.dp)
                    .height(44.dp),
            ) {
                Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
