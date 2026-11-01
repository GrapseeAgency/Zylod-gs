package com.zylod.wholesale.ui.returns

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Package
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.components.TimedAsyncImage
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed return-request screen (pageIds return-management,
 * returns-exchange, warranty-claims — the ui/screens delegates call THIS
 * with their pageId, so every page keeps its own ReturnRequestViewModel
 * instance through the pageId-keyed factory below).
 *
 * Data truth: GET api/orders/{orderId} + POST api/orders/{orderId}/return
 * via [ReturnRequestViewModel] — the REAL order items of the buyer's order.
 * Structure mirrors return-request-page.tsx 1:1: the honest "No order
 * selected" state, the sign-in gate, the honest "Order not found" card, the
 * error card with Retry, the progress card (order number + payment chip +
 * the 1/3 progress bar), the Select Items rows (checkbox + thumbnail +
 * variant + unit price + ordered qty; expanded per selected item into the
 * reason dropdown, the 1..orderedQty stepper and the shared comments box),
 * the honest "Nothing to return" card, the shipping-method selection (the
 * route's REAL two-value shippingMethod field) and the sticky submit bar
 * with the Selected/Qty/Estimated Refund summary. Nothing is fabricated:
 * no invented past-returns list (the web page fetches none) and no fake
 * success.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReturnRequestScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ReturnRequestViewModel = viewModel(key = "native-return-request-$pageId") {
        ReturnRequestViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Real 200 from the return route → jump to the order's return view
    // (web navigate('return-detail', { orderId })). return-detail stays on
    // its registry/WebView path — the same page the web flow lands on.
    LaunchedEffect(state.submitSuccess) {
        if (state.submitSuccess) openPage("return-detail", "orderId=${state.orderId}")
    }

    // Re-resolve on EVERY entry (TrackOrderScreen parity) — the VM survives
    // on the saved back stack, so a fresh query re-loads the new order.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ReturnTopBar(onBack = onBack)
        },
        bottomBar = {
            if (!state.needsAuth && state.hasOrderId && !state.notFound &&
                state.error == null && state.items.isNotEmpty()
            ) {
                SubmitBar(
                    state = state,
                    onSubmit = vm::submit,
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
                // the shared authenticator's refresh attempt) — no fake data.
                state.needsAuth -> ReturnAuthGate(openPage = openPage, onBack = onBack)
                // Web parity: no order id in the entry query.
                !state.hasOrderId -> NoOrderState(openPage = openPage)
                // Definitive 404 — the honest "Order not found" card.
                state.notFound -> NotFoundState(onRetry = vm::retry, onBack = onBack)
                // First-launch failure with nothing renderable: error card.
                state.error != null -> {
                    val errorMessage = state.error
                    LoadErrorState(message = errorMessage.orEmpty(), onRetry = vm::retry, onBack = onBack)
                }
                // Resolving the order: skeleton placeholders.
                state.loading -> ReturnSkeleton()
                else -> ReturnContent(state = state, vm = vm)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReturnTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Return Request",
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
}

/* ─── content ────────────────────────────────────────────────────────────── */

@Composable
private fun ReturnContent(state: ReturnRequestUiState, vm: ReturnRequestViewModel) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (state.offlineFromCache) {
            OfflineBanner("Offline — showing the last saved order snapshot")
        }
        ProgressCard(state = state)
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "Select Items",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            state.items.forEach { item ->
                ReturnItemCard(item = item, state = state, vm = vm)
            }
        }
        if (state.items.isNotEmpty()) {
            ShippingMethodCard(
                selected = state.shippingMethod,
                onSelected = vm::setShippingMethod,
            )
        }
        if (state.items.isEmpty()) {
            EmptyItemsCard()
        }
    }
}

