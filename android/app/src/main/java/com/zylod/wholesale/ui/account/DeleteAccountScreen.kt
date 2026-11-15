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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t303 — Delete Account (delete-account-page.tsx port, real wire):
 * GET api/profile/account shows the real orders/products counts (honest
 * dashes when the summary is unavailable — never a fabricated 0), and
 * DELETE api/profile/account with body { confirmation: "DELETE", reason }
 * soft-deletes + revokes sessions. The typed "DELETE" confirmation is
 * enforced locally exactly like the web. On success the caller signs the
 * user out and returns to the welcome gate (handled by the screen callback).
 */
data class DeleteAccountUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val loadError: String? = null,
    val ordersCount: Int? = null,
    val productsCount: Int? = null,
    val deleting: Boolean = false,
    val deleteError: String? = null,
    val deleted: Boolean = false,
)

class DeleteAccountViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(DeleteAccountUiState())
    val state: StateFlow<DeleteAccountUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        _state.update { it.copy(loading = true, loadError = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base).accountSummary()
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    // Web behavior: the summary shows honest dashes on failure.
                    _state.update { it.copy(loading = false, loadError = null) }
                    return@launch
                }
                val d = response.body()?.data
                _state.update {
                    it.copy(loading = false, ordersCount = d?.ordersCount, productsCount = d?.productsCount)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                // Graceful — summary is best-effort; the page still renders.
                _state.update { it.copy(loading = false) }
            }
        }
    }

    /** @return null on success (caller signs out), else the verbatim error. */
    fun deleteAccount(confirmation: String, reason: String, onDone: (String?) -> Unit) {
        if (_state.value.deleting) return
        if (confirmation != "DELETE") {
            onDone("Please type DELETE exactly in uppercase to confirm.")
            return
        }
        _state.update { it.copy(deleting = true, deleteError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.accountSettingsApi(base)
                    .deleteAccount(AccountDeleteRequest(confirmation = confirmation, reason = reason))
                if (response.isSuccessful) {
                    _state.update { it.copy(deleting = false, deleted = true) }
                    onDone(null)
                } else {
                    val message = response.body()?.error
                        ?: "Failed to terminate account. Please contact support."
                    _state.update { it.copy(deleting = false, deleteError = message) }
                    onDone(message)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(deleting = false, deleteError = "Network error — try again.") }
                onDone("Network error — try again.")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeleteAccountScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    onDeleted: () -> Unit,
) {
    val context = LocalContext.current
    val vm: DeleteAccountViewModel = viewModel(key = "native-delete-account") {
        DeleteAccountViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    var confirmText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Delete Account", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
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
                    title = "Sign in to close your account",
                    message = "Account termination applies to your signed-in account. Sign in with the account you want to delete.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.loading -> AccountSettingsWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Checking your account…", fontSize = 12.sp)
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                AccountSettingsSection("What Happens Next") {
                    Text(
                        "Your account is marked for deletion and every active session is revoked immediately. Your order history is retained only as long as legally required.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Orders on this account: ${state.ordersCount?.toString() ?: "—"}\n" +
                            "Storefront products: ${state.productsCount?.toString() ?: "—"}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                AccountSettingsSection("Confirm Account Termination") {
                    OutlinedTextField(
                        value = confirmText,
                        onValueChange = { confirmText = it },
                        label = { Text("Type DELETE to confirm") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Reason (optional)") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    val error = localError ?: state.deleteError
                    if (error != null) {
                        Spacer(Modifier.height(8.dp))
                        Text(error, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(12.dp))
                    Button(
                        onClick = {
                            vm.deleteAccount(confirmText, reason) { err ->
                                if (err == null) {
                                    onDeleted()
                                } else {
                                    localError = err
                                }
                            }
                        },
                        enabled = !state.deleting,
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (state.deleting) {
                            CircularProgressIndicator(Modifier.height(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onError)
                            Text("  Terminating…", fontSize = 12.sp)
                        } else {
                            Text("Permanently close this account", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(onClick = onBack ?: {}, modifier = Modifier.fillMaxWidth()) {
                        Text("Cancel", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
