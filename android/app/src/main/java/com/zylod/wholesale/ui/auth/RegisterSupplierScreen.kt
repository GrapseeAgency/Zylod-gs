package com.zylod.wholesale.ui.auth

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Upload
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.ExperimentalMaterial3Api
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
import coil.compose.AsyncImage
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AuthUserDto
import com.zylod.wholesale.data.api.RegisterRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.ProfileHydrator
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.ui.components.AuthScaffold
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodEntrance
import com.zylod.wholesale.ui.components.ZylodTextField
import java.io.File
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import okhttp3.MediaType.Companion.toMediaTypeOrNull

/**
 * Register supplier — port of src/components/pages/register-supplier-page.tsx
 * (spec §3.5): 4 steps (Company Info → NID Upload → Trade License & TIN → Bank
 * Details). KYC images (nid-front / nid-back / trade-license) go through the
 * Android Photo Picker (no new permissions) and upload as multipart
 * `file`+`kind` to POST /api/uploads/kyc (8 MB jpg/png/webp limit, TOP-LEVEL
 * `url` in the response — verified in uploads/kyc/route.ts:46-51).
 */
enum class KycSlot { NID_FRONT, NID_BACK, TRADE_LICENSE }

data class KycUploadState(
    val contentUri: String? = null,
    val localFile: String? = null,
    val uploading: Boolean = false,
    val progress: Float = 0f,
    val url: String? = null,
    val error: String? = null,
    val fileName: String = "",
    val sizeBytes: Long = 0,
)

data class RegisterSupplierUiState(
    val step: Int = 1,
    val error: String? = null,
    val nidFront: KycUploadState = KycUploadState(),
    val nidBack: KycUploadState = KycUploadState(),
    val tradeLicense: KycUploadState = KycUploadState(),
    val submitting: Boolean = false,
    val success: Boolean = false,
    val toast: String? = null,
)

class RegisterSupplierViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RegisterSupplierUiState())
    val state: StateFlow<RegisterSupplierUiState> = _state

    private var baseUrl: String? = null

    fun setStep(step: Int) {
        _state.update { it.copy(step = step.coerceIn(1, 4), error = null) }
    }

    fun consumeSuccess() {
        _state.update { it.copy(success = false) }
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    private fun slotState(slot: KycSlot): KycUploadState = when (slot) {
        KycSlot.NID_FRONT -> _state.value.nidFront
        KycSlot.NID_BACK -> _state.value.nidBack
        KycSlot.TRADE_LICENSE -> _state.value.tradeLicense
    }

    private fun updateSlot(slot: KycSlot, transform: (KycUploadState) -> KycUploadState) {
        _state.update { current ->
            when (slot) {
                KycSlot.NID_FRONT -> current.copy(nidFront = transform(current.nidFront))
                KycSlot.NID_BACK -> current.copy(nidBack = transform(current.nidBack))
                KycSlot.TRADE_LICENSE -> current.copy(tradeLicense = transform(current.tradeLicense))
            }
        }
    }

    /** Photo Picker callback: validate 8 MB / jpg|png|webp and stage a cache file. */
    fun onImagePicked(slot: KycSlot, uri: Uri?) {
        if (uri == null) return
        viewModelScope.launch {
            val staged = withContext(Dispatchers.IO) { stageFile(uri) }
            staged.fold(
                onSuccess = { file ->
                    updateSlot(slot) {
                        it.copy(contentUri = uri.toString(), localFile = file.absolutePath, fileName = file.name, sizeBytes = file.length(), error = null, url = null, progress = 0f)
                    }
                },
                onFailure = { e -> updateSlot(slot) { it.copy(error = e.message ?: "Invalid document") } },
            )
        }
    }

    private fun stageFile(uri: Uri): Result<File> = runCatching {
        val resolver = appContext.contentResolver
        val size = resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        if (size > 8L * 1024 * 1024) error("Document too large (max 8MB)")
        val type = resolver.getType(uri) ?: ""
        if (type !in listOf("image/jpeg", "image/png", "image/webp")) error("Only JPG, PNG, or WebP images are accepted")
        val ext = when (type) {
            "image/png" -> "png"
            "image/webp" -> "webp"
            else -> "jpg"
        }
        val target = File(appContext.cacheDir, "kyc-${System.nanoTime()}.$ext")
        resolver.openInputStream(uri)?.use { input ->
            target.outputStream().use { output -> input.copyTo(output) }
        } ?: error("Could not read the selected image")
        if (target.length() > 8L * 1024 * 1024) error("Document too large (max 8MB)")
        target
    }

    /** Uploads one staged document to /api/uploads/kyc (multipart file+kind). */
    fun upload(slot: KycSlot, onUploaded: () -> Unit = {}) {
        val file = slotState(slot).localFile?.let(::File)
        if (file == null || !file.exists()) {
            updateSlot(slot) { it.copy(error = "Select a document first") }
            return
        }
        val kind = when (slot) {
            KycSlot.NID_FRONT -> "nid-front"
            KycSlot.NID_BACK -> "nid-back"
            KycSlot.TRADE_LICENSE -> "trade-license"
        }
        updateSlot(slot) { it.copy(uploading = true, progress = 0f, error = null) }
        viewModelScope.launch {
            try {
                val base = withContext(Dispatchers.IO) {
                    baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                }
                val result = withContext(Dispatchers.IO) {
                    KycUploader.upload(base, file, kind) { fraction ->
                        updateSlot(slot) { it.copy(progress = fraction) }
                    }
                }
                result.fold(
                    onSuccess = { url ->
                        updateSlot(slot) { it.copy(uploading = false, progress = 1f, url = url) }
                        onUploaded()
                    },
                    onFailure = { e ->
                        updateSlot(slot) { it.copy(uploading = false, error = e.message ?: "Upload failed") }
                    },
                )
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                updateSlot(slot) { it.copy(uploading = false, error = "Upload failed") }
            }
        }
    }

    /** Final submit — upload any pending documents, then POST /api/auth/register. */
    fun submit(
        fullName: String, companyName: String, city: String, businessType: String,
        email: String, phone: String, password: String, nidNumber: String,
        tradeLicenseNumber: String, tinNumber: String, bankName: String,
        bankAccountName: String, bankAccountNumber: String, bankBranch: String,
    ) {
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            try {
                val s = _state.value
                val nidFrontUrl = s.nidFront.url ?: s.nidFront.takeIf { it.localFile != null }?.let { uploadBlocking(KycSlot.NID_FRONT) }
                val nidBackUrl = s.nidBack.url ?: s.nidBack.takeIf { it.localFile != null }?.let { uploadBlocking(KycSlot.NID_BACK) }
                val licenseUrl = s.tradeLicense.url ?: s.tradeLicense.takeIf { it.localFile != null }?.let { uploadBlocking(KycSlot.TRADE_LICENSE) }

                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.authApi(base).register(
                    RegisterRequest(
                        userType = "supplier",
                        authProvider = "email",
                        email = email.trim(),
                        phone = phone.trim(),
                        password = password,
                        fullName = fullName.trim(),
                        businessName = companyName.trim(),
                        businessType = businessType.takeIf(String::isNotBlank),
                        city = city.takeIf(String::isNotBlank),
                        nidNumber = nidNumber.trim(),
                        nidFrontImageUrl = nidFrontUrl,
                        nidBackImageUrl = nidBackUrl,
                        tradeLicenseNumber = tradeLicenseNumber.trim(),
                        tradeLicenseImageUrl = licenseUrl,
                        tinNumber = tinNumber.trim(),
                        bankName = bankName.trim(),
                        bankAccountName = bankAccountName.trim(),
                        bankAccountNumber = bankAccountNumber.trim(),
                        branch = bankBranch.trim().takeIf(String::isNotBlank),
                    ),
                )
                if (!response.isSuccessful) {
                    _state.update { it.copy(submitting = false, error = parseErrorBody(response.errorBody()).error ?: "Registration failed") }
                    return@launch
                }
                val data = response.body()
                val user: AuthUserDto? = data?.user
                val token: String? = data?.token
                if (user != null && token != null) {
                    val seed = UserProfileSeed(
                        id = user.id,
                        userType = user.userType,
                        email = user.email,
                        phone = user.phone,
                        fullName = user.fullName ?: fullName.trim(),
                        businessName = user.businessName ?: companyName.trim(),
                        avatarUrl = null,
                        isProfileComplete = false,
                        profileCompletionPct = 30,
                        companyName = companyName.trim(),
                    )
                    SessionManager.setSession(token, ApiClient.json.encodeToString(UserProfileSeed.serializer(), seed))
                    ProfileHydrator.refresh(base)
                }
                _state.update {
                    it.copy(submitting = false, success = true, toast = "Account created! Your profile is pending verification.")
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(submitting = false, error = "An unexpected error occurred. Please try again.") }
            }
        }
    }

    private suspend fun uploadBlocking(slot: KycSlot): String? {
        val file = slotState(slot).localFile?.let(::File) ?: return null
        val kind = when (slot) {
            KycSlot.NID_FRONT -> "nid-front"
            KycSlot.NID_BACK -> "nid-back"
            KycSlot.TRADE_LICENSE -> "trade-license"
        }
        val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
        return withContext(Dispatchers.IO) {
            KycUploader.upload(base, file, kind) { fraction ->
                updateSlot(slot) { it.copy(progress = fraction) }
            }.getOrNull()
        }
    }
}

