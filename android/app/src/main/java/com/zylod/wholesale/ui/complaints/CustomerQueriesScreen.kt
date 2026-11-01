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
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton

/**
 * The web query-thread components' status palette (amber open / sky replied
 * / emerald resolved / slate closed), parsed once — the t259 tint
 * convention (the screen owns colors).
 */
private val QueryAmber = Color(0xFFD97706)
private val QuerySky = Color(0xFF0284C7)
private val QueryEmerald = Color(0xFF059669)

/**
 * SHARED typed customer-query-detail surface (pageId customer-query-detail).
 *
 * WEB TRUTH: the web component (customer-query-detail-page.tsx, Task 133)
 * is the SELLER-side thread — GET api/supplier/queries/[id] (supplier/admin
 * scoped; a buyer session gets the route's 401 "Access denied. Required:
 * supplier or admin") + the real reply composer (PATCH replyMessage, ≤
 * 2000, empty refused) and status transitions (PATCH status: resolved /
 * open / closed; a reply stamps repliedAt and flips status to 'replied'
 * server-side). The layout mirrors it 1:1: the query-facts card (subject,
 * buyerName · createdAt, status badge, queryType chip + product name), the
 * buyer's message bubble, the seller's reply bubble or the honest
 * "No reply yet — this query is waiting on you." note, the status buttons
 * per the web's conditions, and the composer hidden once the thread is
 * closed/resolved. Honest no-query / sign-in / 404 / error / offline
 * states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerQueriesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CustomerQueriesViewModel = viewModel(key = "native-customer-queries-$pageId") {
        CustomerQueriesViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Entry resolve on EVERY entry (ReturnRequestViewModel.load convention).
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            QueryTopBar(onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when {
                !state.hasQueryId -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    RewardsEmptyCard(
                        icon = Icons.Outlined.Inventory2,
                        title = "No query selected",
                        body = "Open a query from the Customer Queries list.",
                    )
                    if (onBack != null) {
                        OutlinedButton(
                            onClick = onBack,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.padding(top = 12.dp),
                        ) {
                            Text("Go back", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                state.needsAuth -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    RewardsEmptyCard(
                        icon = Icons.Outlined.Info,
                        title = "Sign in required",
                        body = "Only the seller who owns this query (or an admin) can view it.",
                    )
                }
                state.notFound -> RewardsEmptyCard(
                    icon = Icons.Outlined.Inventory2,
                    title = "Query not found",
                    body = "It may have been removed, or it belongs to another seller.",
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.loading -> RewardsSkeleton()
                else -> QueryThread(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QueryTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Query thread",
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
private fun QueryThread(state: QueryDetailUiState, vm: CustomerQueriesViewModel) {
    val query = state.query ?: return
    if (state.offlineFromCache) {
        RewardsOfflineBanner("Offline — showing the last saved query thread")
    }
    // Query facts card (the web's query-detail-card).
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        query.subject.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        buildString {
                            append(query.buyerName?.takeIf(String::isNotBlank) ?: "Anonymous buyer")
                            append(" · ")
                            append(queryTimestampLabel(query.createdAt) ?: "")
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                QueryStatusBadge(query.status)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(6.dp),
                ) {
                    Text(
                        query.queryType?.replace('_', ' ')?.uppercase() ?: "QUERY",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                query.productName?.takeIf(String::isNotBlank)?.let { productName ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.ShoppingCart,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(12.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            productName,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            // The buyer's real message (the web's query-buyer-message bubble).
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
            ) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            (query.buyerName?.takeIf(String::isNotBlank) ?: "Anonymous buyer").uppercase(),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        query.message.orEmpty(),
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            // The seller's real reply, when one exists (the web's
            // query-seller-reply bubble) — or the honest awaiting note.
            if (!query.replyMessage.isNullOrBlank()) {
                Surface(
                    color = QueryEmerald.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Column(Modifier.fillMaxWidth().padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "YOUR REPLY",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = QueryEmerald,
                                modifier = Modifier.weight(1f),
                            )
                            query.repliedAt?.let { repliedAt ->
                                Text(
                                    queryTimestampLabel(repliedAt) ?: "",
                                    fontSize = 9.sp,
                                    color = QueryEmerald,
                                )
                            }
                        }
                        Text(
                            query.replyMessage,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            } else {
                Surface(
                    color = QueryAmber.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        "No reply yet — this query is waiting on you.",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = QueryAmber,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(10.dp),
                    )
                }
            }
            // Status transitions — real PATCHes, audit-logged server-side
            // (the web's exact visibility conditions).
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (query.status != "resolved") {
                    SmallStatusButton(
                        label = "Mark resolved",
                        tint = QueryEmerald,
                        enabled = !state.statusMoving,
                        onClick = { vm.moveStatus("resolved") },
                    )
                }
                if (query.status != "open" && query.status != "closed") {
                    SmallStatusButton(
                        label = "Reopen",
                        tint = QueryAmber,
                        enabled = !state.statusMoving,
                        onClick = { vm.moveStatus("open") },
                    )
                }
                if (query.status != "closed") {
                    SmallStatusButton(
                        label = "Close",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        enabled = !state.statusMoving,
                        onClick = { vm.moveStatus("closed") },
                    )
                }
            }
            // Inline action result / failure (the web's toast text verbatim).
            state.actionMessage?.let { message ->
                Text(
                    message,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = QueryEmerald,
                )
            }
            state.actionError?.let { message ->
                Text(
                    message,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
    // Reply composer — the real PATCH (hidden once the thread is decided).
    if (!query.isClosed) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = state.reply,
                    onValueChange = vm::setReply,
                    placeholder = { Text("Write your reply to the buyer…", fontSize = 12.sp) },
                    shape = RoundedCornerShape(14.dp),
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${state.reply.trim().length}/2000",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = vm::sendReply,
                        enabled = !state.sending && state.reply.trim().isNotBlank(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Send,
                            null,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("Send", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun SmallStatusButton(label: String, tint: Color, enabled: Boolean, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = tint),
    ) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun QueryStatusBadge(status: String?) {
    val tint = when (status) {
        "open" -> QueryAmber
        "replied" -> QuerySky
        "resolved" -> QueryEmerald
        "closed" -> MaterialTheme.colorScheme.onSurfaceVariant
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        color = tint.copy(alpha = 0.1f),
        shape = RoundedCornerShape(50),
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
