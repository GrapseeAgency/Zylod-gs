package com.zylod.wholesale.ui.support

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.components.ErrorBanner
import com.zylod.wholesale.ui.components.ZylodButton
import com.zylod.wholesale.ui.components.ZylodTextField
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * NATIVE Support Center (pageId "support-center" — this Kotlin screen owns
 * the pageId through RouteOwnership once NativePageRegistry points here).
 *
 * Real data only, from GET/POST api/support/tickets: honest loading /
 * sign-in / error / offline / empty states, a "My Tickets" LazyColumn with
 * stable keys (ticket id) and status chips colored by lifecycle state, and
 * an inline "Open a Ticket" form posting the real endpoint — server-confirmed
 * rows only, server errors surfaced verbatim. Structure mirrors
 * DealsScreen/OrdersScreen: Scaffold + TopAppBar + sectioned LazyColumn,
 * sp+FontWeight type styles, theme colors only.
 *
 * BACK CONTRACT (DealsScreen parity): no BackHandler installed — when
 * onBack == null it is a tab-like destination and system Back pops the
 * NavHost entry; when non-null the back arrow calls it.
 *
 * [query] is part of the NativePageRegistry composable contract
 * (SupportCenterScreen(onBack, openPage, query)) — the support-center page
 * takes no query, so it is accepted and unused by design.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportCenterScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SupportCenterViewModel = viewModel { SupportCenterViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Orders/Deals: the VM survives on the saved back stack
    // (tab-like destination) — re-pull on EVERY entry. The VM's
    // silent-refresh keeps the visible list mounted during the re-pull.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Support Center",
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
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                // THE one page-level loading animation (M3 rule — no shimmer,
                // no custom loaders; OrdersScreen parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Guest / dropped session: soft sign-in CTA (OrdersScreen
                // precedent — never a hard redirect; tickets are account data).
                state.needsAuth -> SupportAuthRequired(onSignIn = { openPage("login", "") })
                // First launch offline: nothing fetched AND nothing saved —
                // a themed error state with Retry, never a white screen.
                state.error != null -> SupportErrorState(message = state.error.orEmpty(), onRetry = vm::retry)
                else -> SupportContent(state = state, vm = vm)
            }
        }
    }
}

