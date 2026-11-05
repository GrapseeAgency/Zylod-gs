package com.zylod.wholesale.ui.account

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay

/**
 * t280 — typed account-settings screen (the web account-settings-page port:
 * section pills, Security / Notifications / Privacy / Appearance / Danger).
 * Registry-facing delegation lives in ui/screens/AccountSettingsScreen.kt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: AccountSettingsViewModel = viewModel(
        key = "native-account-settings",
    ) { AccountSettingsViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    var toast by remember { mutableStateOf<String?>(null) }
    var lastToastedNotif by remember { mutableIntStateOf(0) }
    var lastToastedPrivacy by remember { mutableIntStateOf(0) }

    LaunchedEffect(state.savedNotificationsTick) {
        if (state.savedNotificationsTick > lastToastedNotif) {
            lastToastedNotif = state.savedNotificationsTick
            toast = "Notification preferences saved."
        }
    }
    LaunchedEffect(state.savedPrivacyTick) {
        if (state.savedPrivacyTick > lastToastedPrivacy) {
            lastToastedPrivacy = state.savedPrivacyTick
            toast = "Privacy settings saved to your account."
        }
    }
    LaunchedEffect(state.signedOutTick) {
        if (state.signedOutTick > 0) openPage("login", "")
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2500)
            toast = null
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Account Settings", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back")
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            when {
                state.needsAuth -> {
                    SettingsWall(
                        text = "Your session ended — sign in to manage your settings.",
                        action = "Sign in",
                        onAction = { openPage("login", "") },
                    )
                    return@Column
                }
                state.loading -> {
                    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator()
                            Spacer(Modifier.height(12.dp))
                            Text("Loading your settings…", fontSize = 12.sp)
                        }
                    }
                    return@Column
                }
                state.error != null -> {
                    SettingsWall(
                        text = state.error ?: "Could not load your settings",
                        action = "Retry",
                        onAction = { vm.refresh() },
                    )
                    return@Column
                }
            }

            if (toast != null) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                ) {
                    Text(
                        toast ?: "",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }

            // Section pills (web :356-362 — 5 of the 6 pills; Billing & Tax
            // rows are tax/billing doc pages on the web, not settings).
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            ) {
                SectionPill("Security", state.section == AccountSettingsSection.SECURITY) {
                    vm.selectSection(AccountSettingsSection.SECURITY)
                }
                SectionPill("Notifications", state.section == AccountSettingsSection.NOTIFICATIONS) {
                    vm.selectSection(AccountSettingsSection.NOTIFICATIONS)
                }
                SectionPill("Privacy", state.section == AccountSettingsSection.PRIVACY) {
                    vm.selectSection(AccountSettingsSection.PRIVACY)
                }
                SectionPill("Appearance", state.section == AccountSettingsSection.APPEARANCE) {
                    vm.selectSection(AccountSettingsSection.APPEARANCE)
                }
                SectionPill("Danger", state.section == AccountSettingsSection.DANGER) {
                    vm.selectSection(AccountSettingsSection.DANGER)
                }
            }

            when (state.section) {
                AccountSettingsSection.SECURITY -> SecuritySection(state, openPage)
                AccountSettingsSection.NOTIFICATIONS -> NotificationsSection(state, vm, openPage)
                AccountSettingsSection.PRIVACY -> PrivacySection(state, vm)
                AccountSettingsSection.APPEARANCE -> AppearanceSection(state, vm)
                AccountSettingsSection.DANGER -> DangerSection(state, vm)
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SettingsWall(text: String, action: String, onAction: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth().padding(top = 48.dp, bottom = 24.dp),
    ) {
        Text(text, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(12.dp))
        OutlinedButton(onClick = onAction) { Text(action, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun SectionPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
        contentColor = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
        shape = RoundedCornerShape(50),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Text(
            label,
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
        )
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    title,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.2.sp,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun NavigationRow(icon: ImageVector, label: String, sub: String?, badge: String?, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
    ) {
        Icon(icon, label, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            if (sub != null) {
                Text(sub, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (badge != null) {
            Surface(
                color = if (badge == "ENABLED") MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant,
                contentColor = if (badge == "ENABLED") MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                shape = RoundedCornerShape(50),
            ) {
                Text(badge, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
            }
        }
        Spacer(Modifier.width(6.dp))
        Icon(Icons.Outlined.ChevronRight, "Open", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun ToggleRow(
    icon: ImageVector,
    label: String,
    sub: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
    ) {
        Icon(icon, label, tint = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.outline, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.outline)
            if (sub != null) {
                Text(sub, fontSize = 11.sp, color = if (enabled) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.outline)
            }
        }
        Switch(checked = checked, onCheckedChange = if (enabled) onCheckedChange else null)
    }
}

@Composable
private fun SecuritySection(state: AccountSettingsUiState, openPage: (String, String) -> Unit) {
    SettingsCard("Security") {
        NavigationRow(
            icon = Icons.Outlined.Lock,
            label = "Change Password",
            sub = "Reset via the secure password-reset flow",
            badge = null,
        ) { openPage("reset-password", "") }
        NavigationRow(
            icon = Icons.Outlined.Shield,
            label = "Two-Factor Authentication (2FA)",
            sub = "Protect your account with TOTP authenticator",
            badge = if (state.twoFactorEnabled) "ENABLED" else "OFF",
        ) { openPage("two-factor-auth", "") }
        NavigationRow(
            icon = Icons.Outlined.Person,
            label = "Edit KYC & Business Info",
            sub = "Identity, contact and business details",
            badge = null,
        ) { openPage("edit-profile", "") }
    }
}

@Composable
private fun NotificationsSection(
    state: AccountSettingsUiState,
    vm: AccountSettingsViewModel,
    openPage: (String, String) -> Unit,
) {
    SettingsCard("Notifications") {
        ToggleRow(Icons.Outlined.ShoppingBag, "Order Status Updates", "Instant push alerts for order state changes", state.notifOrderPush, vm::setNotifOrderPush)
        ToggleRow(Icons.Outlined.LocalShipping, "Shipping & Tracking Alerts", "Real-time freight & delivery notifications", state.notifShipPush, vm::setNotifShipPush)
        ToggleRow(Icons.Outlined.Settings, "Price Drop & Restock Alerts", "Notifications when watched SKUs change price", state.notifPricePush, vm::setNotifPricePush)
        ToggleRow(Icons.Outlined.Mail, "Email Notification Digest", "Receive order summaries via email", state.notifOrderEmail, vm::setNotifOrderEmail)

        if (state.notifError != null) {
            Text(state.notifError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { vm.saveNotifications() },
            enabled = !state.savingNotifications,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            modifier = Modifier.fillMaxWidth().height(46.dp),
        ) {
            if (state.savingNotifications) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Icon(Icons.Outlined.Check, null, Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Save Notification Settings", fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
        }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = { openPage("notification-preferences", "") },
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(42.dp),
        ) {
            Text("Advanced preferences", fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PrivacySection(state: AccountSettingsUiState, vm: AccountSettingsViewModel) {
    SettingsCard("Visibility Settings") {
        ToggleRow(
            Icons.Outlined.Visibility,
            "Store / Business Directory Visibility",
            "Allow other verified merchants to see your business profile",
            state.profilePublic,
            vm::setProfilePublic,
        )
        // Honest limitation (web parity): no messaging-gate setting exists on
        // the backend — rendered disabled, never a fake toggle.
        ToggleRow(
            Icons.Outlined.Mail,
            "Direct Messaging Inquiries",
            "Not implemented yet — requires backend support",
            checked = false,
            onCheckedChange = {},
            enabled = false,
        )
        if (state.privacyError != null) {
            Text(state.privacyError, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = { vm.savePrivacy() },
            enabled = !state.savingPrivacy,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth().height(46.dp),
        ) {
            if (state.savingPrivacy) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Icon(Icons.Outlined.Check, null, Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Save Privacy Options", fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun AppearanceSection(state: AccountSettingsUiState, vm: AccountSettingsViewModel) {
    SettingsCard("Appearance") {
        Text(
            if (state.themeConfigured) "Customized for your account" else "Platform default — not customized yet",
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(Modifier.height(10.dp))
        ThemeChoice(
            icon = Icons.Outlined.Public,
            title = "System Sync",
            sub = "Follow the device's light/dark setting",
            selected = state.themeMode == ThemeController.Mode.SYSTEM,
        ) { vm.applyTheme(ThemeController.Mode.SYSTEM) }
        ThemeChoice(
            icon = Icons.Outlined.Visibility,
            title = "Crisp White",
            sub = "Always light",
            selected = state.themeMode == ThemeController.Mode.LIGHT,
        ) { vm.applyTheme(ThemeController.Mode.LIGHT) }
        ThemeChoice(
            icon = Icons.Outlined.DarkMode,
            title = "Charcoal Dark",
            sub = "Always dark",
            selected = state.themeMode == ThemeController.Mode.DARK,
        ) { vm.applyTheme(ThemeController.Mode.DARK) }
        Spacer(Modifier.height(6.dp))
        Text(
            "Applies instantly on this device and syncs to your account (best-effort offline).",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun ThemeChoice(icon: ImageVector, title: String, sub: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        contentColor = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(14.dp)) {
            Icon(icon, title, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(sub, fontSize = 11.sp)
            }
            if (selected) {
                Icon(Icons.Outlined.Check, "Selected", modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun DangerSection(state: AccountSettingsUiState, vm: AccountSettingsViewModel) {
    SettingsCard("Danger Zone") {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 10.dp)) {
            Icon(Icons.Outlined.Warning, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(10.dp))
            Text(
                "Signing out clears this device's session. Your cart, preferences and account data stay safe on the server.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Button(
            onClick = { vm.signOut() },
            enabled = !state.signingOut,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = MaterialTheme.colorScheme.onError,
            ),
            modifier = Modifier.fillMaxWidth().height(46.dp),
        ) {
            if (state.signingOut) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onError)
            } else {
                Text("Sign Out of Zylod", fontSize = 12.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}
