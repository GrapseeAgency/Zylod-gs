package com.zylod.wholesale.ui.account

import android.content.Context
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
import androidx.compose.material.icons.outlined.Delete
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.zylod.wholesale.data.api.AccountDeleteRequest
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.LinkedAccountCreate
import com.zylod.wholesale.data.api.LinkedAccountRow
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Linked Accounts (linked-accounts-page.tsx port, real wire):
 * GET/POST/DELETE api/profile/linked-accounts — provider handles
 * (whatsapp / facebook / instagram / google) linked to the account, max 5
 * server-enforced. No optimistic writes: add/remove adopt the
 * SERVER-returned accounts list on 2xx; verbatim errors otherwise.
 */
data class LinkedAccountsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val accounts: List<LinkedAccountRow> = emptyList(),
    val configured: Boolean = false,
    val provider: String = "whatsapp",
    val handle: String = "",
    val adding: Boolean = false,
    val formError: String? = null,
    val removingId: String? = null,
    val rowError: Pair<String, String>? = null,
)

class LinkedAccountsViewModel(private val appContext: Context) : ViewModel() {

    val providers = listOf(
        Triple("whatsapp", "WhatsApp", "+8801XXXXXXXXX"),
        Triple("facebook", "Facebook", "facebook.com/yourpage"),
        Triple("instagram", "Instagram", "@yourhandle"),
        Triple("google", "Google", "your business profile or email"),
    )

    private val _state = MutableStateFlow(LinkedAccountsUiState())
    val state: StateFlow<LinkedAccountsUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).linkedAccounts()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, loadError = "Failed to load your linked accounts (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(loading = false, loadError = body?.error ?: "Failed to load your linked accounts.") }
                    return@launch
                }
                _state.update {
                    it.copy(
                        loading = false,
                        accounts = body.data?.accounts ?: emptyList(),
                        configured = body.data?.configured == true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, loadError = "Network error while loading your linked accounts. Check your connection and retry.") }
            }
        }
    }

    fun setProvider(provider: String) { _state.update { it.copy(provider = provider) } }
    fun setHandle(handle: String) { _state.update { it.copy(handle = handle, formError = null) } }

    fun add() {
        val s = _state.value
        if (s.adding) return
        val trimmed = s.handle.trim()
        if (trimmed.isEmpty()) {
            _state.update { it.copy(formError = "Enter the handle or number you want to link.") }
            return
        }
        _state.update { it.copy(adding = true, formError = null, rowError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base)
                    .addLinkedAccount(LinkedAccountCreate(provider = s.provider, handle = trimmed))
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(adding = false, needsAuth = true, formError = "Your session ended — sign in to manage linked accounts.")
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update { it.copy(adding = false, formError = "Linking this account failed (HTTP ${response.code()}).") }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(adding = false, formError = body?.error ?: "Linking this account failed.") }
                    return@launch
                }
                _state.update {
                    it.copy(
                        adding = false,
                        accounts = body.data?.accounts ?: it.accounts,
                        configured = true,
                        handle = "",
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(adding = false, formError = "Network error while linking this account. Check your connection and retry.") }
            }
        }
    }

    fun remove(account: LinkedAccountRow) {
        if (_state.value.removingId != null) return
        _state.update { it.copy(removingId = account.id, rowError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).removeLinkedAccount(account.id)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update {
                        it.copy(removingId = null, needsAuth = true, rowError = account.id to "Your session ended — sign in to manage linked accounts.")
                    }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(removingId = null, rowError = account.id to "Removing this account failed (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val body = response.body()
                if (body?.success != true) {
                    _state.update { it.copy(removingId = null, rowError = account.id to (body?.error ?: "Removing this account failed.")) }
                    return@launch
                }
                _state.update { it.copy(removingId = null, accounts = body.data?.accounts ?: emptyList()) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(removingId = null, rowError = account.id to "Network error while removing this account. Check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LinkedAccountsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: LinkedAccountsViewModel = viewModel(key = "native-linked-accounts") {
        LinkedAccountsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Linked Accounts", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
                    title = "Sign in to manage linked accounts",
                    message = "Linked contact accounts are stored on your Zylod account.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your linked accounts…", fontSize = 12.sp)
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
                AccountSettingsSection("Your Linked Accounts") {
                    if (state.accounts.isEmpty()) {
                        Text(
                            "No accounts linked yet — add one below so suppliers can reach you off-marketplace.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    for (account in state.accounts) {
                        val meta = vm.providers.firstOrNull { it.first == account.provider }
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(meta?.second ?: account.provider, fontSize = 12.sp, fontWeight = FontWeight.Black)
                                    Text(account.handle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (state.removingId == account.id) {
                                    CircularProgressIndicator(Modifier.height(16.dp).padding(0.dp), strokeWidth = 2.dp)
                                } else {
                                    IconButton(onClick = { vm.remove(account) }) {
                                        Icon(Icons.Outlined.Delete, contentDescription = "Remove ${meta?.second ?: account.provider}")
                                    }
                                }
                            }
                        }
                        if (state.rowError?.first == account.id) {
                            Text(state.rowError?.second ?: "", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                AccountSettingsSection("Link a New Account") {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        for ((value, label, _) in vm.providers) {
                            val selected = state.provider == value
                            Surface(
                                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                                color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                onClick = { vm.setProvider(value) },
                                modifier = Modifier.weight(1f),
                            ) {
                                Text(
                                    label,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    val placeholder = vm.providers.firstOrNull { it.first == state.provider }?.third ?: ""
                    OutlinedTextField(
                        value = state.handle,
                        onValueChange = { vm.setHandle(it) },
                        label = { Text("Handle or number") },
                        placeholder = { Text(placeholder) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (state.formError != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(state.formError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(10.dp))
                    Button(onClick = { vm.add() }, enabled = !state.adding, modifier = Modifier.fillMaxWidth()) {
                        if (state.adding) {
                            CircularProgressIndicator(Modifier.height(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                            Text("  Linking…", fontSize = 12.sp)
                        } else {
                            Text("Link account", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
