package com.zylod.wholesale.ui.complaints

import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * The web complaints components' honest status palette (see
 * ComplaintsScreen for the full mapping), parsed once — the t259 tint
 * convention (the screen owns colors).
 */
private val ComplaintAmberDeep = Color(0xFFB45309)
private val ComplaintEmerald = Color(0xFF059669)

/**
 * SHARED typed complaint-detail surface (pageId dispute-detail).
 *
 * WEB TRUTH (documented deviation, no fabrication): the WEB dispute-detail
 * pageId renders a static "Disputes aren't connected yet" placeholder —
 * but the complaint-detail ROUTE is real and live (the web's own
 * buyer-complaints page re-reads it for the per-row evidence manager) and
 * the withdraw route's semantics are exactly what the web exposes there
 * (owner-only, open-only, 409 with the real current status otherwise).
 * The layout therefore branches on the entry query:
 *
 *  - NO complaint id → the web's own static page copy verbatim (the
 *    id-less truth of this pageId): "Disputes aren't connected yet", the
 *    two guidance cards, and the Help-Center / My-Orders jumps.
 *  - id in the query → GET api/complaints/[id]: the status badge, category
 *    chip, title, filed timestamp + ref in mono, order context, the full
 *    description, the resolution note + decided line when a real decision
 *    exists, the evidence metadata rows when the buyer attached photos,
 *    and — while the complaint is genuinely open — the withdraw action
 *    with the web's confirm dialog copy and the route's verbatim result.
 *
 * Honest 401 / 403 ("Not authorized to view this complaint") / 404
 * ("Complaint not found") / empty / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComplaintDetailScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ComplaintDetailViewModel = viewModel(key = "native-complaint-detail-$pageId") {
        ComplaintDetailViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve on EVERY entry (ReturnRequestViewModel.load convention).
    LaunchedEffect(Unit) { vm.load(query) }

    // The withdraw confirm (BankAccountsScreen pendingDelete pattern) —
    // screen-local; the VM stays dialog-free.
    var withdrawAsked by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            DetailTopBar(onBack = onBack)
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
                !state.hasId -> StaticDisputePlaceholder(openPage = openPage, onBack = onBack)
                state.needsAuth -> RewardsAuthGate(
                    title = "Sign in to view this complaint",
                    body = "Complaint records are owner-scoped — sign in with the account that filed it to see the real status and the review team's decisions.",
                    onSignIn = { openPage("login", "") },
                )
                state.notFound -> RewardsEmptyCard(
                    icon = Icons.Outlined.Inventory2,
                    title = "Complaint not found",
                    body = "It may have been withdrawn, or the reference does not belong to your account — the route answers 404 for unknown ids.",
                )
                state.forbiddenMessage != null -> {
                    val forbidden = state.forbiddenMessage
                    RewardsErrorCard(message = forbidden.orEmpty(), onRetry = vm::retry)
                }
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.loading -> RewardsSkeleton()
                else -> DetailContent(
                    state = state,
                    vm = vm,
                    onWithdrawAsked = { withdrawAsked = true },
                )
            }
        }
    }

    if (withdrawAsked && state.hasId) {
        AlertDialog(
            onDismissRequest = { withdrawAsked = false; vm.closeWithdraw() },
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
                            "${state.detail?.title.orEmpty().ifBlank { "This complaint" }} · " +
                                "ref ${state.complaintId} · status ${state.detail?.status.orEmpty()}",
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
                        withdrawAsked = false
                        vm.confirmWithdraw()
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
                TextButton(onClick = { withdrawAsked = false; vm.closeWithdraw() }) {
                    Text("Keep complaint", fontWeight = FontWeight.Bold)
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DetailTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Dispute Thread",
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

/**
 * The web page's own static copy for the id-less case — VERBATIM from
 * dispute-detail-page.tsx (the pageId's honest truth when no complaint id
 * is in the entry query).
 */
