package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.RegisterRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.ProfileHydrator
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * t270 — SHARED supplier register wizard (pageIds "supplier-onboarding" and
 * "supplier-resources" — the web renders the SAME component for both:
 * src/components/pages/register-supplier-page.tsx). Four steps with a
 * progress bar and step-header chips:
 *
 *  1. Company Info  — fullName / companyName / city / businessType / email /
 *     phone / password (Next guard: all five starred fields non-blank).
 *  2. NID Upload    — nidNumber + NID front/back photo pickers.
 *  3. Trade License & TIN — tradeLicenseNumber + license picker + tinNumber.
 *  4. Bank Details  — bankName / account name / account number / branch.
 *
 * Submit flow (web-faithful, REAL network): each PICKED document uploads
 * first through [com.zylod.wholesale.data.api.SupplierFormsApi] (multipart
 * api/uploads/kyc, `file` + `kind` parts, TOP-LEVEL `url` response); any
 * failure surfaces the server's own error string and stays on the form.
 * Then POST api/auth/register through the EXISTING AuthApi accessor with
 * exactly the web payload (blank untouched fields stay "", only unpicked
 * doc URLs are omitted). On success the session is stored via
 * [SessionManager.setSession] + [ProfileHydrator.refresh] — the same
 * handoff the login flow uses — and the screen opens "seller-verification".
 *
 * NO ViewModel disk cache: a form is honest stateful UI — step, fields and
 * document picks live in [SupplierRegisterUiState] for the screen's
 * lifetime (surviving back navigation between steps and configuration
 * changes) and are never persisted nor seeded with anything fake.
 */
