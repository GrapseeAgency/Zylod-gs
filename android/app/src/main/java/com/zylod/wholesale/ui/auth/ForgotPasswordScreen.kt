package com.zylod.wholesale.ui.auth

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AuthApi
import com.zylod.wholesale.data.api.ForgotPasswordRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import com.zylod.wholesale.ui.components.ZylodTextField
import com.zylod.wholesale.util.MathCaptcha
import com.zylod.wholesale.util.generateMathCaptcha
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Forgot password (spec §3.6) — POST /api/auth/forgot-password {email}, then
 * continue to otp-verification with purpose reset_password (OTP verify mints a
 * 15-minute resetToken). Includes the web's client-side throttle: 3 requests
 * per hour (forgot-password-page.tsx:26-75) and its always-on math CAPTCHA.
 */
data class ForgotPasswordUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
    val proceed: Boolean = false,
    val attemptsRemaining: Int = 3,
    val captcha: MathCaptcha = generateMathCaptcha(),
)

class ForgotPasswordViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ForgotPasswordUiState())
    val state: StateFlow<ForgotPasswordUiState> = _state

    private var baseUrl: String? = null

    fun refreshCaptcha() {
        _state.update { it.copy(captcha = generateMathCaptcha()) }
    }

    fun submit(email: String, captchaAnswer: String) {
        if (email.isBlank() || !email.contains("@") || !email.contains(".")) {
            _state.update { it.copy(error = "Please enter a valid email address") }
            return
        }
        if (getAttempts(appContext) >= 3) {
            _state.update { it.copy(error = "Too many reset requests. Please try again later.") }
            return
        }
        val parsed = captchaAnswer.trim().toIntOrNull()
        when {
            parsed == null -> {
                _state.update { it.copy(error = "Please solve the math verification") }
                return
            }
            parsed != _state.value.captcha.answer -> {
                _state.update { it.copy(error = "Incorrect answer. Please try the new question.", captcha = generateMathCaptcha()) }
                return
            }
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api: AuthApi = ApiClient.authApi(base)
                val response = api.forgotPassword(ForgotPasswordRequest(email = email.trim().lowercase()))
                if (!response.isSuccessful) {
                    val attempts = recordAttempt(appContext)
                    _state.update {
                        it.copy(
                            loading = false,
                            attemptsRemaining = (3 - attempts).coerceAtLeast(0),
                            error = parseErrorBody(response.errorBody()).error ?: "Something went wrong. Please try again.",
                        )
                    }
                    return@launch
                }
                _state.update {
                    it.copy(
                        loading = false,
                        successMessage = response.body()?.message ?: "If an account exists with this email, a reset link has been sent.",
                        proceed = true,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error. Please check your connection and try again.") }
            }
        }
    }

    fun consumeProceed() {
        _state.update { it.copy(proceed = false) }
    }

    private fun getAttempts(context: Context): Int =
        context.getSharedPreferences("zylod_forgot_ratelimit", Context.MODE_PRIVATE)
            .let { prefs ->
                val ts = prefs.getLong("timestamp", 0L)
                if (System.currentTimeMillis() - ts > 3_600_000L) 0 else prefs.getInt("count", 0)
            }

    private fun recordAttempt(context: Context): Int {
        val prefs = context.getSharedPreferences("zylod_forgot_ratelimit", Context.MODE_PRIVATE)
        val count = getAttempts(context) + 1
        prefs.edit().putInt("count", count).putLong("timestamp", System.currentTimeMillis()).apply()
        return count
    }
}

private class ForgotVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = ForgotPasswordViewModel(context) as T
}

@Composable
fun ForgotPasswordScreen(
    onProceedToOtp: (email: String) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val vm: ForgotPasswordViewModel = viewModel(factory = ForgotVmFactory(context.applicationContext))
    val state by vm.state.collectAsStateWithLifecycle()

    var email by rememberSaveable { mutableStateOf("") }
    var captchaAnswer by rememberSaveable { mutableStateOf("") }

    // Web continues the flow automatically 1.5 s after success (L164-170).
    androidx.compose.runtime.LaunchedEffect(state.proceed) {
        if (state.proceed) {
            vm.consumeProceed()
            delay(1200)
            onProceedToOtp(email.trim().lowercase())
        }
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = onBack) {
            Spacer(Modifier.height(24.dp))
            Icon(
                Icons.Outlined.Mail,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .size(56.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                "Forgot Password",
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .padding(top = 14.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Text(
                "Enter your account email and we'll send a verification code to reset your password.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(top = 6.dp)
                    .align(Alignment.CenterHorizontally),
            )
            Spacer(Modifier.height(24.dp))

            ZylodTextField(
                value = email,
                onValueChange = { email = it },
                label = "Email Address",
                placeholder = "you@example.com",
                leadingIcon = Icons.Outlined.Mail,
                keyboardType = KeyboardType.Email,
            )
            Spacer(Modifier.height(14.dp))

            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                shape = MaterialTheme.shapes.small,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Icon(Icons.Outlined.Security, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(state.captcha.question, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.width(8.dp))
                    Text("=", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(8.dp))
                    ZylodTextField(
                        value = captchaAnswer,
                        onValueChange = { captchaAnswer = it.filter(Char::isDigit) },
                        label = "Answer",
                        modifier = Modifier.width(130.dp),
                        keyboardType = KeyboardType.Number,
                    )
                    Spacer(Modifier.width(6.dp))
                    TextButton(onClick = { vm.refreshCaptcha(); captchaAnswer = "" }) { Text("Refresh", fontSize = 11.sp) }
                }
            }

            state.error?.let {
                Spacer(Modifier.height(14.dp))
                ErrorBanner(it)
            }
            if (state.successMessage != null) {
                Spacer(Modifier.height(14.dp))
                Surface(
                    color = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.success.copy(alpha = 0.08f),
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        state.successMessage.orEmpty(),
                        fontSize = 12.sp,
                        color = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.success,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
            if (state.attemptsRemaining < 3 && state.error != null) {
                Text(
                    "${state.attemptsRemaining} reset request${if (state.attemptsRemaining != 1) "s" else ""} remaining this hour",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            Spacer(Modifier.height(20.dp))
            ZylodButton(
                text = if (state.loading) "Sending..." else "Send Reset Code",
                onClick = { vm.submit(email, captchaAnswer) },
                loading = state.loading,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(16.dp))
            Text(
                "Back to Login",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .clickable(onClick = onBack),
            )
        }
    }
}