/** Multipart /api/uploads/kyc client — returns the TOP-LEVEL url field. */
private object KycUploader {
    fun upload(baseUrl: String, file: File, kind: String, onProgress: (Float) -> Unit): Result<String> = runCatching {
        val contentType = "application/octet-stream".toMediaTypeOrNull()
        val countingBody = object : okhttp3.RequestBody() {
            override fun contentType(): okhttp3.MediaType? = contentType
            override fun contentLength(): Long = file.length()
            override fun writeTo(sink: okio.BufferedSink) {
                val total = contentLength()
                var written = 0L
                file.inputStream().use { input ->
                    val buffer = ByteArray(8192)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        sink.write(buffer, 0, read)
                        written += read
                        onProgress((written.toDouble() / total.toDouble()).toFloat().coerceIn(0f, 1f))
                    }
                }
            }
        }
        val multipart = okhttp3.MultipartBody.Builder()
            .setType(okhttp3.MultipartBody.FORM)
            .addFormDataPart("kind", kind)
            .addFormDataPart("file", file.name, countingBody)
            .build()
        val request = okhttp3.Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/uploads/kyc")
            .post(multipart)
            .build()
        val client = okhttp3.OkHttpClient.Builder()
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .build()
        client.newCall(request).execute().use { response ->
            val bodyStr = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val err = runCatching {
                    ApiClient.json.decodeFromString(com.zylod.wholesale.data.api.AuthErrorDto.serializer(), bodyStr)
                }.getOrNull()
                error(err?.error ?: "Upload failed")
            }
            val parsed = runCatching {
                ApiClient.json.decodeFromString(com.zylod.wholesale.data.api.KycUploadResponse.serializer(), bodyStr)
            }.getOrNull()
            parsed?.url?.takeIf(String::isNotBlank) ?: error("Upload returned no URL")
        }
    }
}

private class RegisterSupplierVmFactory(private val context: Context) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = RegisterSupplierViewModel(context) as T
}

