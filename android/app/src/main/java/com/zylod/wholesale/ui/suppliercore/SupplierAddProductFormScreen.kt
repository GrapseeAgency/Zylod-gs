package com.zylod.wholesale.ui.suppliercore

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddAPhoto
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t271 — SHARED typed Add-Product form (pageId "supplier-add-product", the
 * seller-add-product-page.tsx port). One scrolling form of family-styled
 * section cards: CATEGORY (public GET api/categories flattened into
 * breadcrumb options), BASICS, PRICING & UNITS (the 7 contract units + the
 * non-pcs bundle hint + ৳-prefixed base price + the customizable switch),
 * IMAGES (real multipart uploads with per-row uploading/ready/error state),
 * PRICE TIERS and VARIANTS (row editors), then the Publish button with the
 * moderation-queue footnote.
 *
 * Gates mirror the web AccountGate exactly: signed-out sellers get
 * "Seller sign-in required", non-supplier sessions get "Supplier accounts
 * only" — never a doomed form. Success replaces the form ONLY on a real
 * 201 with the pending-admin-review panel. The ViewModel
 * ([SupplierAddProductFormViewModel]) owns every wire call and all
 * validation; this file renders state and forwards intents.
 */
@Composable
fun SupplierAddProductFormScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: SupplierAddProductFormViewModel = viewModel(key = "supplier-add-product-form") {
        SupplierAddProductFormViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-entry (e.g. back from the login page pushed over the gate): the
    // session gate re-runs so signing in lands the seller inside the form.
    LaunchedEffect(Unit) { vm.recheckGate() }

    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        vm.onImagePicked(uri)
    }

    SupplierCorePageScaffold(title = "Add New Product", onBack = onBack) {
        when (val auth = state.authState) {
            SupplierFormsAuthState.Checking -> SupplierCoreCenterSpinner()
            SupplierFormsAuthState.SignedOut -> SupplierAddProductGatePanel(
                title = "Seller sign-in required",
                message = "Adding a product publishes to your supplier catalog. " +
                    "Sign in with a supplier account to continue.",
                buttonLabel = "Sign in",
                buttonContainer = MaterialTheme.colorScheme.error,
                buttonContent = MaterialTheme.colorScheme.onError,
                onButton = { openPage("login", "") },
            )
            is SupplierFormsAuthState.NotSupplier -> SupplierAddProductGatePanel(
                title = "Supplier accounts only",
                message = "Adding products belongs to supplier accounts — " +
                    "you are signed in as a ${auth.userType}.",
                buttonLabel = "Become a supplier",
                buttonContainer = MaterialTheme.colorScheme.primary,
                buttonContent = MaterialTheme.colorScheme.onPrimary,
                onButton = { openPage("supplier-onboarding", "") },
            )
            SupplierFormsAuthState.Allowed -> {
                val success = state.success
                if (success != null) {
                    SupplierAddProductSuccessPanel(onListings = { openPage("supplier-products", "") })
                } else {
                    SupplierAddProductFormBody(
                        state = state,
                        vm = vm,
                        openPage = openPage,
                        onPickImage = { imagePicker.launch("image/*") },
                    )
                }
            }
        }
    }
}

