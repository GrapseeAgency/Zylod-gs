package com.zylod.wholesale.ui.account

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.delay

/**
 * t280 — advanced notification preferences (14 category cards + quiet hours).
 * Registry-facing delegation lives in ui/screens/NotificationPreferencesScreen.kt.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationPreferencesScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: NotificationPreferencesViewModel = viewModel(
        key = "native-notification-preferences",
    ) { NotificationPreferencesViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    var toast by remember { mutableStateOf<String?>(null) }
    var lastToasted by remember { mutableIntStateOf(0) }
    LaunchedEffect(state.savedTick) {
        if (state.savedTick > lastToasted) {
            lastToasted = state.savedTick
            toast = "Notification preferences saved."
        }
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
                title = { Text("Notification Preferences", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
        when {
            state.needsAuth -> {
                PrefsWall(padding) {
                    Text("Your session ended — sign in to manage notifications.", fontSize = 13.sp)
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
                }
                return@Scaffold
            }
            state.loading -> {
                PrefsWall(padding) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text("Loading your saved preferences…", fontSize = 12.sp)
                }
                return@Scaffold
            }
            state.error != null -> {
                PrefsWall(padding) {
                    Text(state.error ?: "", fontSize = 13.sp)
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = { vm.refresh() }) { Text("Retry", fontWeight = FontWeight.Bold) }
                }
                return@Scaffold
            }
        }

        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (toast != null) {
                item {
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
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
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { vm.muteAll(true) },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                    ) { Text("Mute All Channels", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                    OutlinedButton(
                        onClick = { vm.muteAll(false) },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                    ) { Text("Unmute All", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                }
            }
            items(state.categories, key = { it.id }) { cat ->
                CategoryCard(cat, vm)
            }
            item {
                QuietHoursCard(state, vm)
            }
            if (state.saveError != null) {
                item {
                    Text(
                        state.saveError ?: "",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
            item {
                Button(
                    onClick = { vm.save() },
                    enabled = !state.saving,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                ) {
                    if (state.saving) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                    } else {
                        Icon(Icons.Outlined.Check, null, Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Save All Notification Preferences", fontSize = 12.sp, fontWeight = FontWeight.Black)
                    }
                }
            }
        }
    }
}

@Composable
private fun PrefsWall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
    Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, content = { content() })
    }
}

@Composable
private fun CategoryCard(cat: NotifCategory, vm: NotificationPreferencesViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Notifications,
                    cat.label,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(cat.label, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(cat.description, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (!cat.persisted) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Not saved on your account yet — this toggle resets when you leave the page.",
                    fontSize = 10.sp,
                    fontStyle = FontStyle.Italic,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(8.dp))
            ChannelRow("Push", cat.push) { vm.setPush(cat.id, it) }
            ChannelRow("Email", cat.email) { vm.setEmail(cat.id, it) }
            ChannelRow("SMS", cat.sms) { vm.setSms(cat.id, it) }
        }
    }
}

@Composable
private fun ChannelRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
    ) {
        Text(label, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun QuietHoursCard(state: NotificationPreferencesUiState, vm: NotificationPreferencesViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 1.dp,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Schedule, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Quiet Hours — Do Not Disturb", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text("Mute push notifications during sleep hours", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = state.quietHoursEnabled, onCheckedChange = vm::setQuietHoursEnabled)
            }
            if (state.quietHoursEnabled) {
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = state.quietStart,
                        onValueChange = vm::setQuietStart,
                        label = { Text("Sleep (Quiet Start)", fontSize = 11.sp) },
                        singleLine = true,
                        placeholder = { Text("22:00") },
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = state.quietEnd,
                        onValueChange = vm::setQuietEnd,
                        label = { Text("Wake (Quiet End)", fontSize = 11.sp) },
                        singleLine = true,
                        placeholder = { Text("07:00") },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
