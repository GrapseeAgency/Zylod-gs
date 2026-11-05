package com.zylod.wholesale.ui.profile

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ProfileMeDto
import com.zylod.wholesale.data.api.ProfileUpdateRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString

/**
 * t279 — REAL edit-profile / business-profile forms.
 *
 * The Profile hub's completion chip ("75%", tappable) routed to `edit-profile`
 * and "Business profile" routed to `business-profile` — both were curated
 * doc pages with no form, while the server exposes the SAME contract the web
 * edit-profile page drives (GET + PATCH api/profile/me: user fields +
 * buyerProfile/supplierProfile upsert in one round-trip). A signed-in user
 * could not change name/phone/business identity ANYWHERE in the native app.
 *
 * One typed ViewModel serves both entries: [Focus.GENERAL] (identity +
 * contact + business) and [Focus.BUSINESS] (business identity emphasis) —
 * the wire calls are identical; only the initial section emphasis differs.
 */
enum class EditProfileFocus { GENERAL, BUSINESS }

data class EditProfileUiState(
    val loading: Boolean = true,
    /** 401 on the profile GET — RouteOwnership guests land on login anyway,
     *  but an expired session mid-form flips this honestly. */
    val needsAuth: Boolean = false,
    val error: String? = null,
    val profile: ProfileMeDto? = null,
    val isSupplier: Boolean = false,
    // Form fields — rememberSaveable-mirrored by the screen; VM state is the
    // source of truth so a rotation mid-edit never wipes the draft.
    val fullName: String = "",
    val phone: String = "",
    val email: String = "",
    val businessName: String = "",
    val businessType: String = "",
    val tradeLicenseNumber: String = "",
    val saving: Boolean = false,
    val formError: String? = null,
    /** Increments on each successful save — the screen's toast trigger. */
    val savedTick: Int = 0,
)

class EditProfileViewModel(
    private val appContext: Context,
    private val focus: EditProfileFocus,
) : ViewModel() {

    private val _state = MutableStateFlow(EditProfileUiState())
    val state: StateFlow<EditProfileUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        if (_state.value.loading.not() && _state.value.error == null && _state.value.profile != null) return
        _state.update { it.copy(loading = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileApi(base).me()
                if (response.code() == 401) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                val body = response.body()
                val profile = body?.data
                if (!response.isSuccessful || profile == null) {
                    _state.update { it.copy(loading = false, error = "Could not load your profile (HTTP ${response.code()})") }
                    return@launch
                }
                val supplier = profile.userType == "supplier"
                _state.update {
                    it.copy(
                        loading = false,
                        profile = profile,
                        isSupplier = supplier,
                        // Wire truth → form (buyer fullName | supplier companyName;
                        // business identity from whichever profile exists).
                        fullName = profile.fullName.orEmpty(),
                        phone = profile.phone.orEmpty(),
                        email = profile.email.orEmpty(),
                        businessName = if (supplier) {
                            profile.supplierProfile?.companyName.orEmpty()
                        } else {
                            profile.buyerProfile?.businessName.orEmpty()
                        },
                        businessType = if (supplier) "" else profile.buyerProfile?.businessType.orEmpty(),
                        tradeLicenseNumber = if (supplier) profile.supplierProfile?.tradeLicenseNumber.orEmpty() else "",
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Network error — tap retry") }
            }
        }
    }

    fun setFullName(value: String) = _state.update { it.copy(fullName = value, formError = null) }
    fun setPhone(value: String) = _state.update { it.copy(phone = value, formError = null) }
    fun setEmail(value: String) = _state.update { it.copy(email = value, formError = null) }
    fun setBusinessName(value: String) = _state.update { it.copy(businessName = value, formError = null) }
    fun setBusinessType(value: String) = _state.update { it.copy(businessType = value, formError = null) }
    fun setTradeLicenseNumber(value: String) = _state.update { it.copy(tradeLicenseNumber = value, formError = null) }

    /** PATCH api/profile/me — the web edit-profile save contract verbatim. */
    fun save() {
        val s = _state.value
        if (s.saving || s.profile == null) return
        val name = s.fullName.trim()
        if (name.isEmpty()) {
            _state.update { it.copy(formError = "Your name cannot be empty") }
            return
        }
        if (s.email.isNotBlank() && !s.email.contains('@')) {
            _state.update { it.copy(formError = "Enter a valid email address") }
            return
        }
        // Only the fields the server actually persists ride the wire; blank
        // ones are omitted (explicitNulls=false) so nothing is nulled out.
        val body = ProfileUpdateRequest(
            fullName = name,
            phone = s.phone.trim().takeIf(String::isNotBlank),
            email = s.email.trim().takeIf(String::isNotBlank),
            companyName = if (s.isSupplier) s.businessName.trim().takeIf(String::isNotBlank) else null,
            businessName = if (!s.isSupplier) s.businessName.trim().takeIf(String::isNotBlank) else null,
            businessType = if (!s.isSupplier) s.businessType.trim().takeIf(String::isNotBlank) else null,
            tradeLicenseNumber = if (s.isSupplier) s.tradeLicenseNumber.trim().takeIf(String::isNotBlank) else null,
        )
        _state.update { it.copy(saving = true, formError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileApi(base).updateMe(body)
                if (response.code() == 401) {
                    _state.update { it.copy(saving = false, needsAuth = true) }
                    return@launch
                }
                val updated = response.body()?.data
                if (!response.isSuccessful || updated == null) {
                    _state.update { it.copy(saving = false, formError = "Could not save (HTTP ${response.code()}) — try again") }
                    return@launch
                }
                // The session cache (greeting surfaces + WebView seed) must
                // reflect the new identity — re-write the cached profile JSON
                // with the updated fields (same pairing rules as setUserJson).
                runCatching {
                    val seed = com.zylod.wholesale.data.api.UserProfileSeed(
                        id = updated.id,
                        userType = updated.userType,
                        email = updated.email,
                        phone = updated.phone,
                        fullName = updated.fullName,
                        businessName = if (updated.userType == "supplier") {
                            updated.supplierProfile?.companyName
                        } else {
                            updated.buyerProfile?.businessName
                        },
                        avatarUrl = updated.avatarUrl,
                        isProfileComplete = updated.isProfileComplete,
                        profileCompletionPct = updated.profileCompletionPct,
                        isEmailVerified = updated.isEmailVerified,
                        isPhoneVerified = updated.isPhoneVerified,
                        verificationStatus = updated.supplierProfile?.verificationStatus,
                    )
                    SessionManager.setUserJson(
                        com.zylod.wholesale.data.api.ApiClient.json
                            .encodeToString(com.zylod.wholesale.data.api.UserProfileSeed.serializer(), seed),
                    )
                }
                _state.update {
                    it.copy(
                        saving = false,
                        profile = updated,
                        savedTick = it.savedTick + 1,
                        fullName = updated.fullName.orEmpty(),
                        phone = updated.phone.orEmpty(),
                        email = updated.email.orEmpty(),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, formError = e.message ?: "Network error — try again") }
            }
        }
    }
}
