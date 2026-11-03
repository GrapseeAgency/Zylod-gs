package com.zylod.wholesale.ui.suppliercore

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupplierFormsCategoryNode
import com.zylod.wholesale.data.api.SupplierFormsCreatePayload
import com.zylod.wholesale.data.api.SupplierFormsImagePayload
import com.zylod.wholesale.data.api.SupplierFormsTierPayload
import com.zylod.wholesale.data.api.SupplierFormsVariantPayload
import com.zylod.wholesale.data.api.parseSupplierFormsError
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * t271 — Add-Product form VM (pageId "supplier-add-product"): the honest
 * Kotlin port of seller-add-product-page.tsx against the canonical
 * productPayloadSchema (src/lib/product-contract.ts).
 *
 *  - GATE: SessionManager token + cached user JSON decide
 *    signedOut / notSupplier(userType) / allowed BEFORE anything renders —
 *    the web AccountGate semantics (an authenticated session WITHOUT a
 *    readable user object is NOT gated to notSupplier). The gate is
 *    re-checked on re-entry through [recheckGate] so signing in from the
 *    login page pushed on top of the gate lands the seller in the form.
 *  - CATEGORIES: GET api/categories is public; the tree is flattened into
 *    "Root" / "Root › Child" breadcrumb options carrying the node's own id.
 *  - IMAGES: ContentResolver-validated picks (size + MIME, t270 KYC rules)
 *    upload ONE AT A TIME through multipart api/uploads/product-media
 *    (field `file`); each row carries its own uploading/ready/error state
 *    and the server's verbatim error. First ready row = thumbnailUrl.
 *  - VALIDATION: every Zod rule + the tier superRefine block mirror the
 *    contract client-side BEFORE any network call, with the same verbatim
 *    messages; garbage numbers surface a per-field message instead of
 *    reaching the wire. Non-pcs + bundleSize ≤ 1 is the same pre-submit
 *    block the web applies.
 *  - SUBMIT: success ONLY on a real 201 (no fake completion); every server
 *    error line is surfaced verbatim, fieldIssues first-msg-per-field; 401
 *    flips the gate back to signedOut. NO notSeller-from-403 conflation —
 *    403 is a normal error banner (a seller session may still lack its
 *    completed supplierProfiles row).
 */
data class SupplierAddProductFormUiState(
    val authState: SupplierFormsAuthState = SupplierFormsAuthState.Checking,
    val categories: List<SupplierFormsCategoryOption> = emptyList(),
    val categoriesLoading: Boolean = false,
    val form: SupplierFormsFormFields = SupplierFormsFormFields(),
    val imageRows: List<SupplierFormsImageRow> = emptyList(),
    val tierRows: List<SupplierFormsTierRow> = listOf(SupplierFormsTierRow()),
    val variantRows: List<SupplierFormsVariantRow> = emptyList(),
    val submitting: Boolean = false,
    val error: String? = null,
    /** First message per wire field (dot-path keys — server issues land verbatim). */
    val fieldIssues: Map<String, String> = emptyMap(),
    /** Set ONLY on a real 201 — replaces the form with the success panel. */
    val success: SupplierFormsSuccess? = null,
)

/** AccountGate states (Checking never lingers — native reads the session synchronously). */
sealed interface SupplierFormsAuthState {
    data object Checking : SupplierFormsAuthState
    data object SignedOut : SupplierFormsAuthState
    data class NotSupplier(val userType: String) : SupplierFormsAuthState
    data object Allowed : SupplierFormsAuthState
}

/** One flattened category picker option ("Root" / "Root › Child" + the node's own id). */
data class SupplierFormsCategoryOption(val id: String, val label: String)

/**
 * The form fields — one immutable snapshot mirroring web EMPTY_PRODUCT_FORM
 * defaults (unit "pcs", everything else ""), plus the category display label
 * the picker needs. Plain honest stateful UI: never cached, never seeded.
 */
data class SupplierFormsFormFields(
    val name: String = "",
    val categoryId: String = "",
    val categoryLabel: String = "",
    val brand: String = "",
    val sku: String = "",
    val description: String = "",
    val unit: String = "pcs",
    /** Empty string = plain single units (products.bundleSize null). */
    val bundleSize: String = "",
    /** Empty string = un-quoted weight (products.weightKg null). */
    val weightKg: String = "",
    val moq: String = "",
    val maxOrderQty: String = "",
    val basePrice: String = "",
    val stockQuantity: String = "",
    /** Empty string = platform default threshold. */
    val stockAlertThreshold: String = "",
    val isCustomizable: Boolean = false,
)

