package com.zylod.wholesale.ui.complaints

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ComplaintDto
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsChip
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * The web complaints components' honest status palette (amber open /
 * primary in_review / emerald resolved / red rejected / slate withdrawn —
 * the same language the admin queues use), parsed once — the t259 tint
 * convention (the screen owns colors).
 */
private val ComplaintAmber = Color(0xFFD97706)
private val ComplaintEmerald = Color(0xFF059669)

/**
 * SHARED typed complaints surface (pageIds buyer-complaints + dispute-center
 * + disputes-page).
 *
 * The three ids map to TWO web components (src/lib/page-chunks), and the
 * layout branch mirrors that split exactly:
 *
 *  - buyer-complaints → buyer-complaints-page.tsx: the "My Complaints"
 *    header, the route's REAL status chips (GET api/complaints supports the
 *    zod `status` enum, so the chips send the route's own wire tokens),
 *    full rows (category chip, status badge, filed timestamp, ref id in
 *    mono, order context, description, resolution note + decided line),
 *    the expandable per-row evidence section (re-reads GET
 *    api/complaints/[id] — exactly what the web's EvidenceManager does for
 *    its photo metadata) and the withdraw action on open rows with the
 *    web's confirm dialog copy. Rows are NOT clickable — the web never
 *    navigates from a row to a detail page.
 *  - dispute-center / disputes-page → dispute-center-page.tsx (the
 *    disputes-page pageId maps onto the SAME component in
 *    chunk-misc.ts:223): the file-a-complaint form (category select, title,
 *    description with live counter, optional order id, the web's exact
 *    client guards, the server's verbatim 400/403/404 texts and the REAL
 *    created reference inline) plus the compact recent list. No withdraw,
 *    no evidence — web parity.
 *
 * Honest loading / sign-in / empty / error / offline states — nothing
 * fabricated; rows render the wire's own values verbatim.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComplaintsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ComplaintsViewModel = viewModel(key = "native-complaints-$pageId") {
        ComplaintsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    // The dialog-pending row (BankAccountsScreen pendingDelete pattern) —
    // screen-local; the VM stays dialog-free.
    var pendingWithdraw by remember { mutableStateOf<ComplaintDto?>(null) }

    val listVariant = pageId == "buyer-complaints"

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ComplaintsTopBar(
                title = if (listVariant) "My Complaints" else "Dispute Center",
                onBack = onBack,
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                state.needsAuth -> RewardsAuthGate(
                    title = if (listVariant) "Sign in to view your complaints" else "Sign in to file a complaint",
                    body = if (listVariant) {
                        "Your complaints are tied to your account — sign in to see their real status and the review team's decisions."
                    } else {
                        "The dispute center needs to know who you are so your complaints stay linked to your account and you can see the real resolution."
                    },
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> {
                    ComplaintsBody(
                        state = state,
                        vm = vm,
                        listVariant = listVariant,
                        onWithdraw = { pendingWithdraw = it },
                    )
                }
            }
        }
    }

    pendingWithdraw?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingWithdraw = null; vm.closeWithdraw() },
            title = {
                Text("Withdraw this complaint?", fontSize = 16.sp, fontWeight = FontWeight.Black)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Withdrawing closes the complaint for real — it can no longer be reviewed or reopened. This action is audit-logged.",
                        fontSize = 12.sp,
                    )
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceContainer,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            "${row.title.orEmpty().ifBlank { "This complaint" }} · ref ${row.id.orEmpty()} · status ${row.status.orEmpty()}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(10.dp),
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val id = row.id
                        pendingWithdraw = null
                        if (!id.isNullOrBlank()) vm.confirmWithdraw(id)
                    },
                    enabled = !state.withdrawing,
                ) {
                    Text(
                        if (state.withdrawing) "Withdrawing…" else "Withdraw complaint",
                        color = MaterialTheme.colorScheme.error,
                        fontWeight = FontWeight.Bold,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingWithdraw = null; vm.closeWithdraw() }) {
                    Text("Keep complaint", fontWeight = FontWeight.Bold)
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ComplaintsTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
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

@Composable
private fun ComplaintsBody(
    state: ComplaintsUiState,
    vm: ComplaintsViewModel,
    listVariant: Boolean,
    onWithdraw: (ComplaintDto) -> Unit,
) {
    // Verbatim withdraw result (the web's toast text) — inline after the dialog.
    state.withdrawMessage?.let { message ->
        InlineResultNote(text = message, success = true, onDismiss = vm::consumeWithdrawMessage)
    }
    // Verbatim withdraw failure (409 with the real status / 403 / 404).
    state.withdrawError?.let { message ->
        InlineResultNote(text = message, success = false, onDismiss = vm::closeWithdraw)
    }
    // Verbatim refresh failure — last good data (even an honest empty list) stays on screen.
    state.refreshError?.let { message ->
        InlineResultNote(text = message, success = false, onDismiss = null)
    }
    if (state.offline) {
        RewardsOfflineBanner("Offline — showing the last saved complaints")
    }
    if (listVariant) {
        Text(
            "Every complaint here is a real record. You can withdraw a complaint while it is still open — after that it belongs to the review queue.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            COMPLAINT_STATUS_FILTERS.forEach { (value, label) ->
                RewardsChip(
                    label = label,
                    selected = state.filter == value,
                    onClick = { vm.setFilter(value) },
                )
            }
        }
    } else {
        FileComplaintForm(state = state, vm = vm)
        Text(
            "Your recent complaints",
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
    when {
        state.loading -> RewardsSkeleton()
        state.rows.isEmpty() -> RewardsEmptyCard(
            icon = Icons.Outlined.Inventory2,
            title = "No complaints filed yet",
            body = "Your account has no complaints on record — this list only shows real complaints you have filed.",
        )
        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            state.rows.forEach { row ->
                if (listVariant) {
                    BuyerComplaintRow(state = state, vm = vm, row = row, onWithdraw = onWithdraw)
                } else {
                    CenterComplaintRow(row = row)
                }
            }
        }
    }
}

/** Inline verbatim result note (withdraw success/failure, refresh failure). */
@Composable
private fun InlineResultNote(text: String, success: Boolean, onDismiss: (() -> Unit)?) {
    val color = if (success) ComplaintEmerald else MaterialTheme.colorScheme.error
    Surface(
        color = color.copy(alpha = 0.08f),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            Modifier.padding(start = 12.dp, top = 4.dp, bottom = 4.dp, end = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = color,
                modifier = Modifier.weight(1f),
            )
            if (onDismiss != null) {
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold)
                }
            } else {
                Spacer(Modifier.width(8.dp))
            }
        }
    }
}