private val STEP_LABELS = listOf("Company Info", "NID Upload", "Trade License & TIN", "Bank Details")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterSupplierScreen(
    onAuthenticated: () -> Unit,
    onLogin: () -> Unit,
) {
    val context = LocalContext.current
    val vm: RegisterSupplierViewModel = viewModel(factory = RegisterSupplierVmFactory(context.applicationContext))
    val state by vm.state.collectAsState()

    var pickedSlot by remember { mutableStateOf<KycSlot?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        pickedSlot?.let { slot -> vm.onImagePicked(slot, uri) }
        pickedSlot = null
    }
    fun launchPicker(slot: KycSlot) {
        pickedSlot = slot
        picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    // Step 1 fields
    var fullName by rememberSaveable { mutableStateOf("") }
    var companyName by rememberSaveable { mutableStateOf("") }
    var city by rememberSaveable { mutableStateOf("") }
    var businessType by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    // Step 2/3
    var nidNumber by rememberSaveable { mutableStateOf("") }
    var tradeLicenseNumber by rememberSaveable { mutableStateOf("") }
    var tinNumber by rememberSaveable { mutableStateOf("") }
    // Step 4
    var bankName by rememberSaveable { mutableStateOf("") }
    var bankAccountName by rememberSaveable { mutableStateOf("") }
    var bankAccountNumber by rememberSaveable { mutableStateOf("") }
    var bankBranch by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(state.success) {
        if (state.success) {
            vm.consumeSuccess()
            onAuthenticated()
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
                Text("Register as Supplier", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                Text(
                    "Start selling on the B2B wholesale marketplace",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Spacer(Modifier.height(20.dp))

            // Progress indicator (web Progress + step labels)
            LinearProgressIndicator(
                progress = { state.step / 4f },
                modifier = Modifier.fillMaxWidth().height(4.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                STEP_LABELS.forEachIndexed { index, label ->
                    Text(
                        label,
                        fontSize = 9.sp,
                        maxLines = 1,
                        fontWeight = if (state.step == index + 1) FontWeight.SemiBold else FontWeight.Normal,
                        color = if (state.step > index + 1) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(18.dp))

            Text(STEP_LABELS[state.step - 1], fontSize = 16.sp, fontWeight = FontWeight.Bold)
            Text(
                when (state.step) {
                    1 -> "Tell us about your business"
                    2 -> "Verify your identity with NID"
                    3 -> "Provide trade license and TIN details"
                    else -> "Set up your bank account for payments"
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
            Spacer(Modifier.height(16.dp))

            when (state.step) {
                1 -> {
                    ZylodTextField(value = fullName, onValueChange = { fullName = it }, label = "Full Name (as on NID) *", placeholder = "Your full legal name")
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = companyName, onValueChange = { companyName = it }, label = "Company/Shop Name *", placeholder = "Your company name")
                    Spacer(Modifier.height(12.dp))
                    DropdownField(
                        label = "City",
                        value = city,
                        options = listOf("dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh"),
                        onSelected = { city = it },
                    )
                    Spacer(Modifier.height(12.dp))
                    DropdownField(
                        label = "Business Type",
                        value = businessType,
                        options = listOf("manufacturer", "wholesaler", "trading", "factory"),
                        onSelected = { businessType = it },
                    )
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = email, onValueChange = { email = it }, label = "Email Address *", placeholder = "your@email.com", keyboardType = KeyboardType.Email)
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = phone, onValueChange = { phone = it }, label = "Phone Number *", placeholder = "+880 1700-000000", keyboardType = KeyboardType.Phone)
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = "Password *",
                        placeholder = "Minimum 8 characters",
                        keyboardType = KeyboardType.Password,
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        trailing = {
                            androidx.compose.material3.IconButton(onClick = { showPassword = !showPassword }) {
                                androidx.compose.material3.Icon(
                                    if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                    if (showPassword) "Hide password" else "Show password",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        },
                    )
                }

                2 -> {
                    ZylodTextField(value = nidNumber, onValueChange = { nidNumber = it }, label = "NID Number *", placeholder = "National ID number")
                    Spacer(Modifier.height(14.dp))
                    KycUploadRow(
                        label = "NID Front Photo",
                        upload = state.nidFront,
                        onPick = { launchPicker(KycSlot.NID_FRONT) },
                        onUpload = { vm.upload(KycSlot.NID_FRONT) },
                    )
                    Spacer(Modifier.height(14.dp))
                    KycUploadRow(
                        label = "NID Back Photo",
                        upload = state.nidBack,
                        onPick = { launchPicker(KycSlot.NID_BACK) },
                        onUpload = { vm.upload(KycSlot.NID_BACK) },
                    )
                    Spacer(Modifier.height(14.dp))
                    InfoNote(
                        icon = { Icon(Icons.Outlined.Storefront, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp)) },
                        text = "Your NID will be verified by our admin team before you can start selling.",
                    )
                }

                3 -> {
                    ZylodTextField(value = tradeLicenseNumber, onValueChange = { tradeLicenseNumber = it }, label = "Trade License Number *", placeholder = "Trade license number")
                    Spacer(Modifier.height(14.dp))
                    KycUploadRow(
                        label = "Trade License Document (optional)",
                        upload = state.tradeLicense,
                        onPick = { launchPicker(KycSlot.TRADE_LICENSE) },
                        onUpload = { vm.upload(KycSlot.TRADE_LICENSE) },
                    )
                    Spacer(Modifier.height(14.dp))
                    ZylodTextField(value = tinNumber, onValueChange = { tinNumber = it }, label = "TIN Number *", placeholder = "Tax Identification Number")
                }

                else -> {
                    ZylodTextField(value = bankName, onValueChange = { bankName = it }, label = "Bank Name *")
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = bankAccountName, onValueChange = { bankAccountName = it }, label = "Account Holder Name *")
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = bankAccountNumber, onValueChange = { bankAccountNumber = it }, label = "Account Number *")
                    Spacer(Modifier.height(12.dp))
                    ZylodTextField(value = bankBranch, onValueChange = { bankBranch = it }, label = "Branch Name")
                    Spacer(Modifier.height(14.dp))
                    InfoNote(
                        icon = { Icon(Icons.Outlined.AccountBalance, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(14.dp)) },
                        text = "Your bank details will be used for receiving payments from buyer orders.",
                    )
                }
            }

            state.error?.let {
                Spacer(Modifier.height(14.dp))
                ErrorBanner(it)
            }

            Spacer(Modifier.height(20.dp))
            when (state.step) {
                1 -> ZylodButton(
                    text = "Next: NID Upload",
                    onClick = {
                        if (fullName.isBlank() || companyName.isBlank() || email.isBlank() || phone.isBlank() || password.isBlank()) {
                            return@ZylodButton
                        }
                        vm.setStep(2)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    content = {
                        Text("Next: NID Upload", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, modifier = Modifier.size(16.dp))
                    },
                )
                else -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    ZylodButton(
                        text = "Back",
                        variant = com.zylod.wholesale.ui.components.ZylodButtonVariant.OUTLINED,
                        onClick = { vm.setStep(state.step - 1) },
                        modifier = Modifier.weight(1f),
                        content = {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, null, modifier = Modifier.size(16.dp))
                            Text("Back", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        },
                    )
                    when (state.step) {
                        2 -> ZylodButton(
                            text = "Next: Trade License",
                            onClick = { if (nidNumber.isBlank()) return@ZylodButton; vm.setStep(3) },
                            modifier = Modifier.weight(2f),
                            content = {
                                Text("Next: Trade License", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, modifier = Modifier.size(16.dp))
                            },
                        )
                        3 -> ZylodButton(
                            text = "Next: Bank Details",
                            onClick = { if (tradeLicenseNumber.isBlank() || tinNumber.isBlank()) return@ZylodButton; vm.setStep(4) },
                            modifier = Modifier.weight(2f),
                            content = {
                                Text("Next: Bank Details", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                                Icon(Icons.AutoMirrored.Outlined.ArrowForward, null, modifier = Modifier.size(16.dp))
                            },
                        )
                        else -> ZylodButton(
                            text = if (state.submitting) "Creating Account..." else "Create Account & Submit",
                            onClick = {
                                vm.submit(fullName, companyName, city, businessType, email, phone, password, nidNumber, tradeLicenseNumber, tinNumber, bankName, bankAccountName, bankAccountNumber, bankBranch)
                            },
                            loading = state.submitting,
                            modifier = Modifier.weight(2f),
                        )
                    }
                }
            }

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(label: String, value: String, options: List<String>, onSelected: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label, fontSize = 12.sp) },
            placeholder = { Text("Select $label", fontSize = 12.sp) },
            shape = MaterialTheme.shapes.small,
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option, fontSize = 13.sp) }, onClick = { onSelected(option); expanded = false })
            }
        }
    }
}

