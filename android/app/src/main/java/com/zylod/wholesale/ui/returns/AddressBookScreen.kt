package com.zylod.wholesale.ui.returns

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed address-book screen (pageId address-book — the ui/screens
 * delegate calls THIS, so the page keeps its own AddressBookViewModel).
 *
 * Data truth: GET api/addresses via [AddressBookViewModel] — the session
 * user's REAL address rows. Structure mirrors shipping-address-page.tsx
 * (the component the web address-book pageId renders) 1:1: the sign-in
 * gate, the 3-step Address/Delivery/Payment mini progress bar, the
 * "Select Address" header with the New Address link, skeleton cards while
 * loading, the honest empty card, the radio-selectable address cards
 * (label, Default badge, company line, Attn:, street, district, city +
 * country, phone, Edit pencil) and the sticky "Continue to Delivery" bar
 * with its "Shipping to:" line. Nothing is fabricated: no invented
 * postalCode line, no fake selection when the fetch fails. The Edit
 * pencil opens the shared add-address page with the addressId in the
 * query — the native edit surface (PUT/DELETE api/addresses/{id}, the
 * web edit-address page's wire behavior).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddressBookScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AddressBookViewModel = viewModel(key = "native-address-book-$pageId") {
        AddressBookViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (TrackOrderScreen parity) — a freshly added
    // or edited address re-reads the book on the way back.
    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            AddressTopBar(onBack = onBack)
        },
        bottomBar = {
            if (!state.needsAuth && state.error == null) {
                ContinueBar(
                    state = state,
                    onContinue = { openPage("delivery-method", "") },
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
            when {
                // Honest gate for signed-out buyers (no token, or a 401 after
                // the shared authenticator's refresh attempt) — never a fake
                // empty book (the web t216 honesty fix).
                state.needsAuth -> AddressAuthGate()
                state.error != null -> {
                    val errorMessage = state.error
                    AddressErrorCard(message = errorMessage.orEmpty(), onRetry = { vm.load() })
                }
                else -> AddressContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddressTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Shipping Address",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
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
}

/* ─── content ────────────────────────────────────────────────────────────── */

@Composable
private fun AddressContent(
    state: AddressBookUiState,
    vm: AddressBookViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (state.offlineFromCache) {
            OfflineBanner("Offline — showing the last saved address book")
        }
        // 3-step mini progress bar — the web checkout breadcrumb (step 1 live).
        CheckoutSteps()
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                "Select Address",
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { openPage("add-address", "") }) {
                Icon(
                    Icons.Outlined.Add,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "New Address",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        when {
            state.loading -> AddressSkeleton()
            state.addresses.isEmpty() -> EmptyBookCard(openPage = openPage)
            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                state.addresses.forEach { row ->
                    AddressCard(
                        row = row,
                        isSelected = state.selectedId == row.id,
                        onSelect = { vm.select(row.id) },
                        onEdit = { openPage("add-address", "addressId=${row.id}") },
                    )
                }
            }
        }
    }
}

/** The web 3-step breadcrumb: 1 Address (live) → 2 Delivery → 3 Payment. */
@Composable
private fun CheckoutSteps() {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        StepBubble(position = 1, label = "Address", active = true)
        StepConnector()
        StepBubble(position = 2, label = "Delivery", active = false)
        StepConnector()
        StepBubble(position = 3, label = "Payment", active = false)
    }
}

@Composable
private fun StepBubble(position: Int, label: String, active: Boolean) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(32.dp)
                .background(
                    if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    RoundedCornerShape(50),
                ),
        ) {
            Text(
                "$position",
                fontSize = 12.sp,
                fontWeight = if (active) FontWeight.Black else FontWeight.Bold,
                color = if (active) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            label.uppercase(),
            fontSize = 10.sp,
            fontWeight = if (active) FontWeight.Black else FontWeight.Bold,
            color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun RowScope.StepConnector() {
    Box(
        Modifier
            .weight(1f)
            .padding(horizontal = 8.dp)
            .height(2.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
    )
}

@Composable
private fun AddressCard(
    row: AddressRow,
    isSelected: Boolean,
    onSelect: () -> Unit,
    onEdit: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .clickable(onClick = onSelect)
            .then(
                if (isSelected) {
                    Modifier.border(1.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(24.dp))
                } else {
                    Modifier.border(
                        1.dp,
                        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                        RoundedCornerShape(24.dp),
                    )
                },
            ),
    ) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.Top) {
            // Radio circle.
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .padding(top = 2.dp)
                    .size(20.dp)
                    .border(
                        2.dp,
                        if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                        RoundedCornerShape(50),
                    ),
            ) {
                if (isSelected) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        row.label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (row.isDefault) {
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            shape = RoundedCornerShape(50),
                        ) {
                            Text(
                                "Default",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (row.companyName.isNotBlank()) {
                        Text(
                            row.companyName,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    row.contactName?.let {
                        Text("Attn: $it", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (row.streetLine1.isNotBlank()) {
                        Text(row.streetLine1, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    row.area?.let {
                        Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (row.city.isNotBlank() || row.country.isNotBlank()) {
                        Text(
                            listOf(row.city, row.country)
                                .filter { it.isNotBlank() }
                                .joinToString(", "),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    row.phone?.let {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 2.dp),
                        ) {
                            Icon(
                                Icons.Outlined.Phone,
                                null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(12.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                it,
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            // Edit affordance — the web page's ONLY per-row action (it hands
            // addressId to the editor; here that is the shared add-address
            // page in its edit mode, the PUT/DELETE api/addresses/{id}
            // surface).
            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) {
                Icon(
                    Icons.Outlined.Edit,
                    "Edit address",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

/** Resolving the book — the web page's two pulsing placeholder cards. */
@Composable
private fun AddressSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonCard()
        SkeletonCard()
        Text(
            "Loading your addresses…",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun SkeletonCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .height(112.dp),
    ) {}
}

/** Web parity empty book: honest copy + the Add New Address jump. */
@Composable
private fun EmptyBookCard(openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "No saved addresses yet.",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = { openPage("add-address", "") },
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier.height(40.dp),
            ) {
                Icon(Icons.Outlined.Add, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Add New Address", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * Honest failure card (load errors): red-tinted, warning icon, the error
 * text, and a Retry that re-runs the full fetch.
 */
@Composable
private fun AddressErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * Honest gate for signed-out buyers (web AccountGate copy): "Sign in to
 * view your addresses" + the explanation line + the Sign In jump.
 */
@Composable
private fun AddressAuthGate() {
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
            "Sign in to view your addresses",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your address book is tied to your account. Sign in to view, add, and manage your delivery addresses.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

/* ─── sticky continue bar ────────────────────────────────────────────────── */

@Composable
private fun ContinueBar(state: AddressBookUiState, onContinue: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            state.selected?.let { selected ->
                Text(
                    "Shipping to: ",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    selected.companyName.ifBlank { selected.label },
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Button(
                onClick = onContinue,
                enabled = state.selectedId.isNotBlank(),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Text("Continue to Delivery", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(6.dp))
                Text("→", fontSize = 16.sp)
            }
        }
    }
}

/** Amber banner over the cached snapshot — the TrackOrderScreen banner style. */
@Composable
private fun OfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
