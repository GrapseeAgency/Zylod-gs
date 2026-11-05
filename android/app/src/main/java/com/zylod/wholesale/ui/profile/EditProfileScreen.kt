package com.zylod.wholesale.ui.profile

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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import com.zylod.wholesale.data.api.ProfileMeDto

/** The web edit-profile page's exact business-model options (L371-374). */
private val BUSINESS_MODELS = listOf(
    "OEM / ODM Custom Manufacturer",
    "Direct Factory Wholesaler",
    "Raw Materials Supplier",
    "Export Trading House",
)

/**
 * t279 — the REAL typed edit form behind the `edit-profile` and
 * `business-profile` pageIds: GET api/profile/me prefill →
 * PATCH api/profile/me save (the web edit-profile-page.tsx:122-150 contract).
 * Field drafts live in the ViewModel, so a rotation mid-edit never wipes
 * them; the saved toast is a one-shot LaunchedEffect on [EditProfileUiState.savedTick].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(
    focus: EditProfileFocus,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: EditProfileViewModel = viewModel(
        key = "native-edit-profile-${if (focus == EditProfileFocus.BUSINESS) "business" else "general"}",
    ) {
        EditProfileViewModel(context.applicationContext, focus)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // One-shot saved toast.
    val lastToasted = remember { mutableStateOf(0) }
    var toast by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(state.savedTick) {
        if (state.savedTick > 0 && state.savedTick != lastToasted.value) {
            lastToasted.value = state.savedTick
            toast = "Profile updated"
        }
    }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(2500)
            toast = null
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (focus == EditProfileFocus.BUSINESS) "Business Profile" else "Edit Profile",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
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
        },
    ) { padding ->
        when {
            state.needsAuth -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    "Please sign in to edit your profile.",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { openPage("login", "") },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.heightIn(min = 44.dp),
                ) {
                    Text("Go to Sign In", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            state.loading -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 3.dp)
                Spacer(Modifier.height(12.dp))
                Text("Loading your profile…", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            state.error != null -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(state.error ?: "Something went wrong", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(
                    onClick = { vm.refresh() },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.heightIn(min = 44.dp),
                ) {
                    Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                toast?.let {
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            it,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
                ProfileFormSection(title = if (state.isSupplier) "Company Identity" else "Your Details") {
                    EditProfileField(
                        label = if (state.isSupplier) "Company contact name" else "Full name",
                        value = state.fullName,
                        onValueChange = vm::setFullName,
                        leadingIcon = { Icon(Icons.Outlined.Person, null, modifier = Modifier.size(18.dp)) },
                    )
                    Spacer(Modifier.height(10.dp))
                    EditProfileField(
                        label = "Phone",
                        value = state.phone,
                        onValueChange = vm::setPhone,
                        placeholder = "+880 …",
                        leadingIcon = { Icon(Icons.Outlined.Phone, null, modifier = Modifier.size(18.dp)) },
                    )
                    Spacer(Modifier.height(10.dp))
                    EditProfileField(
                        label = "Email",
                        value = state.email,
                        onValueChange = vm::setEmail,
                        leadingIcon = { Icon(Icons.Outlined.Mail, null, modifier = Modifier.size(18.dp)) },
                    )
                }
                Spacer(Modifier.height(16.dp))
                ProfileFormSection(title = if (state.isSupplier) "Business Registration" else "Business Details") {
                    EditProfileField(
                        label = if (state.isSupplier) "Company name" else "Business name",
                        value = state.businessName,
                        onValueChange = vm::setBusinessName,
                        leadingIcon = { Icon(Icons.Outlined.Storefront, null, modifier = Modifier.size(18.dp)) },
                    )
                    if (state.isSupplier) {
                        Spacer(Modifier.height(10.dp))
                        EditProfileField(
                            label = "Trade license number",
                            value = state.tradeLicenseNumber,
                            onValueChange = vm::setTradeLicenseNumber,
                            leadingIcon = { Icon(Icons.Outlined.Badge, null, modifier = Modifier.size(18.dp)) },
                        )
                    } else {
                        Spacer(Modifier.height(10.dp))
                        BusinessModelDropdown(
                            selected = state.businessType,
                            onSelected = vm::setBusinessType,
                        )
                    }
                }
                state.formError?.let {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        it,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 4.dp),
                    )
                }
                Spacer(Modifier.height(18.dp))
                Button(
                    onClick = { vm.save() },
                    enabled = !state.saving,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp),
                ) {
                    if (state.saving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text("Saving…", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    } else {
                        Text(
                            if (focus == EditProfileFocus.BUSINESS) "Save Business Profile" else "Save Changes",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
                ProfileCompletionFooter(profile = state.profile)
            }
        }
    }
}

@Composable
private fun ProfileFormSection(title: String, content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))
            content()
        }
    }
}

@Composable
private fun EditProfileField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    leadingIcon: @Composable (() -> Unit)? = null,
) {
    Column(Modifier.fillMaxWidth()) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = if (placeholder.isEmpty()) null else {
                { Text(placeholder, fontSize = 12.sp) }
            },
            leadingIcon = leadingIcon,
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BusinessModelDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        Text(
            "Primary Business Model",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(6.dp))
        ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
            OutlinedTextField(
                value = selected.ifBlank { BUSINESS_MODELS[1] },
                onValueChange = {},
                readOnly = true,
                shape = RoundedCornerShape(16.dp),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                trailingIcon = {
                    Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                },
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
            )
            ExposedDropdownMenu(expanded = expanded.value, onDismissRequest = { expanded.value = false }) {
                BUSINESS_MODELS.forEach { model ->
                    DropdownMenuItem(
                        text = { Text(model, fontSize = 12.sp) },
                        onClick = {
                            onSelected(model)
                            expanded.value = false
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ProfileCompletionFooter(profile: ProfileMeDto?) {
    profile ?: return
    val pct = profile.profileCompletionPct
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.6f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(
                "Profile completion",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Text(
                "$pct%",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