/** Progress card — real order identity + the fixed 1/3 progress bar (web). */
@Composable
private fun ProgressCard(state: ReturnRequestUiState) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Order #${state.orderNumber.ifBlank { "--" }}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (state.placedLabel.isNotBlank()) {
                        Text(
                            "Placed ${state.placedLabel}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                if (state.paymentStatus.isNotBlank()) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            state.paymentStatus.replaceFirstChar { it.titlecase() },
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }
            }
            // Web renders a fixed w-1/3 primary bar — a decoration, not data.
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(0.333f)
                        .height(6.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                )
            }
            Text(
                "Select items to return",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ReturnItemCard(item: ReturnItemRow, state: ReturnRequestUiState, vm: ReturnRequestViewModel) {
    val isSelected = state.selected[item.id] == true
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
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
        Column {
            // Item header: checkbox + thumbnail + name/variant/price/qty.
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { vm.toggleItem(item.id) },
                    modifier = Modifier.padding(top = 2.dp),
                )
                Spacer(Modifier.width(4.dp))
                Box(
                    Modifier
                        .size(64.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    val image = item.thumbnailUrl
                    if (image != null) {
                        TimedAsyncImage(
                            url = image,
                            contentDescription = item.name,
                            modifier = Modifier.fillMaxSize(),
                        )
                    } else {
                        Icon(
                            Icons.Outlined.Package,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        item.name,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                    )
                    item.variantLabel?.let {
                        Text(
                            it,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                    ) {
                        Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.weight(1f)) {
                            Text(
                                formatTakaText(item.unitPrice),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Text(
                                " / ${item.unitLabel}",
                                fontSize = 10.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            "Qty: ${item.orderedQty}",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            // Return details — rendered only while the item is checked.
            if (isSelected) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        "Reason for Return *",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    ReasonDropdown(
                        selected = state.reasons[item.id].orEmpty(),
                        onSelected = { vm.setReason(item.id, it) },
                    )
                    Text(
                        "Quantity to Return",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceContainer,
                            shape = RoundedCornerShape(12.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                            ),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = { vm.changeQuantity(item.id, -1, item.orderedQty) },
                                    modifier = Modifier.size(30.dp),
                                ) {
                                    Icon(
                                        Icons.Outlined.Remove,
                                        "Decrease return quantity",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(14.dp),
                                    )
                                }
                                Text(
                                    "${state.quantities[item.id] ?: 1}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.width(40.dp),
                                )
                                IconButton(
                                    onClick = { vm.changeQuantity(item.id, 1, item.orderedQty) },
                                    modifier = Modifier.size(30.dp),
                                ) {
                                    Icon(
                                        Icons.Outlined.Add,
                                        "Increase return quantity",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(14.dp),
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "of ${item.orderedQty} ordered",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        "Additional Comments",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    OutlinedTextField(
                        value = state.comments,
                        onValueChange = vm::setComments,
                        placeholder = { Text("Describe the issue in detail...", fontSize = 12.sp) },
                        minLines = 2,
                        maxLines = 4,
                        shape = RoundedCornerShape(16.dp),
                        textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

/** The web <select> — "Select a reason…" + the four REAL reason values. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReasonDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = RETURN_REASONS.firstOrNull { it.value == selected }?.label.orEmpty(),
            onValueChange = {},
            readOnly = true,
            placeholder = { Text("Select a reason…", fontSize = 12.sp) },
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
                text = { Text("Select a reason…", fontSize = 12.sp) },
                onClick = {
                    onSelected("")
                    expanded.value = false
                },
            )
            RETURN_REASONS.forEach { reason ->
                DropdownMenuItem(
                    text = { Text(reason.label, fontSize = 12.sp) },
                    onClick = {
                        onSelected(reason.value)
                        expanded.value = false
                    },
                )
            }
        }
    }
}

/** The web REASONS constant — real wire values, verbatim labels. */
private data class ReturnReason(val value: String, val label: String)
private val RETURN_REASONS = listOf(
    ReturnReason("damaged", "Damaged on arrival"),
    ReturnReason("wrong", "Wrong item received"),
    ReturnReason("defect", "Manufacturing defect"),
    ReturnReason("specs", "Not as specified in catalog"),
)

/**
 * Shipping-method selection — the return route's REAL shippingMethod
 * field: exactly "pickup" (default) or "dropoff", and nothing else is
 * accepted server-side. Radio rows, the address-book card style.
 */
@Composable
private fun ShippingMethodCard(selected: String, onSelected: (String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "Shipping Method",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            ShippingMethodOption(
                value = "pickup",
                label = "Pickup",
                description = "The courier collects the parcel from your address.",
                selected = selected == "pickup",
                onSelected = onSelected,
            )
            ShippingMethodOption(
                value = "dropoff",
                label = "Drop-off",
                description = "You hand the parcel in at the courier drop point.",
                selected = selected == "dropoff",
                onSelected = onSelected,
            )
        }
    }
}

@Composable
private fun ShippingMethodOption(
    value: String,
    label: String,
    description: String,
    selected: Boolean,
    onSelected: (String) -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(20.dp)
                .border(
                    2.dp,
                    if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                    RoundedCornerShape(50),
                ),
        ) {
            if (selected) {
                Box(
                    Modifier
                        .size(10.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(
            Modifier
                .weight(1f)
                .clickable { onSelected(value) },
        ) {
            Text(
                label,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                description,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* ─── sticky submit bar ──────────────────────────────────────────────────── */

@Composable
private fun SubmitBar(state: ReturnRequestUiState, onSubmit: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            state.submitError?.let { message ->
                Surface(
                    color = error.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        verticalAlignment = Alignment.Top,
                        modifier = Modifier.padding(10.dp),
                    ) {
                        Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(message, fontSize = 11.sp, color = error)
                    }
                }
            }
            Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.weight(1f)) {
                    Text(
                        "Selected: ",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "${state.selectedCount} item${if (state.selectedCount == 1) "" else "s"}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        " · Qty: ",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "${state.selectedQty}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "Estimated Refund:",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        formatTakaText(state.totalRefund),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Button(
                onClick = onSubmit,
                enabled = state.selectedCount > 0 && !state.submitting && !state.missingReason,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Text(
                    if (state.submitting) "Submitting Request…" else "Submit Return Request",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
                if (!state.submitting) {
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.Outlined.ChevronRight, null, modifier = Modifier.size(16.dp))
                }
            }
        }
    }
}

/* ─── states ─────────────────────────────────────────────────────────────── */

/** Resolving the order — placeholder card (web PageLoader parity). */
@Composable
private fun ReturnSkeleton() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBar(width = 260.dp)
        SkeletonBar(width = 320.dp)
        SkeletonBar(width = 300.dp)
        SkeletonBar(width = 320.dp)
        Text(
            "Loading the order…",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun SkeletonBar(width: androidx.compose.ui.unit.Dp) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.size(width = width, height = 40.dp),
    ) {}
}

/**
 * Honest gate for signed-out buyers: no token (or a 401 after the shared
 * authenticator's refresh attempt). Web copy + Sign In / Go Back pair.
 */
@Composable
private fun ReturnAuthGate(openPage: (pageId: String, query: String) -> Unit, onBack: (() -> Unit)?) {
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
            "Sign in required",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Sign in with the buyer account that placed this order to request a return.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Text("Sign In", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        if (onBack != null) {
            OutlinedGoBack(onBack = onBack)
        }
    }
}

/** Web parity: no order id in the entry query — the centered no-order state. */
@Composable
private fun NoOrderState(openPage: (pageId: String, query: String) -> Unit) {
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
                Icons.Outlined.Inventory,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "No order selected",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Returns are started from a specific order. Open one of your delivered orders and choose \u201cReturn\u201d.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = { openPage("my-orders", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Text("View My Orders", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Definitive 404 — the honest "Order not found" card (web parity). */
@Composable
private fun NotFoundState(onRetry: () -> Unit, onBack: (() -> Unit)?) {
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
                Icons.Outlined.ErrorOutline,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Order not found",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "We couldn\u2019t find this order. It may belong to a different account.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Try Again", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        if (onBack != null) {
            OutlinedGoBack(onBack = onBack)
        }
    }
}

/** Load failure with nothing renderable — the error text + Try Again. */
@Composable
private fun LoadErrorState(message: String, onRetry: () -> Unit, onBack: (() -> Unit)?) {
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
                Icons.Outlined.ErrorOutline,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Couldn\u2019t load this order",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text("Try Again", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        if (onBack != null) {
            OutlinedGoBack(onBack = onBack)
        }
    }
}

@Composable
private fun OutlinedGoBack(onBack: () -> Unit) {
    TextButton(onClick = onBack, modifier = Modifier.padding(top = 8.dp)) {
        Text(
            "Go Back",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Web parity: an order with zero line items can return nothing. */
@Composable
private fun EmptyItemsCard() {
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
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(64.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
            ) {
                Icon(
                    Icons.Outlined.Package,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(28.dp),
                )
            }
            Text(
                "Nothing to return",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                "This order doesn\u2019t contain any line items, so there is nothing to return.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp),
            )
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
