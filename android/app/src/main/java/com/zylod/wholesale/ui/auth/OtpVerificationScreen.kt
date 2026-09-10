package com.zylod.wholesale.ui.auth

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.zylod.wholesale.data.api.AuthUserDto
import com.zylod.wholesale.data.api.OtpSendRequest
import com.zylod.wholesale.data.api.OtpVerifyRequest
import com.zylod.wholesale.data.api.RegisterRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.api.toUserProfileSeed
import com.zylod.wholesale.data.session.ProfileHydrator
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.session.PendingRegistration
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.OtpInputBox
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

/**
 * OTP verification — port of src/components/pages/otp-verification-page.tsx for
 * the three Phase 1 purposes (spec §3.3):
 *  register → verifies the pre-registration OTP then completes
 *             POST /api/auth/register with the pending payload;
 *  login    → {token, user} becomes a real session;
 *  reset    → mints a 15-minute resetToken for reset-password.
 *
 * The resend countdown is the web's fixed 58 s (RESEND_COUNTDOWN, L15).
 * Dev-only otpCode/devCode fields from the API are deliberately NEVER rendered
 * in native UI (release hygiene, spec §5.3).
 */
data class OtpUiState(
    val loading: Boolean = false,
    val resending: Boolean = false,
    val error: String? = null,
    val resendSeconds: Int = 58,
    val completedRegister: Boolean = false,
    val completedLogin: Boolean = false,
    val registerFailed: Boolean = false,
    val resetToken: String? = null,
    val toast: String? = null,
)

class OtpViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(OtpUiState())
    val state: StateFlow<OtpUiState> = _state

    private var baseUrl: String? = null

    private suspend fun api(): AuthApi {
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        return ApiClient.authApi(base)
    }

    fun tickCountdown() {
        val current = _state.value.resendSeconds
        if (current > 0) _state.update { it.copy(resendSeconds = current - 1) }
    }

    fun consumeResetToken() {
        _state.update { it.copy(resetToken = null) }
    }

    fun consumeRegisterFailed() {
        _state.update { it.copy(registerFailed = false) }
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    /** Sends (or re-sends) the OTP for flows that don't arrive with a code. */
    fun sendOtp(target: String, purpose: String) {
        if (target.isBlank()) {
            _state.update { it.copy(error = "Missing verification target. Please restart the flow.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(resending = true, error = null) }
            try {
                val response = api().otpSend(OtpSendRequest(phoneOrEmail = target, purpose = purpose))
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(resending = false, error = parseErrorBody(response.errorBody()).error ?: "Failed to send code")
                    }
                    return@launch
                }
                _state.update { it.copy(resending = false, resendSeconds = 58, error = null) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(resending = false, error = "Network error. Please try again.") }
            }
        }
    }

    fun verify(target: String, purpose: String, code: String) {
        if (code.length < 6) {
            _state.update { it.copy(error = "Please enter all 6 digits") }
            return
        }
        if (target.isBlank()) {
            _state.update { it.copy(error = "Missing verification target. Please restart the flow.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val response = api().otpVerify(OtpVerifyRequest(phoneOrEmail = target, code = code, purpose = purpose))
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, error = parseErrorBody(response.errorBody()).error ?: "Verification failed. Please try again.")
                    }
                    return@launch
                }
                val data = response.body()
                when (purpose) {
                    "register" -> completeRegistration(data)
                    "reset_password" -> {
                        val token = data?.resetToken
                        if (token.isNullOrBlank()) {
                            _state.update { it.copy(loading = false, error = "Reset session expired. Please request a new link.") }
                        } else {
                            _state.update { it.copy(loading = false, resetToken = token) }
                        }
                    }
                    else -> {
                        // login purpose: {token, user} is a real session.
                        val token = data?.token
                        val user = data?.user
                        if (token != null && user?.id != null) {
                            val seed = AuthUserDto(
                                id = user.id,
                                userType = user.userType,
                                email = user.email,
                                phone = user.phone,
                                authProvider = user.authProvider,
                                accountStatus = user.accountStatus,
                            ).toUserProfileSeed()
                            SessionManager.setSession(token, ApiClient.json.encodeToString(UserProfileSeed.serializer(), seed))
                            ProfileHydrator.refresh(baseUrl ?: ServerConfig.resolve(appContext))
                            _state.update { it.copy(loading = false, completedLogin = true) }
                        } else {
                            _state.update { it.copy(loading = false, error = "Verification succeeded but the session could not be completed.") }
                        }
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error. Please check your connection and try again.") }
            }
        }
    }

    /** otp-verification-page.tsx:107-178 — register purpose completes the account. */
    private suspend fun completeRegistration(data: com.zylod.wholesale.data.api.OtpVerifyResponse?) {
        val pending = PendingRegistration.get()
        if (pending == null) {
            _state.update { it.copy(loading = false, registerFailed = true) }
            return
        }
        val response = api().register(
            RegisterRequest(
                userType = pending.userType,
                authProvider = "phone_otp",
                email = pending.email,
                phone = pending.phone,
                password = pending.password,
                fullName = pending.fullName,
                businessName = pending.businessName,
                // Mark the channel that was just verified (web L122-123).
                isPhoneVerified = pending.email.isNullOrBlank(),
                isEmailVerified = !pending.email.isNullOrBlank(),
            ),
        )
        if (!response.isSuccessful) {
            PendingRegistration.clear()
            _state.update {
                it.copy(
                    loading = false,
                    registerFailed = true,
                    toast = parseErrorBody(response.errorBody()).error ?: "Account creation failed",
                )
            }
            return
        }
        val regData = response.body()
        PendingRegistration.clear()
        val user = regData?.user
        val token = regData?.token
        if (user != null && token != null) {
            val seed = UserProfileSeed(
                id = user.id,
                userType = user.userType,
                email = user.email,
                phone = user.phone,
                fullName = pending.fullName,
                businessName = pending.businessName,
                avatarUrl = null,
                isProfileComplete = false,
                profileCompletionPct = 20,
            )
            SessionManager.setSession(token, ApiClient.json.encodeToString(UserProfileSeed.serializer(), seed))
            ProfileHydrator.refresh(baseUrl ?: ServerConfig.resolve(appContext))
        }
        _state.update { it.copy(loading = false, completedRegister = true, toast = "Account created successfully!") }
    }
}