@Composable
private fun SupportContent(state: SupportCenterUiState, vm: SupportCenterViewModel) {
    // Form state is hoisted ABOVE the LazyColumn: item compositions are
    // disposed when scrolled off-screen, so per-item remember would silently
    // wipe a half-written ticket. Nothing here allocates per frame.
    var subject by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            // t184: IME-aware — the keyboard shrinks the viewport instead of
            // covering the description field / submit button while typing.
            .imePadding(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        if (state.lastCreatedId != null) {
            item(key = "submit-confirm", contentType = "banner") {
                SubmitConfirmationBanner(onDismiss = vm::dismissConfirmation)
            }
        }
        item(key = "open-ticket-form", contentType = "form") {
            OpenTicketForm(
                subject = subject,
                description = description,
                onSubjectChange = { subject = it },
                onDescriptionChange = { description = it },
                submitting = state.submitting,
                submitError = state.submitError,
                onSubmit = {
                    vm.createTicket(subject, description) { success, _ ->
                        if (success) {
                            subject = ""
                            description = ""
                        }
                    }
                },
            )
        }
        item(key = "tickets-header", contentType = "header") { TicketsHeader(state.tickets.size) }
        if (state.tickets.isEmpty()) {
            item(key = "tickets-empty", contentType = "empty") { TicketsEmpty() }
        } else {
            items(
                state.tickets,
                // Ticket-row id — unique (DB PK) and stable across re-pulls;
                // the VM's prepend path dedupes by id, so no key crash.
                key = { ticket -> "ticket-${ticket.id}" },
                contentType = { "ticket" },
            ) { ticket ->
                TicketCard(ticket)
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * Inline "Open a Ticket" form — subject + description posting the real
 * POST /api/support/tickets. Validation hints mirror the server's own gates
 * (subject ≥ 5 chars, description ≥ 20 chars); submit errors surface the
 * server's `{ error }` string verbatim in an inline banner.
 */
@Composable
private fun OpenTicketForm(
    subject: String,
    description: String,
    onSubjectChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    submitting: Boolean,
    submitError: String?,
    onSubmit: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.SupportAgent,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Open a Ticket",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Text(
                "Our team replies right here — updates appear in your tickets below.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
            ZylodTextField(
                value = subject,
                onValueChange = onSubjectChange,
                label = "Subject",
                placeholder = "What is this about?",
                enabled = !submitting,
                supportingText = "At least 5 characters",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            )
            OutlinedTextField(
                value = description,
                onValueChange = onDescriptionChange,
                label = { Text("Describe the issue", fontSize = 12.sp) },
                placeholder = {
                    Text(
                        "What happened? Add order or payment details if any.",
                        fontSize = 12.sp,
                    )
                },
                enabled = !submitting,
                minLines = 3,
                maxLines = 5,
                supportingText = {
                    Text(
                        "At least 20 characters",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                shape = MaterialTheme.shapes.small,
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 14.sp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            )
            submitError?.let { ErrorBanner(it, Modifier.padding(top = 8.dp)) }
            ZylodButton(
                text = "Submit Ticket",
                onClick = onSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                enabled = subject.isNotBlank() && description.isNotBlank(),
                loading = submitting,
            )
        }
    }
}

/** Success banner — only after a SERVER-confirmed 201 (no fake optimism). */
@Composable
private fun SubmitConfirmationBanner(onDismiss: () -> Unit) {
    val success = LocalZylodExtra.current.success
    Surface(
        color = success.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, success.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
        ) {
            Icon(Icons.Outlined.CheckCircle, null, tint = success, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Ticket submitted — our team will reply here soon.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = onDismiss) {
                Text("Dismiss", fontSize = 11.sp, color = success, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** "My Tickets" section header — DealsScreen SectionHeader styling. */
@Composable
private fun TicketsHeader(count: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 6.dp),
    ) {
        Icon(
            Icons.Outlined.ConfirmationNumber,
            null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            "My Tickets",
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.weight(1f))
        Text(
            "$count ticket${if (count == 1) "" else "s"}",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * One ticket card — subject + category/replies/date meta line + status chip
 * colored by the lifecycle state, with a description preview.
 */
@Composable
private fun TicketCard(ticket: SupportTicket) {
    // remember{} for derived values — no per-recomposition reformatting.
    val meta = remember(ticket) {
        listOfNotNull(
            ticket.category.replace('_', ' '),
            if (ticket.messageCount > 0) {
                "${ticket.messageCount} ${if (ticket.messageCount == 1) "reply" else "replies"}"
            } else {
                null
            },
            formatDate(ticket.createdAtIso ?: ticket.updatedAtIso),
        ).joinToString(" • ")
    }
    val priorityFlag = remember(ticket) {
        when (ticket.priority.lowercase()) {
            "urgent", "high" -> ticket.priority.uppercase()
            else -> null
        }
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        ticket.subject,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 17.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (meta.isNotBlank()) {
                        Text(
                            meta,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                Spacer(Modifier.width(6.dp))
                StatusChip(ticket)
            }
            if (ticket.description.isNotBlank()) {
                Text(
                    ticket.description,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            priorityFlag?.let {
                Text(
                    it,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.8.sp,
                    color = LocalZylodExtra.current.warning,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** Status chip — theme colors only (no hex outside ui/theme/), OrdersScreen style. */
@Composable
private fun StatusChip(ticket: SupportTicket) {
    val (container, content) = when (ticket.status) {
        TicketStatus.OPEN ->
            MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        TicketStatus.IN_PROGRESS ->
            MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        // Waiting states need the USER's attention — warning pair.
        TicketStatus.WAITING_BUYER, TicketStatus.WAITING_SELLER ->
            LocalZylodExtra.current.warning to LocalZylodExtra.current.onWarning
        TicketStatus.RESOLVED ->
            LocalZylodExtra.current.success to LocalZylodExtra.current.onSuccess
        TicketStatus.CLOSED, TicketStatus.UNKNOWN ->
            MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    // UNKNOWN rows surface the exact wire string (never an invented status).
    val label = if (ticket.status == TicketStatus.UNKNOWN) {
        ticket.statusRaw.replace('_', ' ').uppercase().ifBlank { ticket.status.label }
    } else {
        ticket.status.label
    }
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

/** Honest empty state under the form (the form is the way out). */
@Composable
private fun TicketsEmpty() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 20.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(56.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.ConfirmationNumber,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            "No tickets yet",
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            "Open a ticket above and our team will get back to you.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

/** Offline banner over SAVED tickets — theme warning pair, DealsScreen style. */
@Composable
private fun OfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved tickets",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * Guest / dropped-session state — the soft sign-in CTA (OrdersScreen
 * precedent, no redirect; native routes to the real login pageId).
 */
@Composable
private fun SupportAuthRequired(onSignIn: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
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
            "Sign in to see your tickets",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Sign in and your support tickets, replies and resolutions will appear here.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** First launch with no connection and NO saved tickets — Retry, never blank. */
@Composable
private fun SupportErrorState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.ErrorOutline,
            null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(36.dp),
        )
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * Ticket dates are UTC ISO instants (prisma DateTime) — "Jan 5, 2025", web
 * parity with orders-page.tsx. Unparsable input yields "" and the meta line
 * drops the segment instead of inventing one.
 */
private fun formatDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.parse(iso)
    }.getOrNull() ?: return ""
    return java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US).format(parsed)
}