/** AccountGate port — lock glyph, honest title + message, one way forward. */
@Composable
private fun SupplierAddProductGatePanel(
    title: String,
    message: String,
    buttonLabel: String,
    buttonContainer: Color,
    buttonContent: Color,
    onButton: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Surface(
            shape = RoundedCornerShape(50),
            color = MaterialTheme.colorScheme.surfaceVariant,
        ) {
            Icon(
                Icons.Outlined.Lock,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .padding(20.dp)
                    .size(32.dp),
            )
        }
        Text(
            title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            message,
            fontSize = 12.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onButton,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = buttonContainer,
                contentColor = buttonContent,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .heightIn(min = 44.dp),
        ) {
            Text(buttonLabel, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * The inline error banner (web role="alert" red card): warning glyph, the
 * message VERBATIM, liveRegion so screen readers announce it — and a red
 * Sign in button when the error is an authentication problem (web parity).
 */
@Composable
private fun SupplierAddProductErrorBanner(
    message: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .semantics { liveRegion = LiveRegionMode.Polite },
    ) {
        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Icon(
                    Icons.Outlined.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (message.contains("Authentication") || message.contains("sign in")) {
                Button(
                    onClick = { openPage("login", "") },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .heightIn(min = 44.dp),
                ) {
                    Text("Sign in", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** The real-201 success panel — replaces the form (web-faithful copy). */
@Composable
private fun SupplierAddProductSuccessPanel(onListings: () -> Unit) {
    val success = LocalZylodExtra.current.success
    Column(
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Surface(
            color = success.copy(alpha = 0.10f),
            border = BorderStroke(1.dp, success.copy(alpha = 0.35f)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                "✓ Product created — it is pending admin review before buyers can see it.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = success,
                modifier = Modifier.padding(16.dp),
            )
        }
        SupplierRegisterPrimaryButton(
            text = "Go to my listings",
            loading = false,
            onClick = onListings,
        )
    }
}

/** One family section card (the register wizard card idiom + bold header). */
@Composable
private fun SupplierAddProductSectionCard(
    title: String,
    content: @Composable () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = supplierRegisterCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

/** One labeled field — family sizing with decimal keyboards and ৳ prefix support. */
@Composable
private fun SupplierAddProductField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minLines: Int = 1,
    prefix: (@Composable () -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = singleLine,
        minLines = minLines,
        label = { Text(label, fontSize = 12.sp) },
        placeholder = { Text(placeholder, fontSize = 13.sp) },
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType, imeAction = ImeAction.Next),
        prefix = prefix,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Inline field-level issue text (web FieldError). */
@Composable
private fun SupplierAddProductIssueText(message: String) {
    Text(
        message,
        fontSize = 11.sp,
        lineHeight = 15.sp,
        color = MaterialTheme.colorScheme.error,
        modifier = Modifier.padding(top = 4.dp),
    )
}

/** The whole form: banners + six section cards + publish + footnote. */
@Composable
private fun SupplierAddProductFormBody(
    state: SupplierAddProductFormUiState,
    vm: SupplierAddProductFormViewModel,
    openPage: (pageId: String, query: String) -> Unit,
    onPickImage: () -> Unit,
) {
    val form = state.form
    Column(
        verticalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        state.error?.let { message -> SupplierAddProductErrorBanner(message, openPage) }

        /* ── CATEGORY ── */
        SupplierAddProductSectionCard(title = "Category") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    state.categoriesLoading -> Text(
                        "Loading categories…",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    state.categories.isEmpty() -> {
                        Text(
                            "No categories exist yet — products need a real category. " +
                                "Ask an admin to create marketplace categories first.",
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            color = LocalZylodExtra.current.warning,
                        )
                        TextButton(
                            onClick = vm::loadCategories,
                            modifier = Modifier.heightIn(min = 44.dp),
                        ) {
                            Text(
                                "Retry",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                    else -> {
                        SupplierRegisterDropdown(
                            label = "Category",
                            value = form.categoryId,
                            options = state.categories.map { option -> option.id to option.label },
                            onSelected = vm::selectCategory,
                        )
                        state.fieldIssues["categoryId"]?.let { SupplierAddProductIssueText(it) }
                    }
                }
            }
        }

        /* ── BASICS ── */
        SupplierAddProductSectionCard(title = "Basics") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SupplierAddProductField(
                    value = form.name,
                    onValueChange = vm::setName,
                    label = "Product name *",
                    placeholder = "e.g., Premium Cotton T-Shirt",
                )
                state.fieldIssues["name"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.brand,
                    onValueChange = vm::setBrand,
                    label = "Brand (optional)",
                    placeholder = "e.g., Zylod Basics",
                )
                state.fieldIssues["brand"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.sku,
                    onValueChange = vm::setSku,
                    label = "SKU (optional)",
                    placeholder = "Stock keeping unit code",
                )
                state.fieldIssues["sku"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.description,
                    onValueChange = vm::setDescription,
                    label = "Description *",
                    placeholder = "Materials, sizes, packaging, wholesale terms…",
                    singleLine = false,
                    minLines = 3,
                )
                state.fieldIssues["description"]?.let { SupplierAddProductIssueText(it) }
            }
        }

        /* ── PRICING & UNITS ── */
        SupplierAddProductSectionCard(title = "Pricing & Units") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SupplierRegisterDropdown(
                    label = "Unit",
                    value = form.unit,
                    options = SUPPLIER_FORM_UNIT_OPTIONS,
                    onSelected = vm::setUnit,
                )
                SupplierAddProductField(
                    value = form.bundleSize,
                    onValueChange = vm::setBundleSize,
                    label = "Bundle size (units per bundle, optional)",
                    placeholder = if (form.unit == "bundle") "e.g., 50" else "Leave empty to sell single units",
                    keyboardType = KeyboardType.Decimal,
                )
                if (form.unit != "pcs") {
                    Text(
                        SUPPLIER_FORM_BUNDLE_HINT,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.fieldIssues["bundleSize"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.weightKg,
                    onValueChange = vm::setWeightKg,
                    label = "Weight per unit (kg, optional)",
                    placeholder = "e.g., 12.5",
                    keyboardType = KeyboardType.Decimal,
                )
                state.fieldIssues["weightKg"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.moq,
                    onValueChange = vm::setMoq,
                    label = "MOQ (minimum order) *",
                    placeholder = if (form.unit == "kg") "e.g., 10" else "e.g., 50",
                    keyboardType = KeyboardType.Decimal,
                )
                state.fieldIssues["moq"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.maxOrderQty,
                    onValueChange = vm::setMaxOrderQty,
                    label = "Max order qty (optional)",
                    placeholder = "No limit if empty",
                    keyboardType = KeyboardType.Decimal,
                )
                state.fieldIssues["maxOrderQty"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.basePrice,
                    onValueChange = vm::setBasePrice,
                    label = "Base price (BDT) *",
                    placeholder = "e.g., 450",
                    keyboardType = KeyboardType.Decimal,
                    prefix = { Text("৳", fontSize = 13.sp) },
                )
                state.fieldIssues["basePrice"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.stockQuantity,
                    onValueChange = vm::setStockQuantity,
                    label = "Stock quantity *",
                    placeholder = if (form.unit == "kg") "e.g., 250.5" else "e.g., 1200",
                    keyboardType = KeyboardType.Decimal,
                )
                state.fieldIssues["stockQuantity"]?.let { SupplierAddProductIssueText(it) }
                SupplierAddProductField(
                    value = form.stockAlertThreshold,
                    onValueChange = vm::setStockAlertThreshold,
                    label = "Low-stock alert threshold (optional)",
                    placeholder = "Default 5 — e.g. 10 for bulk-heavy stock",
                    keyboardType = KeyboardType.Decimal,
                )
                state.fieldIssues["stockAlertThreshold"]?.let { SupplierAddProductIssueText(it) }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp),
                ) {
                    Text(
                        "Supports custom orders (customizable)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    Switch(checked = form.isCustomizable, onCheckedChange = vm::setIsCustomizable)
                }
            }
        }

        /* ── IMAGES ── */
        SupplierAddProductSectionCard(title = "Images") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "PNG, JPG, WebP up to 8MB each — the first image becomes the thumbnail.",
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = onPickImage,
                    modifier = Modifier.heightIn(min = 44.dp),
                ) {
                    Icon(
                        Icons.Outlined.AddAPhoto,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Add images", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
                if (state.imageRows.isEmpty()) {
                    Text(
                        "No images uploaded yet.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.imageRows.forEachIndexed { index, row ->
                    SupplierAddProductImageRowCard(
                        row = row,
                        label = "Product image ${index + 1}",
                        isThumb = index == 0 && row.status == SupplierFormsImageStatus.READY,
                        onRemove = { vm.removeImageRow(row.id) },
                    )
                }
            }
        }

        /* ── PRICE TIERS ── */
        SupplierAddProductSectionCard(title = "Price Tiers") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Tiered wholesale pricing",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(
                        onClick = vm::addTier,
                        modifier = Modifier.heightIn(min = 44.dp),
                    ) {
                        Text(
                            "Add tier",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Text(
                    "Tier price must be ≤ the base price (wholesale discount)",
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                state.fieldIssues["priceTiers"]?.let { SupplierAddProductIssueText(it) }
                if (state.tierRows.isEmpty()) {
                    Text(
                        "No tiers — buyers pay the base price at every quantity. Add a tier for volume discounts.",
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.tierRows.forEachIndexed { index, row ->
                    SupplierAddProductTierRowEditor(
                        index = index,
                        row = row,
                        fieldIssues = state.fieldIssues,
                        vm = vm,
                    )
                }
            }
        }

        /* ── VARIANTS ── */
        SupplierAddProductSectionCard(title = "Variants") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Variants (optional)",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(
                        onClick = vm::addVariant,
                        modifier = Modifier.heightIn(min = 44.dp),
                    ) {
                        Text(
                            "Add variant",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                if (state.variantRows.isEmpty()) {
                    Text(
                        "No variants — the listing sells one undivided SKU. Add rows for options like Color: Red.",
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.variantRows.forEachIndexed { index, row ->
                    SupplierAddProductVariantRowEditor(
                        index = index,
                        row = row,
                        fieldIssues = state.fieldIssues,
                        vm = vm,
                    )
                }
            }
        }

        SupplierRegisterPrimaryButton(
            text = if (state.submitting) "Publishing…" else "Publish Product",
            loading = state.submitting,
            onClick = vm::submit,
        )
        Text(
            "New listings go to the moderation queue — an admin approves them before buyers can see them.",
            fontSize = 11.sp,
            lineHeight = 15.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(8.dp))
    }
}

/** One image row: thumbnail / upload spinner / error text + remove. */
@Composable
private fun SupplierAddProductImageRowCard(
    row: SupplierFormsImageRow,
    label: String,
    isThumb: Boolean,
    onRemove: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
        border = supplierRegisterCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(verticalAlignment = Alignment.Top) {
                AsyncImage(
                    model = if (row.status == SupplierFormsImageStatus.READY) row.displayUrl else row.localUri,
                    contentDescription = label,
                    contentScale = ContentScale.Fit, // t277-1d: product art never crops (web object-contain parity)
                    modifier = Modifier
                        .padding(8.dp)
                        .size(72.dp),
                )
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .weight(1f)
                        .padding(top = 10.dp, end = 8.dp),
                ) {
                    when (row.status) {
                        SupplierFormsImageStatus.UPLOADING -> Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "Uploading…",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        SupplierFormsImageStatus.READY -> Row(verticalAlignment = Alignment.CenterVertically) {
                            if (isThumb) {
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = MaterialTheme.colorScheme.primary,
                                ) {
                                    Text(
                                        "Thumb",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                                    )
                                }
                                Spacer(Modifier.width(6.dp))
                            }
                            Text(
                                "Uploaded",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                        SupplierFormsImageStatus.ERROR -> Text(
                            row.error,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
            TextButton(
                onClick = onRemove,
                modifier = Modifier
                    .padding(start = 8.dp, bottom = 6.dp)
                    .heightIn(min = 44.dp),
            ) {
                Icon(
                    Icons.Outlined.Close,
                    contentDescription = "Remove $label",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "Remove",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

/** One tier row: min/max pair, then price + remove (web's mobile stack). */
@Composable
private fun SupplierAddProductTierRowEditor(
    index: Int,
    row: SupplierFormsTierRow,
    fieldIssues: Map<String, String>,
    vm: SupplierAddProductFormViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.minQty,
                    onValueChange = { value -> vm.updateTier(index) { it.copy(minQty = value) } },
                    label = "Tier ${index + 1} min qty *",
                    placeholder = "Min",
                    keyboardType = KeyboardType.Decimal,
                )
                fieldIssues["priceTiers.$index.minQty"]?.let { SupplierAddProductIssueText(it) }
            }
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.maxQty,
                    onValueChange = { value -> vm.updateTier(index) { it.copy(maxQty = value) } },
                    label = "Tier ${index + 1} max qty",
                    placeholder = "Max (empty = open)",
                    keyboardType = KeyboardType.Decimal,
                )
                fieldIssues["priceTiers.$index.maxQty"]?.let { SupplierAddProductIssueText(it) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.pricePerUnit,
                    onValueChange = { value -> vm.updateTier(index) { it.copy(pricePerUnit = value) } },
                    label = "Tier ${index + 1} price / unit *",
                    placeholder = "Price",
                    keyboardType = KeyboardType.Decimal,
                    prefix = { Text("৳", fontSize = 13.sp) },
                )
                fieldIssues["priceTiers.$index.pricePerUnit"]?.let { SupplierAddProductIssueText(it) }
            }
            IconButton(onClick = { vm.removeTier(index) }, modifier = Modifier.size(48.dp)) {
                Icon(
                    Icons.Outlined.Delete,
                    contentDescription = "Remove tier ${index + 1}",
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

/** One variant row: name/value, sku/stock, override + remove. */
@Composable
private fun SupplierAddProductVariantRowEditor(
    index: Int,
    row: SupplierFormsVariantRow,
    fieldIssues: Map<String, String>,
    vm: SupplierAddProductFormViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.variantName,
                    onValueChange = { value -> vm.updateVariant(index) { it.copy(variantName = value) } },
                    label = "Variant ${index + 1} name *",
                    placeholder = "e.g., Color",
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.variantValue,
                    onValueChange = { value -> vm.updateVariant(index) { it.copy(variantValue = value) } },
                    label = "Variant ${index + 1} value *",
                    placeholder = "e.g., Red",
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.sku,
                    onValueChange = { value -> vm.updateVariant(index) { it.copy(sku = value) } },
                    label = "Variant ${index + 1} SKU",
                    placeholder = "SKU",
                )
                fieldIssues["variants.$index.sku"]?.let { SupplierAddProductIssueText(it) }
            }
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.stockQuantity,
                    onValueChange = { value -> vm.updateVariant(index) { it.copy(stockQuantity = value) } },
                    label = "Variant ${index + 1} stock",
                    placeholder = "Stock",
                    keyboardType = KeyboardType.Decimal,
                )
                fieldIssues["variants.$index.stockQuantity"]?.let { SupplierAddProductIssueText(it) }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                SupplierAddProductField(
                    value = row.priceOverride,
                    onValueChange = { value -> vm.updateVariant(index) { it.copy(priceOverride = value) } },
                    label = "Variant ${index + 1} price override",
                    placeholder = "Override",
                    keyboardType = KeyboardType.Decimal,
                    prefix = { Text("৳", fontSize = 13.sp) },
                )
                fieldIssues["variants.$index.priceOverride"]?.let { SupplierAddProductIssueText(it) }
            }
            IconButton(onClick = { vm.removeVariant(index) }, modifier = Modifier.size(48.dp)) {
                Icon(
                    Icons.Outlined.Delete,
                    contentDescription = "Remove variant ${index + 1}",
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}
