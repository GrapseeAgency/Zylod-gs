package com.zylod.wholesale.ui.auth

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.Color
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
import com.zylod.wholesale.data.api.AuthErrorDto
import com.zylod.wholesale.data.api.AuthUserDto
import com.zylod.wholesale.data.api.FacebookAuthRequest
import com.zylod.wholesale.data.api.GoogleAuthRequest
import com.zylod.wholesale.data.api.LoginRequest
import com.zylod.wholesale.data.api.LoginResponse
import com.zylod.wholesale.data.api.SuspensionDto
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.toUserProfileSeed
import com.zylod.wholesale.data.session.ProfileHydrator
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodButtonVariant
import com.zylod.wholesale.ui.components.ZylodEntrance
import com.zylod.wholesale.ui.components.ZylodTextField
import com.zylod.wholesale.util.AuthRateLimit
import com.zylod.wholesale.util.MathCaptcha
import com.zylod.wholesale.util.generateMathCaptcha
import java.security.MessageDigest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

/**
 * Login — faithful port of src/components/pages/login-page.tsx against the real
 * POST /api/auth/login branches (spec §3.2):
 *  OK → session + home · requires2FA → two-factor-auth/{userId} ·
 *  401 INVALID_CREDENTIALS (attemptsRemaining/accountLocked + client rate
 *  limit + math captcha after 2 failures) · 403 ACCOUNT_SUSPENDED →
 *  account-suspended · 429 RATE_LIMITED (lockedUntil countdown).
 * Social buttons reproduce the web's simulated consent flow (social-auth.ts)
 * through a native dialog, then POST /api/auth/google|facebook.
 */
data class LoginUiState(
    val loading: Boolean = false,
    val socialLoading: String? = null,
    val error: String? = null,
    val failedAttempts: Int = 0,
    val showCaptcha: Boolean = false,
    val captcha: MathCaptcha = generateMathCaptcha(),
    val rateLimited: Boolean = false,
    val lockedRemainingMs: Long = 0,
    val attemptsRemaining: Int = 5,
    val loggedIn: Boolean = false,
    val twoFactorUserId: String? = null,
    val suspended: SuspensionDto? = null,
    val toast: String? = null,
    val suspendedEmail: String = "",
)

class LoginViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state

    private var baseUrl: String? = null

    init {
        // Rate-limit check on mount (login-page.tsx:121-135).
        val check = AuthRateLimit.check(appContext)
        _state.update {
            it.copy(rateLimited = check.limited, lockedRemainingMs = check.remainingMs, attemptsRemaining = check.attemptsRemaining)
        }
    }

    private suspend fun api(): AuthApi {
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        return ApiClient.authApi(base)
    }

    fun refreshLockout(check: AuthRateLimit.Check) {
        _state.update {
            it.copy(rateLimited = check.limited, lockedRemainingMs = check.remainingMs, attemptsRemaining = check.attemptsRemaining)
        }
    }

    fun refreshCaptcha() {
        _state.update { it.copy(captcha = generateMathCaptcha()) }
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    fun consumeTwoFactor() {
        _state.update { it.copy(twoFactorUserId = null) }
    }

    fun consumeSuspended() {
        _state.update { it.copy(suspended = null) }
    }

    fun submit(emailOrPhone: String, password: String, captchaAnswer: String) {
        if (emailOrPhone.isBlank() || password.isBlank()) {
            _state.update { it.copy(error = "Please enter your email/phone and password") }
            return
        }
        val rl = AuthRateLimit.check(appContext)
        if (rl.limited) {
            _state.update {
                it.copy(rateLimited = true, lockedRemainingMs = rl.remainingMs, error = "Account temporarily locked due to too many failed attempts")
            }
            return
        }
        val s = _state.value
        if (s.showCaptcha) {
            val parsed = captchaAnswer.trim().toIntOrNull()
            when {
                parsed == null -> {
                    _state.update { it.copy(error = "Please solve the math verification") }
                    return
                }
                parsed != s.captcha.answer -> {
                    _state.update {
                        it.copy(error = "Incorrect answer. Please try the new question.", captcha = generateMathCaptcha())
                    }
                    return
                }
            }
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val isEmail = emailOrPhone.contains("@")
                val request = if (isEmail) LoginRequest(email = emailOrPhone.trim(), password = password)
                else LoginRequest(phone = emailOrPhone.trim(), password = password)
                val response = api().login(request)
                if (!response.isSuccessful) {
                    handleAuthFailure(response.code(), parseErrorBody(response.errorBody()))
                    _state.update { it.copy(loading = false) }
                    return@launch
                }
                val data = response.body() ?: LoginResponse()
                AuthRateLimit.reset(appContext)
                if (data.requires2FA && data.userId != null) {
                    _state.update {
                        it.copy(loading = false, toast = "Security verification required — enter your two-factor code to continue.", twoFactorUserId = data.userId)
                    }
                    return@launch
                }
                val user = data.user
                val token = data.token
                if (user != null && token != null) {
                    completeLogin(token, user, "Welcome back! You have been logged in successfully.")
                } else {
                    _state.update { it.copy(loading = false, error = "Login succeeded but no session was returned") }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error. Please check your connection and try again.") }
            }
        }
    }

    /** Simulated consent exchange — social-auth.ts:86-124, mirrored natively. */
    fun submitSocial(provider: String, email: String, name: String) {
        if (!email.contains("@")) {
            _state.update { it.copy(socialLoading = null, error = "Enter the email of your $provider account") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(socialLoading = provider, error = null) }
            try {
                val providerId = deriveProviderId(provider, email)
                val response = if (provider == "google") {
                    api().google(GoogleAuthRequest(googleId = providerId, email = email.trim(), name = name.ifBlank { null }))
                } else {
                    // Facebook id drops the "fb-" prefix (social-auth.ts:95).
                    api().facebook(FacebookAuthRequest(facebookId = providerId.removePrefix("fb-"), email = email.trim(), name = name.ifBlank { null }))
                }
                if (!response.isSuccessful) {
                    val err = parseErrorBody(response.errorBody())
                    if (err.code == "ACCOUNT_SUSPENDED") {
                        _state.update { it.copy(socialLoading = null, suspended = err.suspension, suspendedEmail = email.trim()) }
                        return@launch
                    }
                    _state.update { it.copy(socialLoading = null, error = err.error ?: "Sign-in failed. Please try again.") }
                    return@launch
                }
                val data = response.body() ?: LoginResponse()
                if (data.requires2FA && data.userId != null) {
                    _state.update { it.copy(socialLoading = null, twoFactorUserId = data.userId) }
                    return@launch
                }
                val user = data.user
                val token = data.token
                if (user != null && token != null) {
                    AuthRateLimit.reset(appContext)
                    completeLogin(token, user, "Signed in with ${if (provider == "google") "Google" else "Facebook"}.")
                } else {
                    _state.update { it.copy(socialLoading = null, error = "Sign-in failed. Please try again.") }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(socialLoading = null, error = "Social sign-in failed. Please try again.") }
            }
        }
    }

    private suspend fun completeLogin(token: String, user: AuthUserDto, toast: String) {
        SessionManager.setSession(
            token,
            ApiClient.json.encodeToString(UserProfileSeed.serializer(), user.toUserProfileSeed()),
        )
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        ProfileHydrator.refresh(base)
        _state.update { it.copy(loading = false, socialLoading = null, loggedIn = true, toast = toast) }
    }

    private fun handleAuthFailure(status: Int, err: AuthErrorDto) {
        when (status) {
            401 -> {
                AuthRateLimit.recordFailedAttempt(appContext)
                val rl = AuthRateLimit.check(appContext)
                _state.update {
                    it.copy(
                        failedAttempts = it.failedAttempts + 1,
                        showCaptcha = it.failedAttempts + 1 >= 2,
                        rateLimited = rl.limited,
                        lockedRemainingMs = rl.remainingMs,
                        attemptsRemaining = rl.attemptsRemaining,
                        error = err.error ?: "Invalid email/phone or password",
                    )
                }
                if (rl.limited) {
                    _state.update { it.copy(error = "Too many failed attempts. Account temporarily locked.") }
                }
            }
            403 -> _state.update { it.copy(suspended = err.suspension) }
            404 -> {
                AuthRateLimit.recordFailedAttempt(appContext)
                _state.update { it.copy(error = "No account found with this email/phone") }
            }
            429 -> {
                val lockedUntil = err.lockedUntil ?: (System.currentTimeMillis() + 60_000L)
                _state.update {
                    it.copy(rateLimited = true, lockedRemainingMs = (lockedUntil - System.currentTimeMillis()).coerceAtLeast(0))
                }
            }
            else -> _state.update { it.copy(error = err.error ?: "Something went wrong. Please try again.") }
        }
    }
}

