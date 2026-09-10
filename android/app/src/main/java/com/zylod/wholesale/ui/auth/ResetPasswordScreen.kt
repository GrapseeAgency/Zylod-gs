package com.zylod.wholesale.ui.auth

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AuthApi
import com.zylod.wholesale.data.api.ResetPasswordRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import com.zylod.wholesale.ui.components.ZylodTextField
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Reset password (spec §3.6) — POST /api/auth/reset-password
 * {token, password, confirmPassword} with the 15-minute resetToken minted by
 * the reset_password OTP verify. Expired/invalid-token errors surface inline.
 */
data class ResetPasswordUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

class ResetPasswordViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ResetPasswordUiState())
    val state: StateFlow<ResetPasswordUiState> = _state

    private var baseUrl: String? = null

    fun submit(token: String, password: String, confirmPassword: String) {
        if (token.isBlank()) {
            _state.update { it.copy(error = "Invalid or missing reset token. Please request a new password reset link.") }
            return
        }
        if (password.isBlank() || confirmPassword.isBlank()) {
            _state.update { it.copy(error = "All fields are required") }
            return
        }
        if (password != confirmPassword) {
            _state.update { it.copy(error = "Passwords do not match") }
            return
        }
        if (password.length < 8) {
            _state.update { it.copy(error = "Password must be at least 8 characters") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api: AuthApi = ApiClient.authApi(base)
                val response = api.resetPassword(
                    ResetPasswordRequest(token = token, password = password, confirmPassword = confirmPassword),
                )
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, error = parseErrorBody(response.errorBody()).error ?: "Invalid or expired reset token")
                    }
                    return@launch
                }
                _state.update { it.copy(loading = false, success = true) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error. Please check your connection and try again.") }
            }
        }
    }

    fun consumeSuccess() {
        _state.update { it.copy(success = false) }
    }
}

private class ResetVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = ResetPasswordViewModel(context) as T
}

@Composable
fun ResetPasswordScreen(
    resetToken: String,
    onSuccess: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val vm: ResetPasswordViewModel = viewModel(factory = ResetVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(state.success) {
        if (state.success) {
            snackbar.showSnackbar("Password updated successfully")
            vm.consumeSuccess()
            onSuccess()
        }
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = onBack, snackbarHostState = snackbar) {
            Spacer(Modifier.height(24.dp))
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .size(56.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                "Reset Password",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .padding(top = 14.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                "Choose a new password for your account (minimum 8 characters).",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(top = 6.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Spacer(Modifier.height(24.dp))

            ZylodTextField(
                value = password,
                onValueChange = { password = it },
                label = "New Password",
                placeholder = "Minimum 8 characters",
                leadingIcon = Icons.Outlined.Lock,
                keyboardType = KeyboardType.Password,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                trailing = {
                    IconButton(onClick = { showPassword = !showPassword }) {
                        Icon(
                            if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                            if (showPassword) "Hide password" else "Show password",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                },
            )
            Spacer(Modifier.height(14.dp))
            ZylodTextField(
                value = confirmPassword,
                onValueChange = { confirmPassword = it },
                label = "Confirm Password",
                placeholder = "Re-enter your password",
                leadingIcon = Icons.Outlined.Lock,
                keyboardType = KeyboardType.Password,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            )

            state.error?.let {
                Spacer(Modifier.height(14.dp))
                ErrorBanner(it)
            }

            Spacer(Modifier.height(20.dp))
            ZylodButton(
                text = if (state.loading) "Updating..." else "Update Password",
                onClick = { vm.submit(resetToken, password, confirmPassword) },
                loading = state.loading,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
