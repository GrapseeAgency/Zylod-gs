package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.TwoFactorSetupRequest
import com.zylod.wholesale.data.api.TwoFactorVerifyRequest
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t280 — 2FA ENROLLMENT (two-factor-auth-page port, enrollment flow).
 *
 * The login CHALLENGE already existed (ui/auth/TwoFactorAuthScreen on the
 * NavHost two-factor/{userId} route), but the setup side — POST
 * api/auth/2fa/setup (secret + otpauth URI), the QR + manual-key step, then
 * verify and the backup-codes hop — existed NOWHERE natively: the pageId
 * "two-factor-auth" was a curated stub, so an account-settings user could
 * never turn 2FA on from the app.
 *
 * Flow (web parity): method select → setup (QR + manual key + copy) →
 * 6-digit verify → backup-codes. The verify response carries a fresh session
 * token; enrollment (already signed in) deliberately KEEPS the current
 * session (the web ignores the new token on this flow too).
 */
enum class TwoFactorStep { SELECT, SETUP, VERIFY, DONE }

data class TwoFactorSetupUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val step: TwoFactorStep = TwoFactorStep.SELECT,
    /** "authenticator" (QR) or "sms". */
    val method: String = "authenticator",
    val hasPhone: Boolean = false,
    // setup response (authenticator)
    val secret: String? = null,
    val otpauth: String? = null,
    val accountName: String? = null,
    // setup response (sms) — dev servers return debug
    val smsSent: Boolean = false,
    val debugCode: String? = null,
    // verify
    val code: String = "",
    val submitting: Boolean = false,
    val verifyError: String? = null,
    val suspended: com.zylod.wholesale.data.api.SuspensionDto? = null,
    /** Set on success — the screen hops to backup-codes. */
    val enabledTick: Int = 0,
)

class TwoFactorSetupViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(TwoFactorSetupUiState())
    val state: StateFlow<TwoFactorSetupUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        // Signed-in requirement + phone availability (the SMS card's gate).
        val seed = SessionManager.userJson()?.let { raw ->
            runCatching {
                ApiClient.json.decodeFromString(
                    com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                    raw,
                )
            }.getOrNull()
        }
        if (seed == null) {
            _state.update { it.copy(loading = false, needsAuth = true) }
        } else {
            _state.update { it.copy(loading = false, hasPhone = !seed.phone.isNullOrBlank()) }
        }
    }

    fun selectMethod(method: String) = _state.update { it.copy(method = method) }

    /** POST api/auth/2fa/setup { userId, method } — self-check 403 safe. */
    fun startSetup() {
        val s = _state.value
        if (s.needsAuth) return
        val userId = currentUserId() ?: run {
            _state.update { it.copy(needsAuth = true) }
            return
        }
        _state.update { it.copy(error = null) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.profileSettingsApi(base)
                    .twoFactorSetup(TwoFactorSetupRequest(userId = userId, method = s.method))
                if (response.code() == 401) {
                    _state.update { it.copy(needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    val err = com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                    _state.update { it.copy(error = err.error ?: "Setup failed (HTTP ${response.code()}) — try again") }
                    return@launch
                }
                val data = response.body() ?: return@launch
                if (!data.success) {
                    _state.update { it.copy(error = data.error ?: "Setup failed — try again") }
                    return@launch
                }
                _state.update {
                    it.copy(
                        step = TwoFactorStep.SETUP,
                        secret = data.secret,
                        otpauth = data.otpauth,
                        accountName = data.accountName,
                        smsSent = s.method == "sms",
                        debugCode = data.debug,
                        error = null,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(error = "Network error — please check your connection and try again.") }
            }
        }
    }

    fun advanceToVerify() = _state.update { it.copy(step = TwoFactorStep.VERIFY, verifyError = null) }

    fun setCode(value: String) {
        val cleaned = value.filter(Char::isDigit).take(6)
        _state.update { it.copy(code = cleaned, verifyError = null) }
    }

    /** POST api/auth/2fa/verify — success flips 2FA on and hops to codes. */
    fun verify() {
        val s = _state.value
        if (s.submitting) return
        if (s.code.length < 6) {
            _state.update { it.copy(verifyError = "Please enter all 6 digits") }
            return
        }
        val userId = currentUserId() ?: run {
            _state.update { it.copy(needsAuth = true) }
            return
        }
        _state.update { it.copy(submitting = true, verifyError = null) }
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.profileSettingsApi(base)
                    .twoFactorVerify(
                        TwoFactorVerifyRequest(userId = userId, code = s.code, method = s.method),
                    )
                val err = if (!response.isSuccessful) {
                    com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                } else {
                    null
                }
                if (err?.code == "ACCOUNT_SUSPENDED") {
                    _state.update { it.copy(submitting = false, suspended = err.suspension) }
                    return@launch
                }
                val data = response.body()
                if (!response.isSuccessful || data?.success != true) {
                    _state.update {
                        it.copy(
                            submitting = false,
                            verifyError = err?.error ?: data?.error ?: "Invalid verification code",
                        )
                    }
                    return@launch
                }
                // Enrollment keeps the CURRENT session (web parity — the fresh
                // token in the response is only consumed by the login flow).
                _state.update {
                    it.copy(submitting = false, step = TwoFactorStep.DONE, enabledTick = it.enabledTick + 1)
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(submitting = false, verifyError = "Network error. Please check your connection and try again.") }
            }
        }
    }

    /** SMS resend — re-runs setup (server re-issues a 5-minute code). */
    fun resendSms() {
        _state.update { it.copy(step = TwoFactorStep.SELECT, smsSent = false, debugCode = null) }
        startSetup()
    }

    private fun currentUserId(): String? = SessionManager.userJson()?.let { raw ->
        runCatching {
            ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
        }.getOrNull()?.id?.takeIf(String::isNotBlank)
    }
}
