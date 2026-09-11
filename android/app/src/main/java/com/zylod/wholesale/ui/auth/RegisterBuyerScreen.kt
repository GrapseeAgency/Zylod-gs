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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.zylod.wholesale.data.api.OtpSendRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.session.PendingRegistration
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
 * Register buyer — port of src/components/pages/register-buyer-page.tsx
 * (spec §3.4): one form (fullName, businessName?, phone-or-email toggle,
 * password) → POST /api/auth/otp/send purpose=register → pending payload is
 * held in PendingRegistration → otp-verification{flow=register} completes the
 * registration and signs the user in.
 */
data class RegisterBuyerUiState(
    val sending: Boolean = false,
    val error: String? = null,
    val otpSent: Boolean = false,
    val devCode: String = "", // passed to the OTP screen's send flow only, never shown
)

class RegisterBuyerViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RegisterBuyerUiState())
    val state: StateFlow<RegisterBuyerUiState> = _state

    private var baseUrl: String? = null

    fun sendOtp(fullName: String, businessName: String, phone: String, email: String, password: String, usePhone: Boolean) {
        val validation = validate(fullName, businessName, phone, email, password, usePhone)
        if (validation != null) {
            _state.update { it.copy(error = validation) }
            return
        }
        val target = if (usePhone) phone.trim() else email.trim().lowercase()
        viewModelScope.launch {
            _state.update { it.copy(sending = true, error = null) }
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val api: AuthApi = ApiClient.authApi(base)
                val response = api.otpSend(OtpSendRequest(phoneOrEmail = target, purpose = "register"))
                if (!response.isSuccessful) {
                    val message = parseErrorBody(response.errorBody()).error ?: "Failed to send OTP"
                    _state.update {
                        it.copy(
                            sending = false,
                            error = if (message == "User already exists") "An account with this contact already exists — try logging in." else message,
                        )
                    }
                    return@launch
                }
                val body = response.body()
                PendingRegistration.set(
                    PendingRegistration.Payload(
                        userType = "buyer",
                        fullName = fullName.trim(),
                        businessName = businessName.trim().takeIf(String::isNotBlank),
                        email = if (usePhone) null else target,
                        phone = if (usePhone) target else null,
                        password = password,
                    ),
                )
                _state.update { it.copy(sending = false, otpSent = true, devCode = body?.devCode ?: body?.otpCode.orEmpty()) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(sending = false, error = "An unexpected error occurred. Please try again.") }
            }
        }
    }

    fun consumeOtpSent() {
        _state.update { it.copy(otpSent = false) }
    }

    private fun validate(fullName: String, businessName: String, phone: String, email: String, password: String, usePhone: Boolean): String? {
        if (fullName.isBlank()) return "Please enter your full name"
        if (usePhone && phone.isBlank()) return "Please enter your phone number"
        if (!usePhone && email.isBlank()) return "Please enter your email address"
        if (usePhone && phone.filter(Char::isDigit).length < 8) return "Please enter a valid phone number"
        if (!usePhone && !email.contains("@")) return "Please enter a valid email address"
        if (password.isBlank()) return "Please enter a password"
        if (password.length < 8) return "Password must be at least 8 characters"
        return null
    }
}

private class RegisterBuyerVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = RegisterBuyerViewModel(context) as T
}

@Composable
fun RegisterBuyerScreen(
    onOtpSent: (devCode: String) -> Unit,
    onLogin: () -> Unit,
) {
    val context = LocalContext.current
    val vm: RegisterBuyerViewModel = viewModel(factory = RegisterBuyerVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()

    var fullName by rememberSaveable { mutableStateOf("") }
    var businessName by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var usePhone by rememberSaveable { mutableStateOf(true) }

    LaunchedEffect(state.otpSent) {
        if (state.otpSent) {
            vm.consumeOtpSent()
            onOtpSent(state.devCode)
        }
    }

    ZylodEntrance {
        AuthScaffold(title = "Zylod", onBack = onLogin) {
            Spacer(Modifier.height(16.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.primary) {
                    Icon(
                        Icons.Outlined.Storefront,
                        null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier
                            .padding(14.dp)
                            .size(24.dp),
                    )
                }
                Text("Register as Buyer", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                Text(
                    "Join Zylod to buy products at wholesale prices",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Spacer(Modifier.height(24.dp))

            ZylodTextField(value = fullName, onValueChange = { fullName = it }, label = "Full Name *", placeholder = "Your full name")
            Spacer(Modifier.height(12.dp))
            ZylodTextField(value = businessName, onValueChange = { businessName = it }, label = "Business Name (Optional)", placeholder = "Your business/shop name")
            Spacer(Modifier.height(12.dp))

            // Phone / Email toggle (register-buyer-page.tsx:192-213)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                ToggleChip("Phone", Icons.Outlined.Phone, usePhone, Modifier.weight(1f)) { usePhone = true }
                ToggleChip("Email", Icons.Outlined.Mail, !usePhone, Modifier.weight(1f)) { usePhone = false }
            }
            Spacer(Modifier.height(12.dp))

            if (usePhone) {
                ZylodTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = "Phone Number *",
                    placeholder = "+880 1700-000000",
                    leadingIcon = Icons.Outlined.Phone,
                    keyboardType = KeyboardType.Phone,
                    supportingText = "We'll send a 6-digit OTP to verify your phone number",
                )
            } else {
                ZylodTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = "Email Address *",
                    placeholder = "you@example.com",
                    leadingIcon = Icons.Outlined.Mail,
                    keyboardType = KeyboardType.Email,
                    supportingText = "We'll send a verification code to your email",
                )
            }
            Spacer(Modifier.height(12.dp))
            ZylodTextField(
                value = password,
                onValueChange = { password = it },
                label = "Password *",
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

            state.error?.let {
                Spacer(Modifier.height(14.dp))
                ErrorBanner(it)
            }

            Spacer(Modifier.height(20.dp))
            ZylodButton(
                text = if (state.sending) "Sending OTP..." else "Send OTP & Continue",
                onClick = { vm.sendOtp(fullName, businessName, phone, email, password, usePhone) },
                loading = state.sending,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
                Text("Already have an account? ", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "Log In",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.clickable(onClick = onLogin),
                )
            }
        }
    }
}

@Composable
private fun ToggleChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Row(
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(vertical = 10.dp),
        ) {
            Icon(
                icon,
                null,
                tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.size(6.dp))
            Text(
                label,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