@Composable
private fun KycUploadRow(label: String, upload: KycUploadState, onPick: () -> Unit, onUpload: () -> Unit) {
    Column {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(6.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(120.dp)
                .border(
                    BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    RoundedCornerShape(10.dp),
                )
                .clickable(onClick = onPick),
            contentAlignment = Alignment.Center,
        ) {
            when {
                upload.contentUri != null -> AsyncImage(
                    model = upload.contentUri,
                    contentDescription = label,
                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                )
                else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Outlined.Upload, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(26.dp))
                    Text(
                        "Tap to choose a JPG/PNG/WebP image (max 8MB)",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp, start = 12.dp, end = 12.dp),
                    )
                }
            }
        }
        if (upload.error != null) {
            Text(upload.error, fontSize = 10.sp, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp))
        }
        if (upload.uploading || (upload.progress > 0f && upload.url == null)) {
            LinearProgressIndicator(
                progress = { upload.progress },
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }
        if (upload.contentUri != null && upload.url == null && !upload.uploading) {
            ZylodButton(
                text = "Upload document",
                onClick = onUpload,
                variant = com.zylod.wholesale.ui.components.ZylodButtonVariant.OUTLINED,
                height = 38.dp,
                modifier = Modifier.padding(top = 8.dp).fillMaxWidth(),
            )
        }
        if (upload.url != null) {
            Text(
                "✓ Uploaded",
                fontSize = 11.sp,
                color = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.success,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun InfoNote(icon: @Composable () -> Unit, text: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = MaterialTheme.shapes.small,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            icon()
            Spacer(Modifier.size(8.dp))
            Text(text, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
