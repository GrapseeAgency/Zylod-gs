package com.zylod.wholesale.ui.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.PushPrefsData
import com.zylod.wholesale.data.api.PushPrefsUpdate
import com.zylod.wholesale.data.api.pushPrefsSingle
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Push Notification Settings (push-notification-settings-page.tsx
 * port, real wire). NOTE: this is the PER-CHANNEL preference surface
 * (api/notifications/preferences — push/email booleans, sound, quiet hours,
 * digest, mentions) — a DIFFERENT wire from the 14-category
 * api/profile/notifications surface the t280 screen owns. The route's PATCH
 * takes a SINGLE-KEY partial body; the web applies optimistically and keeps
 * the local value on failure — the same contract here (the honest note shows
 * when a write fails; nothing is silently dropped).
 */
data class PushNotificationSettingsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val prefs: PushPrefsData = PushPrefsData(),
    val savingKey: String? = null,
    val saveError: String? = null,
)

class PushNotificationSettingsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(PushNotificationSettingsUiState())
    val state: StateFlow<PushNotificationSettingsUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).pushPrefs()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Failed to load your notification preferences (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true || body.data == null) {
                    _state.update { it.copy(loading = false, loadError = body?.error ?: "Failed to load your notification preferences.") }
                    return@launch
                }
                _state.update { it.copy(loading = false, prefs = body.data) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your preferences. Check your connection and retry.") }
            }
        }
    }

    /** PATCH-first with the single-key body; local value kept on failure + honest error. */
    fun setBoolean(key: String, value: Boolean) {
        if (_state.value.savingKey != null) return
        val current = _state.value.prefs
        // Local echo like the web (it sets the row immediately), PATCH follows.
        val echoed = when (key) {
            "pushOrderUpdates" -> current.copy(pushOrderUpdates = value)
            "pushPromotions" -> current.copy(pushPromotions = value)
            "pushPriceDrops" -> current.copy(pushPriceDrops = value)
            "pushBackInStock" -> current.copy(pushBackInStock = value)
            "pushDelivery" -> current.copy(pushDelivery = value)
            "pushChat" -> current.copy(pushChat = value)
            "pushSystem" -> current.copy(pushSystem = value)
            "emailOrderUpdates" -> current.copy(emailOrderUpdates = value)
            "emailPromotions" -> current.copy(emailPromotions = value)
            "emailPriceDrops" -> current.copy(emailPriceDrops = value)
            "emailBackInStock" -> current.copy(emailBackInStock = value)
            "emailDelivery" -> current.copy(emailDelivery = value)
            "quietHoursEnabled" -> current.copy(quietHoursEnabled = value)
            "digestEnabled" -> current.copy(digestEnabled = value)
            "mentionNotify" -> current.copy(mentionNotify = value)
            else -> current
        }
        _state.update { it.copy(savingKey = key, prefs = echoed, saveError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base)
                    .updatePushPrefs(pushPrefsSingle(key, value))
                if (!response.isSuccessful || response.body()?.success != true) {
                    // Revert to the server row — the toggle never lies.
                    _state.update { it.copy(savingKey = null, prefs = current, saveError = "Saving $key failed (HTTP ${response.code()}) — reverted.") }
                    return@launch
                }
                _state.update { it.copy(savingKey = null) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(savingKey = null, prefs = current, saveError = "Network error — change reverted.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PushNotificationSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: PushNotificationSettingsViewModel = viewModel(key = "native-push-notification-settings") {
        PushNotificationSettingsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Push & Channel Notifications", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when {
            state.needsAuth -> AccountSettingsWall(padding) {
                AccountSignInGate(
                    title = "Sign in to manage notification channels",
                    message = "Channel preferences are stored on your account.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your notification preferences…", fontSize = 12.sp)
            }
            state.loadError != null -> AccountSettingsWall(padding) {
                Text(state.loadError ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.refresh() }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                val p = state.prefs
                AccountSettingsSection("Push Channels") {
                    ChannelToggle("Order Status & Tracking", "Confirmations, packaging and dispatch alerts", "pushOrderUpdates", p.pushOrderUpdates, state, vm)
                    ChannelToggle("Price Drop Alerts", "When a watched product drops in price", "pushPriceDrops", p.pushPriceDrops, state, vm)
                    ChannelToggle("Back in Stock", "When a watched product is restocked", "pushBackInStock", p.pushBackInStock, state, vm)
                    ChannelToggle("Delivery Updates", "Shipment milestones and live tracking", "pushDelivery", p.pushDelivery, state, vm)
                    ChannelToggle("Chat Messages", "Supplier replies and RFQ messages", "pushChat", p.pushChat, state, vm)
                    ChannelToggle("System & Security", "Sign-in alerts and platform notices", "pushSystem", p.pushSystem, state, vm)
                    ChannelToggle("Promotions", "Flash sales and coupon drops", "pushPromotions", p.pushPromotions, state, vm)
                }
                AccountSettingsSection("Email Channels") {
                    ChannelToggle("Order Updates", "Order confirmations and status changes", "emailOrderUpdates", p.emailOrderUpdates, state, vm)
                    ChannelToggle("Price Drop Alerts", "Watched products dropping in price", "emailPriceDrops", p.emailPriceDrops, state, vm)
                    ChannelToggle("Back in Stock", "Watched products restocked", "emailBackInStock", p.emailBackInStock, state, vm)
                    ChannelToggle("Delivery Updates", "Shipment milestones", "emailDelivery", p.emailDelivery, state, vm)
                    ChannelToggle("Promotions", "Campaign announcements", "emailPromotions", p.emailPromotions, state, vm)
                }
                AccountSettingsSection("Delivery & Mentions") {
                    ChannelToggle("Quiet Hours", "Hold notifications between quiet hours", "quietHoursEnabled", p.quietHoursEnabled, state, vm)
                    if (p.quietHoursEnabled) {
                        Text(
                            "Quiet hours: ${p.quietHoursStart ?: "22:00"} – ${p.quietHoursEnd ?: "07:00"}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 4.dp, top = 2.dp, bottom = 6.dp),
                        )
                    }
                    ChannelToggle("Weekly Digest", "One summary email instead of many pings", "digestEnabled", p.digestEnabled, state, vm)
                    ChannelToggle("Mention Notifications", "Ping me when someone @mentions me", "mentionNotify", p.mentionNotify, state, vm)
                }
                if (state.saveError != null) {
                    Text(state.saveError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
                Text(
                    "This page controls the push/email CHANNELS. The 14 delivery-category cards live in Notification Preferences.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ChannelToggle(
    label: String,
    desc: String,
    key: String,
    checked: Boolean,
    state: PushNotificationSettingsUiState,
    vm: PushNotificationSettingsViewModel,
) {
    Column {
        Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black)
                Text(desc, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Switch(
                checked = checked,
                enabled = state.savingKey == null,
                onCheckedChange = { vm.setBoolean(key, it) },
            )
        }
        if (state.savingKey == key) {
            Text("Saving…", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp))
        }
    }
}
