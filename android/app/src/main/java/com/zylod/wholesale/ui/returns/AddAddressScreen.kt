package com.zylod.wholesale.ui.returns

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * SHARED typed add-address screen (pageId add-address — the ui/screens
 * delegate calls THIS, so the page keeps its own AddAddressViewModel).
 *
 * Data truth: POST api/addresses via [AddAddressViewModel] — the REAL
 * create route; an entry query carrying "addressId=…" flips the SAME form
 * into the edit surface (PUT api/addresses/{id}, plus the web edit page's
 * Delete → DELETE api/addresses/{id}). Structure mirrors
 * add-address-page.tsx 1:1: the guest gate (before typing), the
 * "Delivery Information" heading, the server error line, the Contact
 * Details section (Full Name*, Business Name optional, Phone Number* +
 * its delivery-updates hint), the Address section (Country/Region*
 * dropdown with the web COUNTRIES list, Street Address* plus the optional
 * second line, City*, Postal/Zip Code*), the "Set as default shipping
 * address" checkbox, and the Save/Cancel pair with the web's exact
 * validation + network/server error copy ("Update Address"/"Delete" in
 * edit mode — the web edit-address-page's button labels). Success pops
 * back (web goBack()); delete success jumps back to the address book
 * (web navigate('shipping-address')); nothing fake is rendered on the way
 * out.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddAddressScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddAddressViewModel = viewModel(key = "native-add-address-$pageId") {
        AddAddressViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    // Real 201/200 → pop back, exactly the web's goBack() (the address
    // book re-reads the fresh book on re-entry).
    LaunchedEffect(state.saved) {
        if (state.saved) onBack?.invoke()
    }

    // Real DELETE 200 → jump back to the address book, the web edit page's
    // navigate('shipping-address') (the same component the address-book
    // pageId renders).
    LaunchedEffect(state.deleted) {
        if (state.deleted) openPage("address-book", "")
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            AddAddressTopBar(
                onBack = onBack,
                title = if (state.isEdit) "Edit Address" else "Add New Address",
            )
        },
        bottomBar = {
            if (!state.needsAuth) {
                SaveBar(
                    isEdit = state.isEdit,
                    saving = state.saving,
                    deleting = state.deleting,
                    onSave = vm::save,
                    onDelete = vm::delete,
                    onCancel = { onBack?.invoke() },
                )
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            if (state.needsAuth) {
                AddAddressAuthGate()
            } else {
                AddAddressForm(state = state, vm = vm)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddAddressTopBar(onBack: (() -> Unit)?, title: String) {
    Column {
        TopAppBar(
            title = {
                Text(
                    title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                )
            },
            navigationIcon = {
                if (onBack != null) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
        )
        // The web header's 2dp primary underline accent.
        Box(
            Modifier
                .fillMaxWidth()
                .height(2.dp)
                .background(MaterialTheme.colorScheme.primary),
        )
    }
}

/* ─── form ───────────────────────────────────────────────────────────────── */

@Composable
private fun AddAddressForm(state: AddAddressUiState, vm: AddAddressViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text(
            "Delivery Information",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )

        state.serverError?.let { message ->
            val error = MaterialTheme.colorScheme.error
            Surface(
                color = error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(16.dp)),
            ) {
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                    modifier = Modifier.padding(16.dp),
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionHeader("Contact Details")
            LabeledField(
                label = "Full Name",
                required = true,
                value = state.form.fullName,
                error = state.errors["fullName"],
                placeholder = "e.g. John Doe",
                onValueChange = { vm.setField("fullName", it) },
            )
            LabeledField(
                label = "Business Name",
                required = false,
                optionalHint = "(Optional)",
                value = state.form.businessName,
                error = null,
                placeholder = "e.g. Acme Corp",
                onValueChange = { vm.setField("businessName", it) },
            )
            Column {
                LabeledField(
                    label = "Phone Number",
                    required = true,
                    value = state.form.phone,
                    error = state.errors["phone"],
                    placeholder = "+1 (555) 000-0000",
                    leadingIcon = {
                        Icon(
                            Icons.Outlined.Phone,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    },
                    onValueChange = { vm.setField("phone", it) },
                )
                Text(
                    "Used for delivery updates.",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp),
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SectionHeader("Address")
            CountryDropdown(
                selected = state.form.country,
                error = state.errors["country"],
                onSelected = { vm.setField("country", it) },
            )
            Column {
                LabeledField(
                    label = "Street Address",
                    required = true,
                    value = state.form.streetLine1,
                    error = state.errors["streetLine1"],
                    placeholder = "Street address, P.O. box, company name, c/o",
                    onValueChange = { vm.setField("streetLine1", it) },
                )
                LabeledField(
                    label = "",
                    required = false,
                    value = state.form.streetLine2,
                    error = null,
                    placeholder = "Apartment, suite, unit, building, floor, etc. (Optional)",
                    onValueChange = { vm.setField("streetLine2", it) },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            LabeledField(
                label = "City",
                required = true,
                value = state.form.city,
                error = state.errors["city"],
                placeholder = "",
                onValueChange = { vm.setField("city", it) },
            )
            LabeledField(
                label = "Postal/Zip Code",
                required = true,
                value = state.form.postalCode,
                error = state.errors["postalCode"],
                placeholder = "",
                onValueChange = { vm.setField("postalCode", it) },
            )
        }

        // Default-address toggle (web checkbox row).
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Checkbox(checked = state.form.setAsDefault, onCheckedChange = { vm.setDefault(it) })
            Spacer(Modifier.width(8.dp))
            Text(
                "Set as default shipping address",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}

/** The web's bordered, letter-spaced ALL-CAPS section headers. */
@Composable
private fun SectionHeader(title: String) {
    Column {
        Text(
            title.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 2.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Box(
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)),
        )
    }
}

@Composable
private fun LabeledField(
    label: String,
    required: Boolean,
    value: String,
    error: String?,
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    optionalHint: String? = null,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    Column(modifier.fillMaxWidth()) {
        if (label.isNotEmpty()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    label,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.width(2.dp))
                if (required) {
                    Text(
                        "*",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                optionalHint?.let {
                    Spacer(Modifier.width(2.dp))
                    Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(6.dp))
        }
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = if (placeholder.isEmpty()) {
                null
            } else {
                { Text(placeholder, fontSize = 12.sp) }
            },
            leadingIcon = leadingIcon,
            isError = error != null,
            supportingText = error?.let { message ->
                { Text(message, fontSize = 10.sp, color = MaterialTheme.colorScheme.error) }
            },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** The web country <select> — "Select a country" + the exact COUNTRIES list. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CountryDropdown(selected: String, error: String?, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Country/Region",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.width(2.dp))
            Text(
                "*",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Spacer(Modifier.height(6.dp))
        ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
            OutlinedTextField(
                value = selected,
                onValueChange = {},
                readOnly = true,
                placeholder = { Text("Select a country", fontSize = 12.sp) },
                isError = error != null,
                supportingText = error?.let { message ->
                    { Text(message, fontSize = 10.sp, color = MaterialTheme.colorScheme.error) }
                },
                shape = RoundedCornerShape(16.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                trailingIcon = {
                    Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
            )
            ExposedDropdownMenu(expanded = expanded.value, onDismissRequest = { expanded.value = false }) {
                DropdownMenuItem(
                    text = { Text("Select a country", fontSize = 12.sp) },
                    onClick = {
                        onSelected("")
                        expanded.value = false
                    },
                )
                ADDRESS_COUNTRIES.forEach { country ->
                    DropdownMenuItem(
                        text = { Text(country, fontSize = 12.sp) },
                        onClick = {
                            onSelected(country)
                            expanded.value = false
                        },
                    )
                }
            }
        }
    }
}

/* ─── sticky save bar ────────────────────────────────────────────────────── */

@Composable
private fun SaveBar(
    isEdit: Boolean,
    saving: Boolean,
    deleting: Boolean,
    onSave: () -> Unit,
    onDelete: () -> Unit,
    onCancel: () -> Unit,
) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = onSave,
                enabled = !saving && !deleting,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Icon(Icons.Outlined.Save, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    when {
                        saving && isEdit -> "Updating..."
                        saving -> "Saving..."
                        isEdit -> "Update Address"
                        else -> "Save Address"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            // Edit mode only — the web edit-address-page's red delete row
            // (no confirm dialog on the web either; failures surface in the
            // form's server error line).
            if (isEdit) {
                OutlinedButton(
                    onClick = onDelete,
                    enabled = !deleting && !saving,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = error,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                ) {
                    Icon(Icons.Outlined.Delete, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (deleting) "Deleting..." else "Delete",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            OutlinedButton(
                onClick = onCancel,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
            ) {
                Text("Cancel", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * Honest gate for signed-out buyers (web AccountGate copy) — addresses are
 * user-scoped, so guests are gated BEFORE they type an address that could
 * never be saved to an account.
 */
@Composable
private fun AddAddressAuthGate() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Sign in to add an address",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Delivery addresses are saved to your account. Sign in to add yours.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
