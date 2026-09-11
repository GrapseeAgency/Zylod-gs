package com.zylod.wholesale.ui.auth

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AuthApi
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SuspensionDto
import com.zylod.wholesale.data.api.TwoFactorVerifyRequest
import com.zylod.wholesale.data.api.TwoFactorVerifyResponse
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.api.toUserProfileSeed
import com.zylod.wholesale.data.session.ProfileHydrator
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.OtpInputBox
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

/**
 * Two-factor authentication (spec §3.7) — completes the withheld login:
 * POST /api/auth/2fa/verify {userId, code, method:'authenticator'} →
 * {token, user} → session → home. Wrong-code errors surface inline; the
 * ACCOUNT_SUSPENDED branch routes to the suspended screen; cancel returns to
 * login (web two-factor-auth-page.tsx:158-228).
 */
data class TwoFactorUiState(
    val submitting: Boolean = false,
    val error: String? = null,
    val loggedIn: Boolean = false,
    val suspended: SuspensionDto? = null,
)

class TwoFactorViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(TwoFactorUiState())
    val state: StateFlow<TwoFactorUiState> = _state

    private var baseUrl: String? = null

    fun consumeLoggedIn() {
        _state.update { it.copy(loggedIn = false) }
    }

    fun consumeSuspended() {
        _state.update { it.copy(suspended = null) }
    }

    fun verify(userId: String, code: String) {
        if (code.length < 6) {
            _state.update { it.copy(error = "Please enter all 6 digits") }
            return
        }
        if (userId.isBlank()) {
            _state.update { it.copy(error = "Missing user context. Please restart the flow.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api: AuthApi = ApiClient.authApi(base)
                val response = api.twoFactorVerify(
                    TwoFactorVerifyRequest(userId = userId, code = code, method = "authenticator"),
                )
                if (!response.isSuccessful) {
                    val err = parseErrorBody(response.errorBody())
                    if (err.code == "ACCOUNT_SUSPENDED") {
                        _state.update { it.copy(submitting = false, suspended = err.suspension) }
                        return@launch
                    }
                    _state.update { it.copy(submitting = false, error = err.error ?: "Verification failed. Please try again.") }
                    return@launch
                }
                val data: TwoFactorVerifyResponse = response.body() ?: TwoFactorVerifyResponse()
                val user = data.user
                val token = data.token
                if (user != null && token != null) {
                    SessionManager.setSession(
                        token,
                        ApiClient.json.encodeToString(UserProfileSeed.serializer(), user.toUserProfileSeed()),
                    )
                    ProfileHydrator.refresh(base)
                    _state.update { it.copy(submitting = false, loggedIn = true) }
                } else {
                    _state.update { it.copy(submitting = false, error = "Sign-in could not be completed. Please try again.") }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(submitting = false, error = "Network error. Please check your connection and try again.") }
            }
        }
    }
}

private class TwoFactorVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = TwoFactorViewModel(context) as T
}

@Composable
fun TwoFactorAuthScreen(
    userId: String,
    onAuthenticated: () -> Unit,
    onSuspended: (reason: String, reference: String, suspendedAt: String) -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current
    val vm: TwoFactorViewModel = viewModel(factory = TwoFactorVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()

    var otp by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.loggedIn) { if (state.loggedIn) onAuthenticated() }
    LaunchedEffect(state.suspended) {
        state.suspended?.let {
            vm.consumeSuspended()
            onSuspended(it.reason.orEmpty(), it.reference.orEmpty(), it.suspendedAt.orEmpty())
        }
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = onCancel) {
            Spacer(Modifier.height(24.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                androidx.compose.material3.Surface(
                    shape = androidx.compose.foundation.shape.CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Icon(
                        Icons.Outlined.AdminPanelSettings,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .padding(28.dp)
                            .size(40.dp),
                    )
                }
                Text(
                    "Two-Factor Authentication",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 18.dp),
                )
                Text(
                    "Enter the 6-digit code from your authenticator app to finish signing in.",
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            Spacer(Modifier.height(28.dp))
            OtpInputBox(
                value = otp,
                onValueChange = { otp = it },
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )

            state.error?.let {
                Spacer(Modifier.height(16.dp))
                ErrorBanner(it)
            }

            Spacer(Modifier.height(24.dp))
            ZylodButton(
                text = if (state.submitting) "Verifying..." else "Verify & Sign In",
                onClick = { vm.verify(userId, otp) },
                enabled = otp.length == 6,
                loading = state.submitting,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Outlined.Shield, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = onCancel) {
                    Text("Cancel and return to login", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