@Suppress("UNUSED_PARAMETER") // query is part of the delegation contract
@Composable
fun SupplierRegisterScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupplierRegisterViewModel = viewModel(
        key = "supplier-register-$pageId",
        factory = SupplierRegisterVmFactory(context.applicationContext, pageId),
    )
    val state by vm.state.collectAsStateWithLifecycle()

    var pendingSlot by remember { mutableStateOf<SupplierRegisterDocSlot?>(null) }
    val docPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        pendingSlot?.let { slot -> vm.onDocPicked(slot, uri) }
        pendingSlot = null
    }
    fun launchPicker(slot: SupplierRegisterDocSlot) {
        pendingSlot = slot
        docPicker.launch("image/*")
    }

    LaunchedEffect(state.registered) {
        if (state.registered) {
            vm.consumeRegistered()
            openPage("seller-verification", "")
        }
    }

    SupplierCorePageScaffold(title = "Register as Supplier", onBack = onBack) {
        Column(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            SupplierRegisterHeader()
            SupplierRegisterProgress(state.step)
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = supplierRegisterCardBorder(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        SUPPLIER_REGISTER_STEPS[state.step - 1].label,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        supplierRegisterStepDescription(state.step),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    state.error?.let { message ->
                        Spacer(Modifier.height(12.dp))
                        SupplierRegisterErrorAlert(message)
                    }
                    Spacer(Modifier.height(16.dp))

                    when (state.step) {
                        1 -> {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SupplierRegisterField(
                                    value = state.fullName,
                                    onValueChange = vm::setFullName,
                                    label = "Full Name (as on NID) *",
                                    placeholder = "Your full legal name",
                                )
                                SupplierRegisterField(
                                    value = state.companyName,
                                    onValueChange = vm::setCompanyName,
                                    label = "Company/Shop Name *",
                                    placeholder = "Your company name",
                                )
                                SupplierRegisterDropdown(
                                    label = "City",
                                    value = state.city,
                                    options = SUPPLIER_REGISTER_CITY_OPTIONS,
                                    onSelected = vm::setCity,
                                )
                                SupplierRegisterDropdown(
                                    label = "Business Type",
                                    value = state.businessType,
                                    options = SUPPLIER_REGISTER_BUSINESS_TYPE_OPTIONS,
                                    onSelected = vm::setBusinessType,
                                )
                                SupplierRegisterField(
                                    value = state.email,
                                    onValueChange = vm::setEmail,
                                    label = "Email Address *",
                                    placeholder = "your@email.com",
                                    keyboardType = KeyboardType.Email,
                                )
                                SupplierRegisterField(
                                    value = state.phone,
                                    onValueChange = vm::setPhone,
                                    label = "Phone Number *",
                                    placeholder = "+880 1700-000000",
                                    keyboardType = KeyboardType.Phone,
                                )
                                SupplierRegisterField(
                                    value = state.password,
                                    onValueChange = vm::setPassword,
                                    label = "Password *",
                                    placeholder = "Minimum 8 characters",
                                    keyboardType = KeyboardType.Password,
                                    visualTransformation = if (state.showPassword) {
                                        VisualTransformation.None
                                    } else {
                                        PasswordVisualTransformation()
                                    },
                                    leadingIcon = Icons.Outlined.Lock,
                                    trailingIcon = {
                                        IconButton(onClick = vm::toggleShowPassword) {
                                            Icon(
                                                if (state.showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                                contentDescription = if (state.showPassword) "Hide password" else "Show password",
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.size(18.dp),
                                            )
                                        }
                                    },
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            SupplierRegisterPrimaryButton(
                                text = "Next: NID Upload",
                                loading = false,
                                onClick = vm::nextCompanyInfo,
                            )
                        }

                        2 -> {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SupplierRegisterField(
                                    value = state.nidNumber,
                                    onValueChange = vm::setNidNumber,
                                    label = "NID Number *",
                                    placeholder = "National ID number",
                                )
                                SupplierDocPickCard(
                                    label = "NID Front Photo",
                                    hint = "Tap to upload NID front photo",
                                    pick = state.nidFront,
                                    enabled = !state.submitting,
                                    onPick = { launchPicker(SupplierRegisterDocSlot.NID_FRONT) },
                                )
                                SupplierDocPickCard(
                                    label = "NID Back Photo",
                                    hint = "Tap to upload NID back photo",
                                    pick = state.nidBack,
                                    enabled = !state.submitting,
                                    onPick = { launchPicker(SupplierRegisterDocSlot.NID_BACK) },
                                )
                                SupplierRegisterNote(
                                    icon = Icons.Outlined.VerifiedUser,
                                    text = "Your NID will be verified by our admin team before you can start selling.",
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            WizardNavRow(
                                backEnabled = !state.submitting,
                                onBack = vm::back,
                                nextLabel = "Next: Trade License",
                                nextLoading = state.submitting,
                                onNext = vm::nextNidUpload,
                            )
                        }

                        3 -> {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SupplierRegisterField(
                                    value = state.tradeLicenseNumber,
                                    onValueChange = vm::setTradeLicenseNumber,
                                    label = "Trade License Number *",
                                    placeholder = "Trade license number",
                                )
                                SupplierDocPickCard(
                                    label = "Trade License Document",
                                    hint = "Tap to upload trade license document (optional)",
                                    pick = state.tradeLicense,
                                    enabled = !state.submitting,
                                    onPick = { launchPicker(SupplierRegisterDocSlot.TRADE_LICENSE) },
                                )
                                SupplierRegisterField(
                                    value = state.tinNumber,
                                    onValueChange = vm::setTinNumber,
                                    label = "TIN Number *",
                                    placeholder = "Tax Identification Number",
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            WizardNavRow(
                                backEnabled = !state.submitting,
                                onBack = vm::back,
                                nextLabel = "Next: Bank Details",
                                nextLoading = state.submitting,
                                onNext = vm::nextTradeLicense,
                            )
                        }

                        else -> {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                SupplierRegisterField(
                                    value = state.bankName,
                                    onValueChange = vm::setBankName,
                                    label = "Bank Name *",
                                    placeholder = "Bank name",
                                )
                                SupplierRegisterField(
                                    value = state.bankAccountName,
                                    onValueChange = vm::setBankAccountName,
                                    label = "Account Holder Name *",
                                    placeholder = "Name on bank account",
                                )
                                SupplierRegisterField(
                                    value = state.bankAccountNumber,
                                    onValueChange = vm::setBankAccountNumber,
                                    label = "Account Number *",
                                    placeholder = "Bank account number",
                                )
                                SupplierRegisterField(
                                    value = state.bankBranch,
                                    onValueChange = vm::setBankBranch,
                                    label = "Branch Name",
                                    placeholder = "Branch name",
                                )
                                SupplierRegisterNote(
                                    icon = Icons.Outlined.AccountBalance,
                                    text = "Your bank details will be used for receiving payments from buyer orders.",
                                )
                            }
                            state.uploadingLabel?.let { label ->
                                Spacer(Modifier.height(12.dp))
                                Text(
                                    label,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                            Spacer(Modifier.height(16.dp))
                            WizardNavRow(
                                backEnabled = !state.submitting,
                                onBack = vm::back,
                                nextLabel = "Submit Registration",
                                nextLoading = state.submitting,
                                onNext = vm::submit,
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "Already have an account?",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        TextButton(
                            onClick = { openPage("login", "") },
                            modifier = Modifier.heightIn(min = 44.dp),
                        ) {
                            Text(
                                "Log In",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Back + Next pairing used by steps 2-4 (web w-1/3 outline / flex-1 primary). */
@Composable
private fun WizardNavRow(
    backEnabled: Boolean,
    onBack: () -> Unit,
    nextLabel: String,
    nextLoading: Boolean,
    onNext: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        Box(modifier = Modifier.weight(1f)) {
            SupplierRegisterBackButton(text = "Back", enabled = backEnabled, onClick = onBack)
        }
        Box(modifier = Modifier.weight(2f)) {
            SupplierRegisterPrimaryButton(
                text = nextLabel,
                loading = nextLoading,
                enabled = true,
                onClick = onNext,
            )
        }
    }
}

/* ─── Wizard state + submit chain ─── */

/** One picked KYC document slot (the web `File` + preview pair). */
data class SupplierDocPick(
    val uri: String = "",
    val displayName: String = "",
    val mime: String = "",
)

/** The three document slots of the wizard (web ids nid-front|nid-back|trade-license). */
enum class SupplierRegisterDocSlot { NID_FRONT, NID_BACK, TRADE_LICENSE }

/**
 * Every field of the wizard — plain honest form state, never cached, never
 * seeded. [error] is the inline alert message; [uploadingLabel] names the
 * document currently uploading ("Uploading NID front…"); [registered] is
 * the one-shot success flag consumed by the screen to open
 * "seller-verification".
 */
data class SupplierRegisterUiState(
    val step: Int = 1,
    val fullName: String = "",
    val companyName: String = "",
    val city: String = "",
    val businessType: String = "",
    val email: String = "",
    val phone: String = "",
    val password: String = "",
    val showPassword: Boolean = false,
    val nidNumber: String = "",
    val nidFront: SupplierDocPick? = null,
    val nidBack: SupplierDocPick? = null,
    val tradeLicenseNumber: String = "",
    val tradeLicense: SupplierDocPick? = null,
    val tinNumber: String = "",
    val bankName: String = "",
    val bankAccountName: String = "",
    val bankAccountNumber: String = "",
    val bankBranch: String = "",
    val error: String? = null,
    val submitting: Boolean = false,
    val uploadingLabel: String? = null,
    val registered: Boolean = false,
)

/**
 * Abort the submit chain after a failed document upload. The error is
 * already on the state when thrown — the outer catch re-asserts the same
 * message (web rethrows err.message through the same inline alert).
 */
private class DocUploadException(message: String) : Exception(message)

class SupplierRegisterViewModel(
    private val appContext: Context,
    private val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(SupplierRegisterUiState())
    val state: StateFlow<SupplierRegisterUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /* Field setters — one per editable field, family StateFlow idiom. */
    fun setFullName(value: String) = _state.update { it.copy(fullName = value) }
    fun setCompanyName(value: String) = _state.update { it.copy(companyName = value) }
    fun setCity(value: String) = _state.update { it.copy(city = value) }
    fun setBusinessType(value: String) = _state.update { it.copy(businessType = value) }
    fun setEmail(value: String) = _state.update { it.copy(email = value) }
    fun setPhone(value: String) = _state.update { it.copy(phone = value) }
    fun setPassword(value: String) = _state.update { it.copy(password = value) }
    fun toggleShowPassword() = _state.update { it.copy(showPassword = !it.showPassword) }
    fun setNidNumber(value: String) = _state.update { it.copy(nidNumber = value) }
    fun setTradeLicenseNumber(value: String) = _state.update { it.copy(tradeLicenseNumber = value) }
    fun setTinNumber(value: String) = _state.update { it.copy(tinNumber = value) }
    fun setBankName(value: String) = _state.update { it.copy(bankName = value) }
    fun setBankAccountName(value: String) = _state.update { it.copy(bankAccountName = value) }
    fun setBankAccountNumber(value: String) = _state.update { it.copy(bankAccountNumber = value) }
    fun setBankBranch(value: String) = _state.update { it.copy(bankBranch = value) }

    fun consumeRegistered() = _state.update { it.copy(registered = false) }

    /* Step guards — the web form onSubmit guards, verbatim messages. */

    fun nextCompanyInfo() {
        val s = _state.value
        if (s.fullName.isBlank() || s.companyName.isBlank() || s.email.isBlank() ||
            s.phone.isBlank() || s.password.isBlank()
        ) {
            _state.update { it.copy(error = "Please fill all required fields") }
            return
        }
        _state.update { it.copy(step = 2, error = null) }
    }

    fun nextNidUpload() {
        if (_state.value.nidNumber.isBlank()) {
            _state.update { it.copy(error = "Please enter NID number") }
            return
        }
        _state.update { it.copy(step = 3, error = null) }
    }

    fun nextTradeLicense() {
        val s = _state.value
        if (s.tradeLicenseNumber.isBlank() || s.tinNumber.isBlank()) {
            _state.update { it.copy(error = "Please fill required fields") }
            return
        }
        _state.update { it.copy(step = 4, error = null) }
    }

    fun back() = _state.update { it.copy(step = (it.step - 1).coerceAtLeast(1), error = null) }

    /**
     * Photo-picker callback: validate size (ContentResolver, 8MB) + MIME
     * (the server only accepts jpg/png/webp) and stage the pick. uri == null
     * means the user cancelled the picker — not an error.
     */
    fun onDocPicked(slot: SupplierRegisterDocSlot, uri: Uri?) {
        if (uri == null) return
        viewModelScope.launch {
            val inspected = withContext(Dispatchers.IO) { inspectDoc(uri) }
            inspected.fold(
                onSuccess = { pick ->
                    _state.update { current ->
                        val base = current.copy(error = null)
                        when (slot) {
                            SupplierRegisterDocSlot.NID_FRONT -> base.copy(nidFront = pick)
                            SupplierRegisterDocSlot.NID_BACK -> base.copy(nidBack = pick)
                            SupplierRegisterDocSlot.TRADE_LICENSE -> base.copy(tradeLicense = pick)
                        }
                    }
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(error = e.message?.takeIf(String::isNotBlank) ?: UNEXPECTED_ERROR)
                    }
                },
            )
        }
    }

    /** Final submit — uploads, then the register POST, then the session handoff. */
    fun submit() {
        if (_state.value.submitting) return
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null, uploadingLabel = null) }
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val nidFrontUrl = uploadIfPicked(SupplierRegisterDocSlot.NID_FRONT, base)
                val nidBackUrl = uploadIfPicked(SupplierRegisterDocSlot.NID_BACK, base)
                val tradeLicenseUrl = uploadIfPicked(SupplierRegisterDocSlot.TRADE_LICENSE, base)

                // The EXACT web payload: blank untouched fields ride as "",
                // only unpicked document URLs are omitted (explicitNulls=false
                // drops the nulls from the wire body).
                val form = _state.value
                val response = ApiClient.authApi(base).register(
                    RegisterRequest(
                        userType = "supplier",
                        authProvider = "email",
                        email = form.email,
                        phone = form.phone,
                        password = form.password,
                        fullName = form.fullName,
                        businessName = form.companyName,
                        businessType = form.businessType,
                        city = form.city,
                        nidNumber = form.nidNumber,
                        nidFrontImageUrl = nidFrontUrl,
                        nidBackImageUrl = nidBackUrl,
                        tradeLicenseNumber = form.tradeLicenseNumber,
                        tradeLicenseImageUrl = tradeLicenseUrl,
                        tinNumber = form.tinNumber,
                        bankName = form.bankName,
                        bankAccountName = form.bankAccountName,
                        bankAccountNumber = form.bankAccountNumber,
                        branch = form.bankBranch,
                    ),
                )
                if (!response.isSuccessful) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Registration failed"
                    Log.w(TAG, "register failed http=${response.code()} pageId=$pageId")
                    _state.update { it.copy(submitting = false, error = message) }
                    return@launch
                }
                val data = response.body()
                val token = data?.token
                val user = data?.user
                if (token.isNullOrBlank() || user == null) {
                    // t208 parity: never render a fake signed-in state on a 2xx
                    // without a usable session — the user completes via login.
                    _state.update {
                        it.copy(
                            submitting = false,
                            error = "Account created but the session could not be established — please log in",
                        )
                    }
                    return@launch
                }
                // Web login({...}, token) parity: the seed carries the register
                // user + the 30% completion snapshot (avatarUrl null,
                // isProfileComplete false), then ProfileHydrator re-hydrates
                // against /api/profile/me — the SAME handoff LoginScreen uses.
                val seed = UserProfileSeed(
                    id = user.id,
                    userType = user.userType,
                    email = user.email,
                    phone = user.phone,
                    fullName = user.fullName ?: form.fullName,
                    businessName = user.businessName ?: form.companyName,
                    avatarUrl = null,
                    isProfileComplete = false,
                    profileCompletionPct = 30,
                    companyName = form.companyName,
                )
                SessionManager.setSession(token, ApiClient.json.encodeToString(UserProfileSeed.serializer(), seed))
                ProfileHydrator.refresh(base)
                Log.i(TAG, "register success pageId=$pageId — session stored, opening seller-verification")
                _state.update { it.copy(submitting = false, registered = true) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "register submit failed pageId=$pageId: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        uploadingLabel = null,
                        error = e.message?.takeIf(String::isNotBlank) ?: UNEXPECTED_ERROR,
                    )
                }
            }
        }
    }

    /**
     * Upload one PICKED document (skipped when the slot is empty) and return
     * its server URL. Any failure parks the server's own message on the
     * state and throws [DocUploadException] to stop the chain — the form
     * stays exactly where it is.
     */
    private suspend fun uploadIfPicked(slot: SupplierRegisterDocSlot, base: String): String? {
        val pick = when (slot) {
            SupplierRegisterDocSlot.NID_FRONT -> _state.value.nidFront
            SupplierRegisterDocSlot.NID_BACK -> _state.value.nidBack
            SupplierRegisterDocSlot.TRADE_LICENSE -> _state.value.tradeLicense
        } ?: return null
        val kind = when (slot) {
            SupplierRegisterDocSlot.NID_FRONT -> "nid-front"
            SupplierRegisterDocSlot.NID_BACK -> "nid-back"
            SupplierRegisterDocSlot.TRADE_LICENSE -> "trade-license"
        }
        val label = when (slot) {
            SupplierRegisterDocSlot.NID_FRONT -> "NID front"
            SupplierRegisterDocSlot.NID_BACK -> "NID back"
            SupplierRegisterDocSlot.TRADE_LICENSE -> "trade license"
        }
        _state.update { it.copy(uploadingLabel = "Uploading $label…") }
        Log.i(TAG, "kyc upload start kind=$kind pageId=$pageId")

        val bytes = readDocBytes(pick, label)
        val fileName = docFileName(pick, kind)
        val response = ApiClient.supplierFormsApi(base).uploadKyc(
            file = MultipartBody.Part.createFormData(
                name = "file",
                filename = fileName,
                body = bytes.toRequestBody(docMime(pick, fileName).toMediaTypeOrNull()),
            ),
            kind = kind.toByteArray().toRequestBody("text/plain".toMediaTypeOrNull()),
        )
        if (!response.isSuccessful) {
            val message = parseErrorBody(response.errorBody()).error
                ?.takeIf(String::isNotBlank)
                ?: "Failed to upload $kind"
            Log.w(TAG, "kyc upload failed kind=$kind http=${response.code()}")
            _state.update { it.copy(submitting = false, uploadingLabel = null, error = message) }
            throw DocUploadException(message)
        }
        val url = response.body()?.url?.takeIf(String::isNotBlank)
        if (url == null) {
            val message = "Failed to upload $kind"
            _state.update { it.copy(submitting = false, uploadingLabel = null, error = message) }
            throw DocUploadException(message)
        }
        Log.i(TAG, "kyc upload ok kind=$kind pageId=$pageId")
        return url
    }

    /** Size + MIME + display name of the picked content Uri (IO). */
    private fun inspectDoc(uri: Uri): Result<SupplierDocPick> = runCatching {
        val resolver = appContext.contentResolver
        val size = resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        if (size > MAX_DOC_BYTES) error("Document too large (max 8MB)")
        val mime = resolver.getType(uri) ?: ""
        if (mime.isNotBlank() && mime !in ACCEPTED_MIME_TYPES) {
            // The web input filters to jpg/png/webp via accept=; GetContent
            // cannot, so the server's own rejection line is surfaced here.
            error("Only JPG, PNG, or WebP images are accepted")
        }
        var displayName = ""
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) displayName = cursor.getString(0) ?: ""
        }
        SupplierDocPick(uri = uri.toString(), displayName = displayName, mime = mime)
    }

    /** The picked image bytes (IO) — honest failure when the Uri is gone. */
    private suspend fun readDocBytes(pick: SupplierDocPick, label: String): ByteArray =
        withContext(Dispatchers.IO) {
            val read = runCatching {
                appContext.contentResolver.openInputStream(Uri.parse(pick.uri))?.use { it.readBytes() }
            }
            read.getOrNull() ?: throw IllegalStateException("Could not read the selected $label image")
        }

    /** Sensible multipart filename: provider name, or kind-based with ext. */
    private fun docFileName(pick: SupplierDocPick, kind: String): String {
        val base = pick.displayName.substringAfterLast('/').trim().ifBlank { kind }
        return if (base.contains('.')) base else "$base.${docExtension(pick)}"
    }

    private fun docExtension(pick: SupplierDocPick): String = when (pick.mime) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        else -> "jpg"
    }

    /** Part content type — drives the server-side ext + ALLOWED_TYPES check. */
    private fun docMime(pick: SupplierDocPick, fileName: String): String = when {
        pick.mime in ACCEPTED_MIME_TYPES -> pick.mime
        else -> when (fileName.substringAfterLast('.', "").lowercase()) {
            "png" -> "image/png"
            "webp" -> "image/webp"
            "jpg", "jpeg" -> "image/jpeg"
            else -> "application/octet-stream"
        }
    }

    private companion object {
        const val TAG = "ZylodSupplierCore"
        val MAX_DOC_BYTES: Long = 8L * 1024 * 1024
        val ACCEPTED_MIME_TYPES = setOf("image/jpeg", "image/png", "image/webp")
        const val UNEXPECTED_ERROR = "An unexpected error occurred. Please try again."
    }
}

private class SupplierRegisterVmFactory(
    private val appContext: Context,
    private val pageId: String,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        SupplierRegisterViewModel(appContext, pageId) as T
}
