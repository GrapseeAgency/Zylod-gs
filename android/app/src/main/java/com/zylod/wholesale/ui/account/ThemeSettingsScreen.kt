package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.SettingsBrightness
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.ThemeUpdate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Theme & Appearance (theme-settings-page.tsx port, real wire):
 * GET/PATCH api/profile/theme with the SAME honesty contract as the web —
 * "a mode that cannot survive a reload is not a theme": the backend persists
 * system|light|dark only; high-contrast / compact-density / reduce-motion
 * have NO backend backing and are NOT rendered as fake toggles. The choice
 * applies to the whole app ONLY after the server confirms (no optimistic
 * writes), via [ThemeController.apply] — the same controller the t280
 * Appearance section uses, so both surfaces stay in lockstep.
 */
data class ThemeModeUi(
    val key: String,
    val label: String,
    val desc: String,
    val icon: ImageVector,
)

data class ThemeSettingsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val mode: String = "system",
    val configured: Boolean = false,
    val savingMode: String? = null,
    val saveError: String? = null,
)

class ThemeSettingsViewModel(private val appContext: Context) : ViewModel() {

    val options = listOf(
        ThemeModeUi("light", "Crisp White", "Standard daytime mode", Icons.Outlined.LightMode),
        ThemeModeUi("dark", "Charcoal Dark", "Low-light comfort", Icons.Outlined.DarkMode),
        ThemeModeUi("system", "System Sync", "Matches device settings", Icons.Outlined.SettingsBrightness),
    )

    private val _state = MutableStateFlow(ThemeSettingsUiState())
    val state: StateFlow<ThemeSettingsUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).theme()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Failed to load your saved theme (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(loading = false, loadError = body?.error ?: "Failed to load your saved theme.") }
                    return@launch
                }
                _state.update {
                    it.copy(
                        loading = false,
                        mode = wireToKey(body.data?.theme),
                        configured = body.data?.configured == true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your saved theme. Check your connection and retry.") }
            }
        }
    }

    fun select(mode: String) {
        if (_state.value.savingMode != null) return
        _state.update { it.copy(saveError = null, savingMode = mode) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).updateTheme(ThemeUpdate(mode))
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(savingMode = null, needsAuth = true, saveError = "Your session ended — sign in to save your theme.")
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(savingMode = null, saveError = "Saving your theme failed (HTTP ${response.code()}).") }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(savingMode = null, saveError = body?.error ?: "Saving your theme failed.") }
                    return@launch
                }
                // Server confirmed — only now apply to the whole app.
                val confirmed = wireToKey(body.data?.theme ?: mode)
                _state.update { it.copy(savingMode = null, mode = confirmed, configured = true) }
                ThemeController.apply(ThemeController.fromWire(confirmed))
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(savingMode = null, saveError = "Network error while saving your theme. Check your connection and retry.") }
            }
        }
    }

    private fun wireToKey(raw: String?): String = when (raw?.trim()?.lowercase()) {
        "dark" -> "dark"
        "light" -> "light"
        else -> "system"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ThemeSettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: ThemeSettingsViewModel = viewModel(key = "native-theme-settings") {
        ThemeSettingsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Theme & Appearance", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
                    title = "Sign in to manage your saved theme",
                    message = "Theme preferences are stored on your account.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your saved theme…", fontSize = 12.sp)
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
                AccountSettingsSection("Theme Mode") {
                    Text(
                        if (state.configured) "Customized for your account" else "Platform default — not customized yet",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    for (opt in vm.options) {
                        val selected = state.mode == opt.key
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surface,
                            border = BorderStroke(
                                1.dp,
                                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp)
                                .clickable(enabled = state.savingMode == null && !selected) { vm.select(opt.key) },
                        ) {
                            Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(opt.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(end = 12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(opt.label, fontSize = 12.sp, fontWeight = FontWeight.Black)
                                    Text(opt.desc, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                when {
                                    state.savingMode == opt.key -> CircularProgressIndicator(Modifier.height(16.dp).padding(0.dp), strokeWidth = 2.dp)
                                    selected -> Icon(Icons.Outlined.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                    if (state.saveError != null) {
                        Text(state.saveError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Text(
                        "High contrast, compact density and reduce motion have no backend backing yet — they are not offered here instead of pretending to save.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