/** One product image row: picked → uploading → ready(server path) | error. */
data class SupplierFormsImageRow(
    val id: Long,
    val localUri: String,
    val displayName: String,
    val mime: String,
    val status: SupplierFormsImageStatus = SupplierFormsImageStatus.UPLOADING,
    /** The returned /uploads/products path — rides the payload verbatim. */
    val remoteUrl: String = "",
    /** base + remoteUrl — the full URL Coil renders for ready rows. */
    val displayUrl: String = "",
    val error: String = "",
)

enum class SupplierFormsImageStatus { UPLOADING, READY, ERROR }

/** One wholesale tier row — "" max = open-ended (null on the wire). */
data class SupplierFormsTierRow(
    val minQty: String = "",
    val maxQty: String = "",
    val pricePerUnit: String = "",
)

/** One variant row — "" price override = no override (null on the wire). */
data class SupplierFormsVariantRow(
    val variantName: String = "",
    val variantValue: String = "",
    val sku: String = "",
    val stockQuantity: String = "",
    val priceOverride: String = "",
)

/** Real 201 outcome — productId + the server's own message. */
data class SupplierFormsSuccess(val productId: String, val message: String)

/** Unit dropdown pairs — wire value + the contract's friendly label. */
internal val SUPPLIER_FORM_UNIT_OPTIONS = listOf(
    "pcs" to "Pieces (pcs)",
    "dozen" to "Dozen",
    "kg" to "Kilograms (kg)",
    "carton" to "Carton",
    "box" to "Box",
    "set" to "Set",
    "bundle" to "Bundle (units per bundle)",
)

/** The verbatim web block message + on-screen hint for non-pcs bundles. */
internal const val SUPPLIER_FORM_BUNDLE_HINT =
    "Bundle size must be greater than 1 (units per bundle) — or leave it empty for single units."

class SupplierAddProductFormViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupplierAddProductFormUiState())
    val state: StateFlow<SupplierAddProductFormUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var uploadJob: Job? = null
    private var nextImageRowId: Long = 1L

    init {
        resolveGate()
    }

    /* ─── Session gate ─── */

    /**
     * Web AccountGate mirror: no token → signedOut; a readable userType that
     * is neither supplier nor admin → notSupplier(userType); a session
     * without a readable user object passes through (web: `user &&` guard);
     * otherwise allowed → pull categories.
     */
    private fun resolveGate() {
        val token = SessionManager.token()
        if (token == null) {
            _state.update { it.copy(authState = SupplierFormsAuthState.SignedOut) }
            return
        }
        val raw = SessionManager.userJson()
        val userType = raw?.let { json ->
            runCatching {
                ApiClient.json.decodeFromString(SupplierFormsSessionUser.serializer(), json)
            }.getOrNull()?.userType.orEmpty().trim()
        } ?: ""
        if (userType.isNotEmpty() && userType != "supplier" && userType != "admin") {
            Log.i(TAG, "gate: notSupplier userType=$userType")
            _state.update { it.copy(authState = SupplierFormsAuthState.NotSupplier(userType)) }
            return
        }
        Log.i(TAG, "gate: allowed — pulling categories")
        _state.update { it.copy(authState = SupplierFormsAuthState.Allowed) }
        loadCategories()
    }

    /** Re-entry hook: signing in on the login page pushed over the gate. */
    fun recheckGate() {
        if (_state.value.authState == SupplierFormsAuthState.Allowed) return
        resolveGate()
    }

    /* ─── Categories ─── */

    /**
     * Public GET api/categories. Failure leaves the picker honestly empty
     * with a retry affordance — never a fabricated tree (web-faithful).
     */
    fun loadCategories() {
        if (_state.value.authState != SupplierFormsAuthState.Allowed) return
        if (_state.value.categoriesLoading) return
        _state.update { it.copy(categoriesLoading = true) }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.supplierFormsApi(base).categories()
                val body = response.body()
                val options = if (response.isSuccessful && body?.success == true) {
                    flattenCategories(body.data)
                } else {
                    Log.w(TAG, "categories http=${response.code()} — picker stays empty")
                    emptyList()
                }
                _state.update { it.copy(categories = options, categoriesLoading = false) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "categories fetch failed: ${e.message}")
                _state.update { it.copy(categories = emptyList(), categoriesLoading = false) }
            }
        }
    }

    /** Depth-first flatten: each node becomes one option carrying its own id. */
    private fun flattenCategories(
        nodes: List<SupplierFormsCategoryNode>,
        prefix: String = "",
    ): List<SupplierFormsCategoryOption> = nodes.flatMap { node ->
        val label = if (prefix.isEmpty()) node.name else "$prefix › ${node.name}"
        listOf(SupplierFormsCategoryOption(id = node.id, label = label)) +
            flattenCategories(node.children, label)
    }

    /* ─── Field setters — one per editable field, family StateFlow idiom ─── */

    fun setName(value: String) = patchForm { it.copy(name = value) }
    fun setBrand(value: String) = patchForm { it.copy(brand = value) }
    fun setSku(value: String) = patchForm { it.copy(sku = value) }
    fun setDescription(value: String) = patchForm { it.copy(description = value) }
    fun setUnit(value: String) = patchForm { it.copy(unit = value) }
    fun setBundleSize(value: String) = patchForm { it.copy(bundleSize = value) }
    fun setWeightKg(value: String) = patchForm { it.copy(weightKg = value) }
    fun setMoq(value: String) = patchForm { it.copy(moq = value) }
    fun setMaxOrderQty(value: String) = patchForm { it.copy(maxOrderQty = value) }
    fun setBasePrice(value: String) = patchForm { it.copy(basePrice = value) }
    fun setStockQuantity(value: String) = patchForm { it.copy(stockQuantity = value) }
    fun setStockAlertThreshold(value: String) = patchForm { it.copy(stockAlertThreshold = value) }
    fun setIsCustomizable(value: Boolean) = patchForm { it.copy(isCustomizable = value) }

    fun selectCategory(id: String) {
        val label = _state.value.categories.firstOrNull { it.id == id }?.label.orEmpty()
        patchForm { it.copy(categoryId = id, categoryLabel = label) }
    }

    private fun patchForm(patch: (SupplierFormsFormFields) -> SupplierFormsFormFields) {
        // Web handleFormChange: every edit clears the banner error (the
        // inline field issues stay until the next submit, same as the web).
        _state.update { it.copy(form = patch(it.form), error = null) }
    }

    /* ─── Tier / variant row editors ─── */

    fun updateTier(index: Int, transform: (SupplierFormsTierRow) -> SupplierFormsTierRow) =
        _state.update { s ->
            s.copy(tierRows = s.tierRows.mapIndexed { i, row -> if (i == index) transform(row) else row })
        }

    fun addTier() = _state.update { it.copy(tierRows = it.tierRows + SupplierFormsTierRow()) }

    fun removeTier(index: Int) =
        _state.update { s -> s.copy(tierRows = s.tierRows.filterIndexed { i, _ -> i != index }) }

    fun updateVariant(index: Int, transform: (SupplierFormsVariantRow) -> SupplierFormsVariantRow) =
        _state.update { s ->
            s.copy(variantRows = s.variantRows.mapIndexed { i, row -> if (i == index) transform(row) else row })
        }

    fun addVariant() = _state.update { it.copy(variantRows = it.variantRows + SupplierFormsVariantRow()) }

    fun removeVariant(index: Int) =
        _state.update { s -> s.copy(variantRows = s.variantRows.filterIndexed { i, _ -> i != index }) }

    /* ─── Images: pick → validate → sequential multipart upload ─── */

    /**
     * Picker callback: uri == null means the user cancelled. Otherwise the
     * pick is validated (t270 KYC rules: 8MB via ContentResolver, jpg/png/webp)
     * and appended as an uploading row that the queue uploads in order.
     */
    fun onImagePicked(uri: Uri?) {
        if (uri == null) return
        viewModelScope.launch {
            val inspected = withContext(Dispatchers.IO) { inspectImage(uri) }
            inspected.fold(
                onSuccess = { pick ->
                    val row = SupplierFormsImageRow(
                        id = nextImageRowId++,
                        localUri = pick.uri,
                        displayName = pick.displayName,
                        mime = pick.mime,
                    )
                    _state.update { it.copy(imageRows = it.imageRows + row, error = null) }
                    pumpUploadQueue()
                },
                onFailure = { e ->
                    _state.update {
                        it.copy(error = e.message?.takeIf(String::isNotBlank) ?: UNEXPECTED_ERROR)
                    }
                },
            )
        }
    }

    fun removeImageRow(rowId: Long) =
        _state.update { s -> s.copy(imageRows = s.imageRows.filterNot { it.id == rowId }) }

    /** One-at-a-time worker: uploads rows in pick order until none are pending. */
    private fun pumpUploadQueue() {
        if (uploadJob?.isActive == true) return
        uploadJob = viewModelScope.launch {
            while (true) {
                val pending = _state.value.imageRows
                    .firstOrNull { it.status == SupplierFormsImageStatus.UPLOADING } ?: break
                uploadRow(pending)
            }
        }
    }

    private suspend fun uploadRow(row: SupplierFormsImageRow) {
        try {
            val base = resolveBase()
            val bytes = withContext(Dispatchers.IO) { readImageBytes(row) }
            Log.i(TAG, "product-media upload start row=${row.id}")
            val response = ApiClient.supplierFormsApi(base).uploadProductMedia(
                file = MultipartBody.Part.createFormData(
                    name = "file",
                    filename = imageFileName(row),
                    body = bytes.toRequestBody(imageMime(row).toMediaTypeOrNull()),
                ),
            )
            if (!response.isSuccessful) {
                val message = parseSupplierFormsError(response.errorBody()).error
                    .takeIf(String::isNotBlank)
                    ?: "Image upload failed (HTTP ${response.code()})"
                Log.w(TAG, "product-media upload failed row=${row.id} http=${response.code()}")
                markRowError(row.id, message)
                return
            }
            val body = response.body()
            val path = body?.url?.takeIf(String::isNotBlank)
            if (body == null || !body.success || path == null) {
                markRowError(row.id, "Image upload failed")
                return
            }
            Log.i(TAG, "product-media upload ok row=${row.id}")
            markRowReady(row.id, path, base.trimEnd('/') + path)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "product-media upload failed row=${row.id}: ${e.message}")
            markRowError(row.id, "Image upload failed — check your connection and retry.")
        }
    }

    private fun markRowReady(rowId: Long, remoteUrl: String, displayUrl: String) {
        _state.update { s ->
            s.copy(imageRows = s.imageRows.map { row ->
                if (row.id == rowId) {
                    row.copy(
                        status = SupplierFormsImageStatus.READY,
                        remoteUrl = remoteUrl,
                        displayUrl = displayUrl,
                        error = "",
                    )
                } else {
                    row
                }
            })
        }
    }

    private fun markRowError(rowId: Long, message: String) {
        _state.update { s ->
            s.copy(imageRows = s.imageRows.map { row ->
                if (row.id == rowId) {
                    row.copy(status = SupplierFormsImageStatus.ERROR, error = message)
                } else {
                    row
                }
            })
        }
    }

    private data class SupplierFormsPickedImage(val uri: String, val displayName: String, val mime: String)

    /** Size + MIME + display name of the picked content Uri (t270 KYC mirror, IO). */
    private fun inspectImage(uri: Uri): Result<SupplierFormsPickedImage> = runCatching {
        val resolver = appContext.contentResolver
        val size = resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        if (size > MAX_IMAGE_BYTES) error("Image too large (max 8MB)")
        val mime = resolver.getType(uri) ?: ""
        if (mime.isNotBlank() && mime !in ACCEPTED_IMAGE_MIME_TYPES) {
            // The web input filters to jpg/png/webp via accept=; GetContent
            // cannot, so the server's own rejection line is surfaced here.
            error("Only JPG, PNG, or WebP images are accepted")
        }
        var displayName = ""
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) displayName = cursor.getString(0) ?: ""
        }
        SupplierFormsPickedImage(uri = uri.toString(), displayName = displayName, mime = mime)
    }

    /** The picked image bytes (IO) — honest failure when the Uri is gone. */
    private suspend fun readImageBytes(row: SupplierFormsImageRow): ByteArray =
        withContext(Dispatchers.IO) {
            val read = runCatching {
                appContext.contentResolver.openInputStream(Uri.parse(row.localUri))?.use { it.readBytes() }
            }
            read.getOrNull() ?: throw IllegalStateException("Could not read the selected image")
        }

    /** Sensible multipart filename: provider name, or a generic image name with ext. */
    private fun imageFileName(row: SupplierFormsImageRow): String {
        val base = row.displayName.substringAfterLast('/').trim().ifBlank { "product-image" }
        return if (base.contains('.')) base else "$base.${imageExtension(row)}"
    }

    private fun imageExtension(row: SupplierFormsImageRow): String = when (row.mime) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        else -> "jpg"
    }

    /** Part content type — drives the server-side type + magic-byte check. */
    private fun imageMime(row: SupplierFormsImageRow): String = when {
        row.mime in ACCEPTED_IMAGE_MIME_TYPES -> row.mime
        else -> when (imageFileName(row).substringAfterLast('.', "").lowercase()) {
            "png" -> "image/png"
            "webp" -> "image/webp"
            "jpg", "jpeg" -> "image/jpeg"
            else -> "application/octet-stream"
        }
    }

    /* ─── Submit: mirror every Zod rule, then the real POST ─── */

    /**
     * The web handleSubmit chain, in order: uploading-images block → the
     * non-pcs bundle pre-submit block → client-side contract validation
     * (field rules first, then the tier superRefine — refinements only run
     * on an otherwise-valid payload) → the real POST. Nothing navigates or
     * succeeds on anything but a real 201.
     */
    fun submit() {
        val s = _state.value
        if (s.submitting) return
        if (s.authState != SupplierFormsAuthState.Allowed) return

        if (s.imageRows.any { it.status == SupplierFormsImageStatus.UPLOADING }) {
            _state.update { it.copy(error = "Wait for all image uploads to finish before publishing.") }
            return
        }

        val bundleSizeRaw = s.form.bundleSize.trim()
        if (s.form.unit != "pcs" && bundleSizeRaw.isNotEmpty()) {
            val n = bundleSizeRaw.toDoubleOrNull()
            if (n == null || n <= 1.0) {
                _state.update { it.copy(error = SUPPLIER_FORM_BUNDLE_HINT) }
                return
            }
        }

        val issues = validateForm(s)
        if (issues.isNotEmpty()) {
            Log.i(TAG, "submit blocked by client validation: ${issues.values.first()}")
            _state.update { it.copy(error = issues.values.first(), fieldIssues = issues) }
            return
        }

        val payload = buildPayload(s)
        Log.i(TAG, "create product submit unit=${payload.unit} tiers=${payload.priceTiers.size} variants=${payload.variants.size} images=${payload.images.size}")
        _state.update { it.copy(submitting = true, error = null, fieldIssues = emptyMap()) }
        viewModelScope.launch {
            try {
                val base = resolveBase()
                val response = ApiClient.supplierFormsApi(base).createProduct(payload)
                if (response.code() == 401) {
                    // The session died between the gate and the submit — the
                    // authenticator's refresh chain already ran and failed.
                    Log.i(TAG, "create product 401 — back to the signedOut gate")
                    _state.update { it.copy(submitting = false, authState = SupplierFormsAuthState.SignedOut) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    val err = parseSupplierFormsError(response.errorBody())
                    val message = err.error.takeIf(String::isNotBlank)
                        ?: "Product creation failed (HTTP ${response.code()})"
                    Log.w(TAG, "create product failed http=${response.code()} — ${message.take(120)}")
                    _state.update {
                        it.copy(
                            submitting = false,
                            error = message,
                            fieldIssues = err.issues.mapValues { (_, msgs) -> msgs.firstOrNull().orEmpty() }
                                .filterValues(String::isNotEmpty),
                        )
                    }
                    return@launch
                }
                val body = response.body()
                if (body == null || !body.success) {
                    _state.update {
                        it.copy(submitting = false, error = "Product creation failed (HTTP ${response.code()})")
                    }
                    return@launch
                }
                Log.i(TAG, "create product ok id=${body.data?.id}")
                _state.update {
                    it.copy(
                        submitting = false,
                        success = SupplierFormsSuccess(
                            productId = body.data?.id.orEmpty(),
                            message = body.message.ifBlank { "Product created" },
                        ),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "create product network failure: ${e.message}")
                _state.update {
                    it.copy(
                        submitting = false,
                        error = "Network error while creating the product. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /**
     * Client-side mirror of productPayloadSchema. Field rules run first (Zod
     * refinements only execute when the base parse is clean), then the tier
     * superRefine block with the contract's verbatim messages. Returns the
     * issue map in wire-field order — the FIRST entry is the banner error.
     */
    private fun validateForm(s: SupplierAddProductFormUiState): LinkedHashMap<String, String> {
        val form = s.form
        val issues = LinkedHashMap<String, String>()

        val name = form.name.trim()
        if (name.isEmpty()) {
            issues["name"] = "Product name is required"
        } else if (name.length > 200) {
            issues["name"] = "Product name must be 200 characters or fewer"
        }

        if (form.categoryId.isBlank()) issues["categoryId"] = "Category is required"

        val description = form.description.trim()
        if (description.isEmpty()) {
            issues["description"] = "Description is required"
        } else if (description.length > 10000) {
            issues["description"] = "Description must be 10,000 characters or fewer"
        }

        if (form.brand.trim().length > 100) issues["brand"] = "Brand must be 100 characters or fewer"
        if (form.sku.trim().length > 100) issues["sku"] = "SKU must be 100 characters or fewer"

        // unit is fixed by the dropdown — always one of the 7 contract values.

        when (val bundle = parseOptionalPositive(form.bundleSize, scale = 2)) {
            is SupplierFormsNum.NonPositive -> issues["bundleSize"] = "Bundle size must be greater than 0"
            is SupplierFormsNum.Garbage -> issues["bundleSize"] = "Bundle size must be a valid number"
            is SupplierFormsNum.Value -> if (bundle.n > 100000.0) {
                issues["bundleSize"] = "Bundle size cannot exceed 100,000"
            }
            SupplierFormsNum.Empty -> Unit
        }

        when (val weight = parseOptionalPositive(form.weightKg, scale = 3)) {
            is SupplierFormsNum.NonPositive -> issues["weightKg"] = "Weight must be greater than 0"
            is SupplierFormsNum.Garbage -> issues["weightKg"] = "Weight must be a valid number"
            is SupplierFormsNum.Value -> if (weight.n > 100000.0) {
                issues["weightKg"] = "Weight cannot exceed 100,000 kg"
            }
            SupplierFormsNum.Empty -> Unit
        }

        when (parseRequiredPositive(form.moq)) {
            SupplierFormsNum.Empty, is SupplierFormsNum.NonPositive ->
                issues["moq"] = "MOQ must be greater than 0"
            is SupplierFormsNum.Garbage -> issues["moq"] = "MOQ must be a valid number"
            is SupplierFormsNum.Value -> Unit
        }

        when (parseOptionalPositive(form.maxOrderQty, scale = 2)) {
            is SupplierFormsNum.NonPositive -> issues["maxOrderQty"] = "Max order quantity must be greater than 0"
            is SupplierFormsNum.Garbage -> issues["maxOrderQty"] = "Max order quantity must be a valid number"
            is SupplierFormsNum.Value, SupplierFormsNum.Empty -> Unit
        }

        when (parseRequiredPositive(form.basePrice)) {
            SupplierFormsNum.Empty, is SupplierFormsNum.NonPositive ->
                issues["basePrice"] = "Base price must be greater than 0"
            is SupplierFormsNum.Garbage -> issues["basePrice"] = "Base price must be a valid number"
            is SupplierFormsNum.Value -> Unit
        }

        when (val stock = parseOptionalAny(form.stockQuantity)) {
            SupplierFormsNum.Empty -> issues["stockQuantity"] = "Stock quantity is required"
            is SupplierFormsNum.Garbage -> issues["stockQuantity"] = "Stock quantity must be a valid number"
            // parseOptionalAny never answers NonPositive — listed for sealed exhaustiveness.
            SupplierFormsNum.NonPositive -> issues["stockQuantity"] = "Stock cannot be negative"
            is SupplierFormsNum.Value -> if (stock.n < 0.0) issues["stockQuantity"] = "Stock cannot be negative"
        }

        when (val alert = parseOptionalAny(form.stockAlertThreshold)) {
            is SupplierFormsNum.Garbage ->
                issues["stockAlertThreshold"] = "Low-stock threshold must be a valid number"
            // parseOptionalAny never answers NonPositive — listed for sealed exhaustiveness.
            SupplierFormsNum.NonPositive ->
                issues["stockAlertThreshold"] = "Low-stock threshold cannot be negative"
            is SupplierFormsNum.Value -> if (alert.n < 0.0) {
                issues["stockAlertThreshold"] = "Low-stock threshold cannot be negative"
            }
            SupplierFormsNum.Empty -> Unit
        }

        // Variants: only rows with name AND value ride the payload (web filter);
        // issues key by the FORM row index so the screen can pin them inline.
        s.variantRows.forEachIndexed { formIndex, row ->
            if (row.variantName.trim().isEmpty() || row.variantValue.trim().isEmpty()) return@forEachIndexed
            when (val stock = parseOptionalAny(row.stockQuantity)) {
                SupplierFormsNum.Empty, is SupplierFormsNum.Garbage ->
                    issues["variants.$formIndex.stockQuantity"] = "Variant stock must be a valid number"
                // parseOptionalAny never answers NonPositive — listed for sealed exhaustiveness.
                SupplierFormsNum.NonPositive ->
                    issues["variants.$formIndex.stockQuantity"] = "Variant stock cannot be negative"
                is SupplierFormsNum.Value -> if (stock.n < 0.0) {
                    issues["variants.$formIndex.stockQuantity"] = "Variant stock cannot be negative"
                }
            }
            when (val override = parseOptionalPositive(row.priceOverride, scale = 2)) {
                is SupplierFormsNum.NonPositive ->
                    issues["variants.$formIndex.priceOverride"] = "Price override must be greater than 0"
                is SupplierFormsNum.Garbage ->
                    issues["variants.$formIndex.priceOverride"] = "Price override must be a valid number"
                is SupplierFormsNum.Value, SupplierFormsNum.Empty -> Unit
            }
            if (row.sku.trim().length > 100) {
                issues["variants.$formIndex.sku"] = "Variant SKU must be 100 characters or fewer"
            }
        }

        // Price tiers: only rows with a min qty or a price ride the payload;
        // field issues key by the FORM row index, the payload order drives the
        // superRefine numbering below (the web's exact split).
        val parsedTiers = mutableListOf<SupplierFormsParsedTier>()
        s.tierRows.forEachIndexed { formIndex, row ->
            if (row.minQty.trim().isEmpty() && row.pricePerUnit.trim().isEmpty()) return@forEachIndexed
            val min = parseRequiredPositive(row.minQty)
            when (min) {
                SupplierFormsNum.Empty, is SupplierFormsNum.NonPositive ->
                    issues["priceTiers.$formIndex.minQty"] = "Tier ${formIndex + 1}: minimum quantity must be greater than 0"
                is SupplierFormsNum.Garbage ->
                    issues["priceTiers.$formIndex.minQty"] = "Tier ${formIndex + 1}: minimum quantity must be a valid number"
                is SupplierFormsNum.Value -> Unit
            }
            val max = parseOptionalPositive(row.maxQty, scale = 2)
            when (max) {
                is SupplierFormsNum.NonPositive ->
                    issues["priceTiers.$formIndex.maxQty"] = "Tier ${formIndex + 1}: maximum quantity must be greater than 0"
                is SupplierFormsNum.Garbage ->
                    issues["priceTiers.$formIndex.maxQty"] = "Tier ${formIndex + 1}: maximum quantity must be a valid number"
                is SupplierFormsNum.Value, SupplierFormsNum.Empty -> Unit
            }
            val price = parseRequiredPositive(row.pricePerUnit)
            when (price) {
                SupplierFormsNum.Empty, is SupplierFormsNum.NonPositive ->
                    issues["priceTiers.$formIndex.pricePerUnit"] = "Tier ${formIndex + 1}: tier price must be greater than 0"
                is SupplierFormsNum.Garbage ->
                    issues["priceTiers.$formIndex.pricePerUnit"] = "Tier ${formIndex + 1}: tier price must be a valid number"
                is SupplierFormsNum.Value -> Unit
            }
            if (min is SupplierFormsNum.Value && price is SupplierFormsNum.Value) {
                parsedTiers += SupplierFormsParsedTier(
                    min = min.n,
                    max = (max as? SupplierFormsNum.Value)?.n,
                    price = price.n,
                )
            }
        }

        if (issues.isNotEmpty()) return issues

        // superRefine — every tier is a wholesale discount, ranges never
        // overlap, min quantities strictly increase, one open-ended LAST tier.
        val basePrice = parseRequiredPositive(form.basePrice)
        val base = (basePrice as? SupplierFormsNum.Value)?.n ?: return issues
        val refineMessages = mutableListOf<String>()

        parsedTiers.forEachIndexed { index, tier ->
            if (tier.price > base) {
                refineMessages += "Tier ${index + 1}: tier price must be ≤ the base price (wholesale discount)"
            }
            val maxQty = tier.max
            if (maxQty != null && maxQty < tier.min) {
                refineMessages += "Tier ${index + 1}: max quantity must be ≥ min quantity"
            }
        }

        val sorted = parsedTiers.sortedBy { it.min }
        for (i in 1 until sorted.size) {
            val prev = sorted[i - 1]
            val cur = sorted[i]
            if (cur.min <= prev.min) {
                refineMessages += "Tier starting at ${fmtQty(cur.min)}: min quantities must strictly increase"
            }
            val prevMax = prev.max
            if (prevMax != null && cur.min <= prevMax) {
                refineMessages +=
                    "Tier starting at ${fmtQty(cur.min)}: quantity ranges overlap with the tier ending at ${fmtQty(prevMax)}"
            }
            if (prevMax == null) {
                refineMessages += "Only the LAST tier may be open-ended (empty max quantity)"
            }
        }

        if (refineMessages.isNotEmpty()) {
            issues["priceTiers"] = refineMessages.joinToString("\n")
        }
        return issues
    }

    /* ─── Payload build (all parsing already proven valid by validateForm) ─── */

    private fun buildPayload(s: SupplierAddProductFormUiState): SupplierFormsCreatePayload {
        val form = s.form
        val bundleSize = (parseOptionalPositive(form.bundleSize, scale = 2) as? SupplierFormsNum.Value)?.n
        val weightKg = (parseOptionalPositive(form.weightKg, scale = 3) as? SupplierFormsNum.Value)?.n
        val moq = (parseRequiredPositive(form.moq) as SupplierFormsNum.Value).n
        val maxOrderQty = (parseOptionalPositive(form.maxOrderQty, scale = 2) as? SupplierFormsNum.Value)?.n
        val basePrice = (parseRequiredPositive(form.basePrice) as SupplierFormsNum.Value).n
        val stockQuantity = (parseOptionalAny(form.stockQuantity) as SupplierFormsNum.Value).n
        val stockAlertThreshold = (parseOptionalAny(form.stockAlertThreshold) as? SupplierFormsNum.Value)?.n
        val readyRows = s.imageRows.filter { it.status == SupplierFormsImageStatus.READY }

        return SupplierFormsCreatePayload(
            name = form.name.trim(),
            categoryId = form.categoryId,
            description = form.description.trim(),
            brand = form.brand.trim().takeIf(String::isNotEmpty),
            sku = form.sku.trim().takeIf(String::isNotEmpty),
            unit = form.unit,
            bundleSize = bundleSize,
            weightKg = weightKg,
            moq = moq,
            maxOrderQty = maxOrderQty,
            basePrice = basePrice,
            currency = "BDT",
            stockQuantity = stockQuantity,
            stockAlertThreshold = stockAlertThreshold,
            isCustomizable = form.isCustomizable,
            thumbnailUrl = readyRows.firstOrNull()?.remoteUrl,
            images = readyRows.mapIndexed { index, row ->
                SupplierFormsImagePayload(imageUrl = row.remoteUrl, sortOrder = index)
            },
            variants = s.variantRows
                .filter { it.variantName.trim().isNotEmpty() && it.variantValue.trim().isNotEmpty() }
                .map { row ->
                    SupplierFormsVariantPayload(
                        variantName = row.variantName.trim(),
                        variantValue = row.variantValue.trim(),
                        sku = row.sku.trim().takeIf(String::isNotEmpty),
                        stockQuantity = (parseOptionalAny(row.stockQuantity) as SupplierFormsNum.Value).n,
                        priceOverride = (parseOptionalPositive(row.priceOverride, scale = 2) as? SupplierFormsNum.Value)?.n,
                    )
                },
            priceTiers = s.tierRows
                .filter { it.minQty.trim().isNotEmpty() || it.pricePerUnit.trim().isNotEmpty() }
                .map { row ->
                    SupplierFormsTierPayload(
                        minQty = (parseRequiredPositive(row.minQty) as SupplierFormsNum.Value).n,
                        maxQty = (parseOptionalPositive(row.maxQty, scale = 2) as? SupplierFormsNum.Value)?.n,
                        pricePerUnit = (parseRequiredPositive(row.pricePerUnit) as SupplierFormsNum.Value).n,
                    )
                },
        )
    }

    /* ─── Parsing helpers — the web's Number() semantics, kept honest ─── */

    private suspend fun resolveBase(): String =
        baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }

    private companion object {
        const val TAG = "ZylodSupplierCore"
        val MAX_IMAGE_BYTES: Long = 8L * 1024 * 1024
        val ACCEPTED_IMAGE_MIME_TYPES = setOf("image/jpeg", "image/png", "image/webp")
        const val UNEXPECTED_ERROR = "An unexpected error occurred. Please try again."
    }
}

/** Minimal session-user projection for the gate (userType only). */
@Serializable
private data class SupplierFormsSessionUser(val userType: String = "")

/** Web Number()-parse states for one raw text-field value. */
private sealed interface SupplierFormsNum {
    /** Trimmed input was empty — the optional field stays null on the wire. */
    data object Empty : SupplierFormsNum

    /** A finite number the payload can carry. */
    data class Value(val n: Double) : SupplierFormsNum

    /** Parsed but ≤ 0 — the schema's positive() rejection (or a required field left empty). */
    data object NonPositive : SupplierFormsNum

    /** Not a number at all — surfaced per-field, never sent. */
    data object Garbage : SupplierFormsNum
}

/** Web optionalQty / parseBundleSize: "" → Empty, ≤ 0 → NonPositive, garbage → Garbage. */
private fun parseOptionalPositive(raw: String, scale: Int): SupplierFormsNum {
    val t = raw.trim()
    if (t.isEmpty()) return SupplierFormsNum.Empty
    val n = t.toDoubleOrNull() ?: return SupplierFormsNum.Garbage
    if (n <= 0.0) return SupplierFormsNum.NonPositive
    return SupplierFormsNum.Value(roundToScale(n, scale))
}

/** Web Number(value) with the "" → NaN guard: any finite number passes through. */
private fun parseOptionalAny(raw: String): SupplierFormsNum {
    val t = raw.trim()
    if (t.isEmpty()) return SupplierFormsNum.Empty
    val n = t.toDoubleOrNull() ?: return SupplierFormsNum.Garbage
    return SupplierFormsNum.Value(n)
}

/** Required positive field (moq / basePrice / tier min+price): "" and ≤ 0 both fail. */
private fun parseRequiredPositive(raw: String): SupplierFormsNum {
    val t = raw.trim()
    if (t.isEmpty()) return SupplierFormsNum.Empty
    val n = t.toDoubleOrNull() ?: return SupplierFormsNum.Garbage
    if (n <= 0.0) return SupplierFormsNum.NonPositive
    return SupplierFormsNum.Value(n)
}

/** roundQty (2 dp) / roundWeight (3 dp) — float drift never reaches the wire. */
private fun roundToScale(n: Double, scale: Int): Double = when (scale) {
    2 -> Math.round(n * 100.0) / 100.0
    3 -> Math.round(n * 1000.0) / 1000.0
    else -> n
}

/** JS number interpolation (10.0 prints as "10" in the contract's messages). */
private fun fmtQty(n: Double): String =
    if (n == Math.floor(n) && !n.isInfinite()) n.toLong().toString() else n.toString()

/** One contract-valid tier (post-parse) used by the superRefine mirror. */
private data class SupplierFormsParsedTier(val min: Double, val max: Double?, val price: Double)
