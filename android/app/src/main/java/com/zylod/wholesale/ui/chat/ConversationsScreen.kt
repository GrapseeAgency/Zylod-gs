package com.zylod.wholesale.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.MessageSquare
import androidx.compose.material.icons.outlined.Search
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.zylod.wholesale.data.api.ConversationRow
import com.zylod.wholesale.ui.wallet.formatRelativeDate
import java.util.Locale

/**
 * t278 — NATIVE conversations LIST (the surface behind the "chat-list" /
 * "messaging-center" / "messages" pageIds — web specialType 'chat-list'
 * parity). Renders the REAL buyer↔supplier DM threads from GET
 * api/chat/conversations: other-party name, last-message preview (or the
 * product context / honest "No messages yet"), relative time, unread badge —
 * and routes each tap into the native chat-detail thread. Previously this
 * pageId rendered the SUPPORT session thread instead, so supplier DMs were
 * invisible and "Contact Supplier" delivered to the support team.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationsScreen(
    pageId: String = "chat-list",
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: ConversationsViewModel = viewModel(key = "native-conversations-$pageId") {
        ConversationsViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Messages",
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
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.needsAuth -> ConversationsAuthGate(openPage = openPage)
                state.error != null -> ConversationsErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                else -> ConversationsBody(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@Composable
private fun ConversationsBody(
    state: ConversationsUiState,
    vm: ConversationsViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val visible = remember(state.rows, state.search) {
        val q = state.search.trim().lowercase(Locale.US)
        if (q.isEmpty()) state.rows
        else state.rows.filter {
            it.otherPartyName.orEmpty().lowercase(Locale.US).contains(q) ||
                (it.lastMessage?.messageText.orEmpty().lowercase(Locale.US).contains(q))
        }
    }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.search,
            onValueChange = vm::setSearch,
            placeholder = { Text("Search conversations", fontSize = 12.sp) },
            leadingIcon = { Icon(Icons.Outlined.Search, null, modifier = Modifier.size(16.dp)) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 12.sp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
        )
        if (state.offline) {
            OfflineStrip("Offline — showing your last saved conversations")
        }
        if (state.offlineFromCache) {
            OfflineStrip("Offline — showing the last saved conversation list")
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (visible.isEmpty()) {
                item(key = "empty", contentType = "empty") {
                    ConversationsEmptyState(query = state.search, openPage = openPage)
                }
            } else {
                items(visible, key = { it.stableKey }, contentType = { "conversation" }) { row ->
                    ConversationRowCard(row = row, openPage = openPage)
                }
                if (state.canLoadMore) {
                    item(key = "load-more", contentType = "load-more") {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceContainer,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(onClick = vm::loadMore),
                        ) {
                            Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                                if (state.loadingMore) {
                                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                                } else {
                                    Text(
                                        "Load more (${state.page}/${state.totalPages})",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = MaterialTheme.colorScheme.primary,
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

/** One conversation row — web ChatList card parity (avatar initial, preview, badge). */
@Composable
private fun ConversationRowCard(
    row: ConversationRow,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val name = row.otherPartyName.orEmpty().ifBlank { "Conversation" }
    val initial = remember(name) { name.firstOrNull()?.uppercase()?.takeIf { it.isLetter() } ?: "?" }
    val timeLabel = remember(row.lastMessageAt) { formatRelativeDate(row.lastMessageAt) }
    val preview = remember(row) {
        val last = row.lastMessage
        when {
            last == null -> row.product?.let { "About: ${it.name}" } ?: "No messages yet"
            !last.messageText.isNullOrBlank() -> last.messageText
            !last.attachmentUrl.isNullOrBlank() ->
                if (last.attachmentType?.lowercase(Locale.US) == "image") "📷 Image" else "📎 File"
            else -> "No messages yet"
        }
    }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (row.unreadCount > 0) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f)
        else MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                openPage(
                    "chat-detail",
                    "conversationId=${row.id.orEmpty()}&supplierUserId=${row.otherPartyId.orEmpty()}&supplierName=${java.net.URLEncoder.encode(name, Charsets.UTF_8.name())}",
                )
            },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(12.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
            ) {
                Text(
                    initial,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Black,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        name,
                        fontSize = 13.sp,
                        fontWeight = if (row.unreadCount > 0) FontWeight.Black else FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (timeLabel.isNotBlank()) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            timeLabel,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Text(
                    preview,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (row.unreadCount > 0) {
                Spacer(Modifier.width(8.dp))
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(minimumBadgeWidth(row.unreadCount).dp),
                ) {
                    Box(Modifier.padding(horizontal = 6.dp, vertical = 2.dp), contentAlignment = Alignment.Center) {
                        Text(
                            "${row.unreadCount}",
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Black,
                        )
                    }
                }
            }
        }
    }
}

/** 18dp min so a single digit is a circle; grows with the count. */
private fun minimumBadgeWidth(count: Int): Int = if (count < 10) 18 else 24

@Composable
private fun ConversationsEmptyState(
    query: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 32.dp),
    ) {
        Icon(
            Icons.Outlined.MessageSquare,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(34.dp),
        )
        Text(
            if (query.isBlank()) "No conversations yet" else "No conversations found",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            "Start chatting with suppliers to get quotes and close deals",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (query.isBlank()) {
            Button(
                onClick = { openPage("suppliers", "") },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .padding(top = 14.dp)
                    .height(40.dp),
            ) {
                Text("Browse Suppliers", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ConversationsAuthGate(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.MessageSquare,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            "Sign in to see your messages",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 14.dp),
        )
        Text(
            "Your supplier and buyer conversations live in your account.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 20.dp)
                .height(48.dp),
        ) {
            Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ConversationsErrorCard(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            message,
            fontSize = 13.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 12.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 18.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OfflineStrip(text: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            Icon(
                Icons.Outlined.CloudOff,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