@Composable
private fun StaticDisputePlaceholder(
    openPage: (pageId: String, query: String) -> Unit,
    onBack: (() -> Unit)?,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 32.dp),
    ) {
        Icon(
            Icons.Outlined.Schedule,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(56.dp),
        )
        Text(
            "Disputes aren't connected yet",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Zylod doesn't have a dispute & arbitration system connected right now, so there is no case record to " +
                "show here. Nothing about this page is simulated — when the disputes service goes live, your real " +
                "cases will appear in the Dispute Center.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        GuidanceCard(
            title = "Have an issue with an order?",
            body = "Open the order from your orders page and use the order timeline or contact the supplier directly " +
                "while the disputes service is being built.",
        )
        GuidanceCard(
            title = "Coming from the backend",
            body = "This screen will start showing live dispute data as soon as the disputes API is deployed — no " +
                "sample cases will ever be shown.",
        )
        Text(
            "Have a real complaint reference? Complaints filed from the Dispute Center open here with " +
                "complaintId=<id> in the link.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("help-center", "") },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 16.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Text("Visit Help Center", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = { openPage("orders", "") },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 8.dp)
                .fillMaxWidth()
                .height(44.dp),
        ) {
            Text("View My Orders", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
        if (onBack != null) {
            OutlinedButton(
                onClick = onBack,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .padding(top = 8.dp)
                    .fillMaxWidth()
                    .height(44.dp),
            ) {
                Text("Go Back", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun GuidanceCard(title: String, body: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .padding(top = 12.dp)
            .fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                body,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun DetailContent(
    state: ComplaintDetailUiState,
    vm: ComplaintDetailViewModel,
    onWithdrawAsked: () -> Unit,
) {
    val detail = state.detail ?: return
    // Verbatim withdraw result (the web's toast text) — inline after the dialog.
    state.withdrawMessage?.let { message ->
        InlineNote(text = message, success = true, onDismiss = vm::consumeWithdrawMessage)
    }
    // Verbatim withdraw failure (409 with the real status / 403 / 404).
    state.withdrawError?.let { message ->
        InlineNote(text = message, success = false, onDismiss = vm::closeWithdraw)
    }
    if (state.offlineFromCache) {
        RewardsOfflineBanner("Offline — showing the last saved complaint record")
    }
    // Header card: category chip + title + status badge.
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
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        complaintCategoryLabel(detail.category),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        detail.title.orEmpty(),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Text(
                        buildString {
                            append("Filed ")
                            append(complaintTimestampLabel(detail.createdAt) ?: "")
                            append(" · ref ")
                            append(detail.id ?: state.complaintId)
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                DetailStatusBadge(detail.status)
            }
            detail.orderId?.takeIf(String::isNotBlank)?.let { orderId ->
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.ShoppingCart,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            orderId,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Text(
                detail.description.orEmpty(),
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            detail.resolutionNote?.takeIf(String::isNotBlank)?.let { note ->
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
            detail.resolvedAt?.let { decided ->
                Text(
                    "Decided ${complaintTimestampLabel(decided) ?: ""}" +
                        if (!detail.resolvedById.isNullOrBlank()) " · by the Zylod review team" else "",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
    // Evidence card — the metadata rows the detail GET carries (never a
    // fabricated thumbnail; the bytes stay behind the authed attachments
    // route).
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Evidence",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (detail.evidencePhotos.isEmpty()) {
                Text(
                    "No evidence photos attached to this complaint.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                detail.evidencePhotos.forEach { photo ->
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
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
            if (detail.status != "open") {
                Text(
                    when (detail.status) {
                        "in_review" -> "Evidence is locked — review has started, so the photos attached while the " +
                            "complaint was open are what the team is reviewing."
                        "withdrawn" -> "Evidence is locked — the complaint was withdrawn; the photos attached while it " +
                            "was open are part of the record."
                        else -> "Evidence is locked — the complaint has been decided; the photos attached while it was " +
                            "open are part of the record."
                    },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
    // Withdraw — only while the complaint is genuinely open (web parity).
    if (state.canWithdraw) {
        Button(
            onClick = onWithdrawAsked,
            enabled = !state.withdrawing,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
                contentColor = MaterialTheme.colorScheme.error,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text(
                if (state.withdrawing) "Withdrawing…" else "Withdraw complaint",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.Mail,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(12.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "Withdrawing closes the complaint for real — it can no longer be reviewed or reopened. This action is audit-logged.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun DetailStatusBadge(status: String?) {
    val tint = when (status) {
        "open" -> ComplaintAmberDeep
        "in_review" -> MaterialTheme.colorScheme.primary
        "resolved" -> ComplaintEmerald
        "rejected" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
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

/** Inline verbatim result note (withdraw success/failure). */
@Composable
private fun InlineNote(text: String, success: Boolean, onDismiss: () -> Unit) {
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
            TextButton(onClick = onDismiss) {
                Text("Dismiss", fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold)
            }
        }
    }
}