private class OtpVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = OtpViewModel(context) as T
}

@Composable
fun OtpVerificationScreen(
    flow: String, // register | login | reset
    target: String,
    onCompletedRegister: () -> Unit,
    onRegisterFailed: () -> Unit,
    onCompletedLogin: () -> Unit,
    onResetToken: (String) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val vm: OtpViewModel = viewModel(factory = OtpVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    val purpose = when (flow) {
        "register" -> "register"
        "reset" -> "reset_password"
        else -> "login"
    }
    var otp by rememberSaveable { mutableStateOf("") }
    var hasAutoSubmitted by remember { mutableStateOf(false) }

    // Flows that did not already send a code (reset, login) send on entry —
    // register arrives after RegisterBuyer already sent it (web parity).
    LaunchedEffect(flow, target) {
        if (flow != "register") vm.sendOtp(target, purpose)
    }
    // Resend countdown.
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            vm.tickCountdown()
        }
    }
    LaunchedEffect(state.completedRegister) { if (state.completedRegister) onCompletedRegister() }
    LaunchedEffect(state.completedLogin) { if (state.completedLogin) onCompletedLogin() }
    LaunchedEffect(state.resetToken) { state.resetToken?.let { vm.consumeResetToken(); onResetToken(it) } }
    LaunchedEffect(state.registerFailed) { if (state.registerFailed) { vm.consumeRegisterFailed(); onRegisterFailed() } }
    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }

    val icon: ImageVector = when (purpose) {
        "register", "login" -> Icons.Outlined.Smartphone
        else -> Icons.Outlined.Mail
    }
    val purposeLabel = when (purpose) {
        "login" -> "to sign in to your account"
        "register" -> "to complete your registration"
        else -> "to reset your password"
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = onBack, snackbarHostState = snackbar) {
            Spacer(Modifier.height(24.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                    Icon(
                        icon,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .padding(28.dp)
                            .size(40.dp),
                    )
                }
                Text(
                    "Verify Your Identity",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 18.dp),
                )
                Text(
                    "We've sent a code $purposeLabel to ${maskTarget(target)}. Please enter the 6-digit code below to continue.",
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
                onValueChange = {
                    otp = it
                    // Auto-verify when all 6 digits are entered (web 400 ms delay).
                    if (it.length == 6 && !hasAutoSubmitted && !state.loading) {
                        hasAutoSubmitted = true
                        vm.verify(target, purpose, it)
                    }
                },
                enabled = !state.loading,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )

            state.error?.let {
                Spacer(Modifier.height(16.dp))
                ErrorBanner(it)
            }

            Spacer(Modifier.height(20.dp))
            Row(
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Didn't receive the code? ", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (state.resendSeconds > 0) {
                    Text(
                        "Resend in ${formatSeconds(state.resendSeconds)}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                } else {
                    Text(
                        if (state.resending) "Sending..." else "Resend Code",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { vm.sendOtp(target, purpose) },
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
            ZylodButton(
                text = if (state.loading) "Verifying..." else "Verify & Continue",
                onClick = {
                    hasAutoSubmitted = true
                    vm.verify(target, purpose, otp)
                },
                enabled = otp.length == 6,
                loading = state.loading,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(28.dp))
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Outlined.Shield, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(10.dp))
                Text(
                    "Zylod will never ask for your account password or other sensitive details via SMS or email.",
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun formatSeconds(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return String.format("%02d:%02d", m, s)
}

/** maskTarget — otp-verification-page.tsx:20-28, verbatim. */
private fun maskTarget(target: String): String {
    if (target.isBlank()) return "your registered contact"
    return if (target.contains("@")) {
        val parts = target.split("@")
        val name = parts.first()
        val shown = name.take(2)
        "$shown${"•".repeat(maxOf(name.length - 2, 2))}@${parts.drop(1).joinToString("@")}"
    } else {
        target.take(6) + "•".repeat(maxOf(target.length - 10, 3)) + target.takeLast(4)
    }
}