/** Deterministic provider account id — social-auth.ts deriveProviderId (SHA-256). */
private fun deriveProviderId(provider: String, email: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(email.lowercase().toByteArray())
    val hash = digest.joinToString("") { String.format("%02x", it) }
    return "${if (provider == "google") "g" else "fb"}-${hash.take(24)}"
}

private class LoginVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = LoginViewModel(context) as T
}

@Composable
fun LoginScreen(
    onAuthenticated: () -> Unit,
    onTwoFactor: (String) -> Unit,
    onSuspended: (reason: String, reference: String, suspendedAt: String, email: String) -> Unit,
    onForgotPassword: () -> Unit,
    onRegisterBuyer: () -> Unit,
    onRegisterSupplier: () -> Unit,
    onHelp: () -> Unit,
) {
    val context = LocalContext.current
    val vm: LoginViewModel = viewModel(factory = LoginVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    var showSocialDialog by remember { mutableStateOf<String?>(null) }

    var emailOrPhone by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var captchaAnswer by rememberSaveable { mutableStateOf("") }

    // Navigate once on session / 2FA / suspension transitions.
    LaunchedEffect(state.loggedIn) { if (state.loggedIn) onAuthenticated() }
    LaunchedEffect(state.twoFactorUserId) {
        state.twoFactorUserId?.let { vm.consumeTwoFactor(); onTwoFactor(it) }
    }
    LaunchedEffect(state.suspended) {
        state.suspended?.let {
            val email = state.suspendedEmail
            vm.consumeSuspended()
            onSuspended(it.reason.orEmpty(), it.reference.orEmpty(), it.suspendedAt.orEmpty(), email)
        }
    }
    LaunchedEffect(state.toast) {
        state.toast?.let { snackbar.showSnackbar(it); vm.consumeToast() }
    }
    // Lockout countdown tick (web useCountdown).
    LaunchedEffect(state.rateLimited, state.lockedRemainingMs) {
        var remaining = state.lockedRemainingMs
        while (state.rateLimited && remaining > 0) {
            delay(1000)
            remaining = (remaining - 1000).coerceAtLeast(0)
            if (remaining == 0L) vm.refreshLockout(AuthRateLimit.check(context))
        }
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = null, snackbarHostState = snackbar) {
            Spacer(Modifier.height(24.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text("Zylod", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text(
                    "Efficient B2B Sourcing Starts Here",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            Spacer(Modifier.height(28.dp))

            // Buyer / Supplier tabs — visual parity with login-page.tsx:390-429
            // (the web tabs don't change the login endpoint either).
            Row(
                Modifier
                    .fillMaxWidth(0.7f)
                    .align(Alignment.CenterHorizontally),
            ) {
                listOf("Buyer", "Supplier").forEachIndexed { index, label ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                        Text(
                            label,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (index == 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(6.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(2.dp)
                                .background(if (index == 0) MaterialTheme.colorScheme.primary else Color.Transparent),
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))

            ZylodTextField(
                value = emailOrPhone,
                onValueChange = { emailOrPhone = it },
                label = "Email or Phone Number",
                placeholder = "name@company.com",
                leadingIcon = Icons.Outlined.Mail,
                keyboardType = KeyboardType.Email,
                enabled = !state.loading && !state.rateLimited,
            )
            Spacer(Modifier.height(14.dp))
            ZylodTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                placeholder = "Enter your password",
                leadingIcon = Icons.Outlined.Lock,
                keyboardType = KeyboardType.Password,
                enabled = !state.loading && !state.rateLimited,
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

            if (state.rateLimited) {
                Spacer(Modifier.height(14.dp))
                Surface(
                    color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
                    shape = MaterialTheme.shapes.medium,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Security, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("Account Temporarily Locked", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
                            Text(
                                "Too many failed login attempts. Please try again in ${formatCountdown(state.lockedRemainingMs)}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                    }
                }
            }

            state.error?.let {
                Spacer(Modifier.height(14.dp))
                ErrorBanner(it)
            }

            if (state.failedAttempts > 0 && !state.rateLimited) {
                Text(
                    "${state.attemptsRemaining} attempt${if (state.attemptsRemaining != 1) "s" else ""} remaining before lockout",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            // Math CAPTCHA — shown after 2 failed attempts (web parity).
            if (state.showCaptcha && !state.rateLimited) {
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
                        TextButton(onClick = { vm.refreshCaptcha(); captchaAnswer = "" }) {
                            Text("Refresh", fontSize = 11.sp)
                        }
                    }
                }
            }

            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) {
                Text(
                    "Forgot Password?",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable(onClick = onForgotPassword),
                )
            }

            Spacer(Modifier.height(16.dp))
            ZylodButton(
                text = if (state.loading) "Logging in..." else "Login",
                onClick = { vm.submit(emailOrPhone, password, captchaAnswer) },
                enabled = !state.rateLimited,
                loading = state.loading,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(24.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outline)
                Text(
                    "OR CONTINUE WITH",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp),
                )
                HorizontalDivider(Modifier.weight(1f), color = MaterialTheme.colorScheme.outline)
            }

            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                ZylodButton(
                    text = "Google",
                    onClick = { showSocialDialog = "google" },
                    variant = ZylodButtonVariant.OUTLINED,
                    height = 46.dp,
                    loading = state.socialLoading == "google",
                    enabled = state.socialLoading == null,
                    modifier = Modifier.weight(1f),
                )
                ZylodButton(
                    text = "Facebook",
                    onClick = { showSocialDialog = "facebook" },
                    variant = ZylodButtonVariant.OUTLINED,
                    height = 46.dp,
                    loading = state.socialLoading == "facebook",
                    enabled = state.socialLoading == null,
                    modifier = Modifier.weight(1f),
                )
            }

            Spacer(Modifier.height(24.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Row {
                    Text("New to Zylod? ", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        "Register as Buyer",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable(onClick = onRegisterBuyer),
                    )
                }
                Text(
                    "Become a Supplier",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier
                        .padding(top = 4.dp)
                        .clickable(onClick = onRegisterSupplier),
                )
                Text(
                    "Need help logging in?",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .padding(top = 12.dp)
                        .clickable { onHelp() },
                )
            }
        }
    }

    if (showSocialDialog != null) {
        SocialConsentDialog(
            provider = showSocialDialog.orEmpty(),
            onDismiss = { showSocialDialog = null },
            onConfirm = { email, name ->
                val provider = showSocialDialog ?: return@SocialConsentDialog
                showSocialDialog = null
                vm.submitSocial(provider, email, name)
            },
        )
    }
}

private fun formatCountdown(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    return String.format("%02d:%02d", totalSeconds / 60, totalSeconds % 60)
}

@Composable
private fun SocialConsentDialog(
    provider: String,
    onDismiss: () -> Unit,
    onConfirm: (email: String, name: String) -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                if (provider == "google") "Continue with Google" else "Continue with Facebook",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        },
        text = {
            Column {
                Text(
                    "Choose the ${if (provider == "google") "Google" else "Facebook"} account to continue with. " +
                        "This mirrors the web's simulated consent step — the account is created or linked server-side.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))
                ZylodTextField(value = email, onValueChange = { email = it }, label = "Account email", keyboardType = KeyboardType.Email)
                Spacer(Modifier.height(10.dp))
                ZylodTextField(value = name, onValueChange = { name = it }, label = "Display name (optional)")
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(email.trim(), name.trim()) }, enabled = email.contains("@")) {
                Text("Continue", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
        shape = RoundedCornerShape(14.dp),
    )
}
