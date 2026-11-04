package com.zylod.wholesale.ui.chat

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.CloudOff
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
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

/**
 * t278 — NATIVE DM THREAD (the surface behind the "chat-detail" pageId —
 * web ChatDetailPage parity). Renders the REAL buyer↔supplier conversation
 * from GET api/chat/conversations/{id}/messages and sends through POST
 * …/messages — mine-right / theirs-left bubbles, sender names, attachment
 * previews, ✓/✓✓ receipts. Previously this pageId funneled into the SUPPORT
 * session thread ("Zylod Live Support") — a buyer tapping Contact Supplier
 * talked to the support team, never to the supplier.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatThreadScreen(
    query: String = "",
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = LocalContext.current
    val vm: ChatThreadViewModel = viewModel(key = "native-dm-thread") {
        ChatThreadViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry — the VM survives on the saved back stack, so
    // replies that arrived while the user was elsewhere appear at once.
    LaunchedEffect(query) { vm.load(query) }

    // rememberSaveable — a rotation mid-sentence must not wipe the draft.
    var input by rememberSaveable { mutableStateOf("") }

    // Failed send → the optimistic bubble is gone; restore the typed text.
    LaunchedEffect(state.draftRestore) {
        val restore = state.draftRestore
        if (restore != null) {
            input = restore
            vm.consumeDraftRestore()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            state.otherName.ifBlank { "Conversation" },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "Direct message — replies notify them instantly",
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
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
        bottomBar = {
            DmInputBar(
                state = state,
                input = input,
                onInputChange = { input = it },
                onSend = {
                    vm.sendMessage(input)
                    input = ""
                },
                onDismissError = vm::consumeActionError,
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.needsAuth -> DmAuthGate(openPage = openPage)
                state.error != null && state.bubbles.isEmpty() -> DmErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                state.loading && state.bubbles.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                else -> DmThread(state = state)
            }
        }
    }
}

/* ─── thread body ─────────────────────────────────────────────────────────── */

@Composable
private fun DmThread(state: DmThreadUiState) {
    val listState = rememberLazyListState()

    // Keep the newest bubble visible (a temp removal can briefly shrink the
    // list — the runCatching keeps a shrink race from ever crashing).
    LaunchedEffect(state.bubbles.size) {
        if (state.bubbles.isNotEmpty()) {
            runCatching { listState.animateScrollToItem(state.bubbles.size - 1) }
        }
    }

    Column(Modifier.fillMaxSize()) {
        if (state.offlineFromCache) {
            DmOfflineStrip("Offline — showing the last saved conversation")
        }
        if (state.bubbles.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Outlined.Chat,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(34.dp),
                    )
                    Text(
                        "No messages yet — say hello",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                    Text(
                        "Your first message notifies the other party instantly.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(
                    state.bubbles,
                    key = { it.key },
                    contentType = { "dm-bubble" },
                ) { bubble ->
                    if (bubble.mine) DmMineBubble(bubble) else DmTheirBubble(bubble)
                }
            }
        }
    }
}

/** mine → right-aligned filled primary bubble + receipt + HH:mm. */
@Composable
private fun DmMineBubble(bubble: DmBubble) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End,
    ) {
        Column(horizontalAlignment = Alignment.End, modifier = Modifier.widthIn(max = 280.dp)) {
            Surface(
                color = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp, bottomEnd = 4.dp, bottomStart = 16.dp),
            ) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    if (bubble.attachmentLabel != null) {
                        Text(
                            bubble.attachmentLabel,
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    if (bubble.text.isNotBlank()) {
                        Text(
                            bubble.text,
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontSize = 13.sp,
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                if (bubble.timeLabel.isNotBlank()) {
                    Text(
                        bubble.timeLabel,
                        fontSize = 9.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.width(4.dp))
                }
                // Receipt: ✓ sent (optimistic too) / ✓✓ read — server truth.
                Text(
                    if (bubble.read) "✓✓" else "✓",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (bubble.read) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** theirs → left-aligned surface bubble + sender name + HH:mm. */
@Composable
private fun DmTheirBubble(bubble: DmBubble) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        Column(modifier = Modifier.widthIn(max = 280.dp)) {
            if (bubble.senderName.isNotBlank()) {
                Text(
                    bubble.senderName,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(bottom = 2.dp),
                )
            }
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(topStart = 4.dp, topEnd = 16.dp, bottomEnd = 16.dp, bottomStart = 16.dp),
            ) {
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    if (bubble.attachmentLabel != null) {
                        Text(
                            bubble.attachmentLabel,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                    if (bubble.text.isNotBlank()) {
                        Text(
                            bubble.text,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }
            if (bubble.timeLabel.isNotBlank()) {
                Text(
                    bubble.timeLabel,
                    fontSize = 9.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/* ─── input bar ───────────────────────────────────────────────────────────── */

@Composable
private fun DmInputBar(
    state: DmThreadUiState,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onDismissError: () -> Unit,
) {
    Surface(color = MaterialTheme.colorScheme.background, tonalElevation = 2.dp) {
        Column(Modifier.fillMaxWidth().imePadding()) {
            state.actionError?.let { message ->
                Surface(
                    color = MaterialTheme.colorScheme.errorContainer,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text(
                            message,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.weight(1f),
                        )
                        androidx.compose.material3.TextButton(onClick = onDismissError) {
                            Text("Dismiss", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = onInputChange,
                    placeholder = { Text("Message", fontSize = 12.sp) },
                    shape = RoundedCornerShape(22.dp),
                    singleLine = false,
                    maxLines = 4,
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 13.sp),
                    enabled = !state.needsAuth,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                IconButton(
                    onClick = onSend,
                    enabled = input.isNotBlank() && !state.sending && !state.needsAuth,
                ) {
                    if (state.sending) {
                        CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                    } else {
                        Icon(
                            Icons.AutoMirrored.Outlined.Send,
                            "Send message",
                            tint = if (input.isNotBlank()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                }
            }
        }
    }
}

/* ─── gate / error / offline ─────────────────────────────────────────────── */

@Composable
private fun DmAuthGate(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.Chat,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            "Sign in to message suppliers",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 14.dp),
        )
        Text(
            "Direct conversations between you and your suppliers.",
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
                .width(180.dp)
                .height(44.dp),
        ) {
            Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun DmErrorCard(message: String, onRetry: () -> Unit) {
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
                .height(44.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun DmOfflineStrip(text: String) {
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
