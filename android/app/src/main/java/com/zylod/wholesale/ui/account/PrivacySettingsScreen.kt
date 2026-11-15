package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
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
import com.zylod.wholesale.data.api.PrivacyUpdate
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Privacy Settings (privacy-settings-page.tsx port, real wire):
 * GET/PATCH api/profile/privacy — profileVisibility (public|buyers|private),
 * showEmail, showPhone + the `configured` marker. No optimistic writes: the
 * toggle PATCHes first and the UI adopts the SERVER-confirmed state on 2xx,
 * reverting with the verbatim error otherwise (web contract verbatim).
 */
data class PrivacySettingsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val profileVisibility: String = "public",
    val showEmail: Boolean = false,
    val showPhone: Boolean = false,
    val configured: Boolean = false,
    val saving: Boolean = false,
    val saveError: String? = null,
    val savedTick: Int = 0,
)

class PrivacySettingsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(PrivacySettingsUiState())
    val state: StateFlow<PrivacySettingsUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).privacy()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Failed to load your privacy settings (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(loading = false, loadError = body?.error ?: "Failed to load your privacy settings.") }
                    return@launch
                }
                val d = body.data
                _state.update {
                    it.copy(
                        loading = false,
                        profileVisibility = when (d?.profileVisibility) {
                            "buyers" -> "buyers"
                            "private" -> "private"
                            else -> "public"
                        },
                        showEmail = d?.showEmail == true,
                        showPhone = d?.showPhone == true,
                        configured = d?.configured == true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your privacy settings. Check your connection and retry.") }
            }
        }
    }

    /** PATCH-first (never optimistic): applies the server-confirmed row on 2xx. */
    fun patch(patch: PrivacyUpdate) {
        if (_state.value.saving) return
        _state.update { it.copy(saveError = null, saving = true) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).updatePrivacy(patch)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(saving = false, needsAuth = true, saveError = "Your session ended — sign in to save your privacy settings.")
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(saving = false, saveError = "Saving your privacy settings failed (HTTP ${response.code()}).") }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(saving = false, saveError = body?.error ?: "Saving your privacy settings failed.") }
                    return@launch
                }
                val d = body.data
                _state.update {
                    it.copy(
                        saving = false,
                        savedTick = it.savedTick + 1,
                        profileVisibility = when (d?.profileVisibility) {
                            "buyers" -> "buyers"
                            "private" -> "private"
                            else -> "public"
                        },
                        showEmail = d?.showEmail == true,
                        showPhone = d?.showPhone == true,
                        configured = true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, saveError = "Network error while saving your privacy settings. Check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacySettingsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: PrivacySettingsViewModel = viewModel(key = "native-privacy-settings") {
        PrivacySettingsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Privacy Settings", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
                    title = "Sign in to manage your privacy",
                    message = "Privacy controls are stored on your account.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your privacy settings…", fontSize = 12.sp)
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
                AccountSettingsSection("Profile Visibility") {
                    Text(
                        if (state.configured) "Customized for your account" else "Platform default — not customized yet",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp),
                    )
                    val visibilityOptions = listOf(
                        Triple("public", "Public", "Any signed-in visitor can view your profile"),
                        Triple("buyers", "Buyers Only", "Only signed-in buyers can view your profile"),
                        Triple("private", "Private", "Only you and Zylod support can view your profile"),
                    )
                    for ((key, label, desc) in visibilityOptions) {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable(enabled = !state.saving && state.profileVisibility != key) {
                                    vm.patch(PrivacyUpdate(profileVisibility = key))
                                }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = state.profileVisibility == key, onClick = null)
                            Column(Modifier.padding(start = 8.dp)) {
                                Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black)
                                Text(desc, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
                AccountSettingsSection("Contact Visibility") {
                    ToggleRow(
                        label = "Show email on my profile",
                        desc = "Suppliers you inquire with can reach you by email",
                        checked = state.showEmail,
                        enabled = !state.saving,
                    ) { vm.patch(PrivacyUpdate(showEmail = it)) }
                    Spacer(Modifier.height(10.dp))
                    ToggleRow(
                        label = "Show phone on my profile",
                        desc = "Suppliers you inquire with can reach you by phone",
                        checked = state.showPhone,
                        enabled = !state.saving,
                    ) { vm.patch(PrivacyUpdate(showPhone = it)) }
                }
                if (state.saveError != null) {
                    Text(state.saveError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
internal fun ToggleRow(
    label: String,
    desc: String,
    checked: Boolean,
    enabled: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Text(desc, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, enabled = enabled, onCheckedChange = onChange)
    }
}