/* ─── buyer-complaints full row (list + evidence + withdraw) ─────────────── */

@Composable
private fun BuyerComplaintRow(
    state: ComplaintsUiState,
    vm: ComplaintsViewModel,
    row: ComplaintDto,
    onWithdraw: (ComplaintDto) -> Unit,
) {
    ComplaintCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CategoryChip(row.category)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        row.title.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    buildString {
                        append("Filed ")
                        append(complaintTimestampLabel(row.createdAt) ?: "")
                        append(" · ref ")
                        append(row.id.orEmpty())
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(8.dp))
            StatusBadge(row.status)
        }
        row.orderId?.takeIf(String::isNotBlank)?.let { orderId ->
            OrderContextBox(orderId)
        }
        Text(
            row.description.orEmpty(),
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        row.resolutionNote?.takeIf(String::isNotBlank)?.let { note ->
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    "Resolution note: $note",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }
        row.resolvedAt?.let { decided ->
            Text(
                "Decided ${complaintTimestampLabel(decided) ?: ""}" +
                    if (!row.resolvedById.isNullOrBlank()) " · by the Zylod review team" else "",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        EvidenceSection(state = state, vm = vm, row = row)
        if (row.status == "open") {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Button(
                    onClick = { onWithdraw(row) },
                    enabled = !state.withdrawing,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("Withdraw", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * The expandable evidence section — expanding re-reads the DETAIL route
 * (the web EvidenceManager's exact data source); the photo BYTES stay
 * behind the authed attachments route, so the honest render is the
 * metadata rows (note, mime, size, date) — never a fabricated thumbnail.
 */
@Composable
private fun EvidenceSection(
    state: ComplaintsUiState,
    vm: ComplaintsViewModel,
    row: ComplaintDto,
) {
    val section = state.evidence[row.stableKey]
    val expanded = section != null
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = { vm.toggleEvidence(row.stableKey) })
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    if (expanded && section != null && section.photos.isNotEmpty()) {
                        "Evidence (${section.photos.size})"
                    } else {
                        "Evidence"
                    },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.Outlined.ExpandMore,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
            }
            if (expanded) {
                Column(
                    Modifier.padding(start = 12.dp, end = 12.dp, bottom = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    when {
                        section.loading -> Text(
                            "Loading evidence…",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        section.error != null -> Text(
                            section.error,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.error,
                        )
                        section.photos.isEmpty() -> Text(
                            "No evidence photos attached.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        else -> section.photos.forEach { photo ->
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceContainer,
                                shape = RoundedCornerShape(10.dp),
                            ) {
                                Column(Modifier.fillMaxWidth().padding(10.dp)) {
                                    Text(
                                        photo.note?.takeIf(String::isNotBlank) ?: "Evidence photo",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurface,
                                    )
                                    Text(
                                        listOfNotNull(
                                            photo.mimeType,
                                            evidenceBytesLabel(photo.sizeBytes).takeIf(String::isNotBlank),
                                            complaintTimestampLabel(photo.createdAt)?.let { "attached $it" },
                                        ).joinToString(" · "),
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ─── dispute-center compact row ─────────────────────────────────────────── */

@Composable
private fun CenterComplaintRow(row: ComplaintDto) {
    ComplaintCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CategoryChip(row.category)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        row.title.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    buildString {
                        append("Filed ")
                        append(complaintTimestampLabel(row.createdAt) ?: "")
                        append(" · ref ")
                        append(row.id.orEmpty())
                        append(" · ")
                        append(row.orderId?.takeIf(String::isNotBlank)?.let { "order $it" } ?: "not order-related")
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(8.dp))
            StatusBadge(row.status)
        }
        Text(
            row.description.orEmpty(),
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        row.resolutionNote?.takeIf(String::isNotBlank)?.let { note ->
            Text(
                "Resolution: $note",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ComplaintCard(content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(18.dp),
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            content()
        }
    }
}

@Composable
private fun CategoryChip(category: String?) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(
            complaintCategoryLabel(category),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
private fun StatusBadge(status: String?) {
    val tint = complaintStatusTint(status)
    Surface(
        color = tint.copy(alpha = 0.1f),
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(
            status?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "UNKNOWN",
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            color = tint,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

/** The web chip palette (amber open / primary in_review / emerald resolved / red rejected / slate withdrawn). */
@Composable
private fun complaintStatusTint(status: String?): Color = when (status) {
    "open" -> ComplaintAmber
    "in_review" -> MaterialTheme.colorScheme.primary
    "resolved" -> ComplaintEmerald
    "rejected" -> MaterialTheme.colorScheme.error
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

@Composable
private fun OrderContextBox(orderId: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(10.dp),
    ) {
        Text(
            orderId,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
        )
    }
}

/* ─── the file-a-complaint form (dispute-center family) ──────────────────── */

@Composable
private fun FileComplaintForm(state: ComplaintsUiState, vm: ComplaintsViewModel) {
    ComplaintCard {
        Text(
            "File a complaint",
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        state.filed?.let { filed ->
            Surface(
                color = ComplaintEmerald.copy(alpha = 0.08f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    "Complaint filed. Your reference is ${filed.id.orEmpty()} — current status: ${filed.status.orEmpty()}. " +
                        "It is now waiting for review by the Zylod team.",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = ComplaintEmerald,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                )
            }
        }
        CategoryDropdown(selected = state.category, onSelected = vm::setCategory)
        OutlinedTextField(
            value = state.title,
            onValueChange = vm::setTitle,
            placeholder = { Text("Short summary of the problem (3–120 characters)", fontSize = 12.sp) },
            shape = RoundedCornerShape(14.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = state.description,
            onValueChange = vm::setDescription,
            placeholder = { Text("Explain what happened — the review team reads exactly this (10–5000 characters)", fontSize = 12.sp) },
            shape = RoundedCornerShape(14.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            minLines = 4,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "${state.description.trim().length}/5000 characters",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = state.orderId,
            onValueChange = vm::setOrderId,
            placeholder = { Text("The order this complaint is about", fontSize = 12.sp) },
            shape = RoundedCornerShape(14.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            "Leave empty if not order-related. If given, the order must belong to your account.",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        state.formError?.let { message ->
            Surface(
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text(
                    message,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                )
            }
        }
        Button(
            onClick = vm::submitComplaint,
            enabled = !state.submitting,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text(
                if (state.submitting) "Filing…" else "File complaint",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = COMPLAINT_CATEGORIES.firstOrNull { it.first == selected }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            placeholder = { Text("Select a category", fontSize = 12.sp) },
            shape = RoundedCornerShape(14.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            trailingIcon = {
                Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(
            expanded = expanded.value,
            onDismissRequest = { expanded.value = false },
        ) {
            COMPLAINT_CATEGORIES.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label, fontSize = 12.sp) },
                    onClick = {
                        expanded.value = false
                        onSelected(value)
                    },
                )
            }
        }
    }
}
