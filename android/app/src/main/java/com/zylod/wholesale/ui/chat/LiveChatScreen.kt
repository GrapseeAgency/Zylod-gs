package com.zylod.wholesale.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed live-support chat screen (pageIds chat-list, chat-detail,
 * chat-support, instant-chat, messaging-center, live-chat — the ui/screens
 * delegates call THIS with their pageId, so every page keeps its own
 * LiveChatViewModel instance through the pageId-keyed factory below).
 *
 * Data truth: api/support/chat/sessions (+ /{id}/messages) via
 * [LiveChatViewModel] — linked/active/create resolution, optimistic send
 * with server confirmation (+ chatbot botReply), PATCH end-chat, honest
 * sign-in gate, honest 404/error card with Retry, and the saved thread
 * cache under an offline banner. Nothing is fabricated: no presence dot,
 * no fake agent names, no fake-append on failure.
 *
 * Structure mirrors RfqListScreen: Scaffold + TopAppBar (back arrow only
 * when [onBack] not null), theme colors only (the brand red arrives as
 * MaterialTheme.colorScheme; the amber cache banner from LocalZylodExtra),
 * stable fully-prefixed LazyColumn keys ("msg-…"), sp+FontWeight styles.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveChatScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: LiveChatViewModel = viewModel(key = "native-live-chat-$pageId") {
        LiveChatViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (RfqListScreen t208 parity) — the VM
    // survives on the saved back stack, so messages that arrived while the
    // buyer was elsewhere appear at once.
    LaunchedEffect(Unit) { vm.load(query) }

    // rememberSaveable — a rotation or process-death mid-sentence must not
    // wipe the typed draft (the VM state survives; the local did not).
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
            LiveChatTopBar(
                state = state,
                onBack = onBack,
                onEndChat = vm::endChat,
            )
        },
        bottomBar = {
            LiveChatInputBar(
                state = state,
                input = input,
                onInputChange = { input = it },
                onSend = {
                    vm.sendMessage(input)
                    input = ""
                },
                onNewChat = vm::startNewChat,
                onDismissError = vm::consumeActionError,
            )
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                // Honest gate for signed-out buyers (no token, or a 401 after
                // the shared authenticator's refresh attempt) — no fake thread.
                state.needsAuth -> LiveChatAuthGate(openPage = openPage, onRetry = { vm.load() })
                // First launch failure with nothing renderable: red error card.
                state.error != null && state.bubbles.isEmpty() -> {
                    val errorMessage = state.error
                    LiveChatErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                // Resolving the session / first thread pull: bubble placeholders.
                state.loading && state.bubbles.isEmpty() -> LiveChatSkeleton()
                else -> LiveChatThread(state = state)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiveChatTopBar(
    state: LiveChatUiState,
    onBack: (() -> Unit)?,
    onEndChat: () -> Unit,
) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 36dp "Z" brand avatar — the same mark the web header uses.
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(36.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                ) {
                    Text(
                        "Z",
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        "Zylod Live Support",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                    )
                    Text(
                        "Support team reviews messages and replies here",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
        },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Go back", tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        },
        actions = {
            // End Chat only while a live session exists — no fake presence,
            // no fake state changes (the PATCH is server-confirmed first).
            val showEndChat = !state.loading && !state.needsAuth && !state.sessionEnded &&
                state.sessionId != null && state.error == null
            if (showEndChat) {
                TextButton(onClick = onEndChat, enabled = !state.endingChat) {
                    Text(
                        if (state.endingChat) "Ending…" else "End Chat",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── thread ─────────────────────────────────────────────────────────────── */

@Composable
private fun LiveChatThread(state: LiveChatUiState) {
    val listState = rememberLazyListState()

    // Keep the newest bubble visible (temp removal can briefly shrink the
    // list — the runCatching keeps a shrink race from ever crashing).
    LaunchedEffect(state.bubbles.size) {
        if (state.bubbles.isNotEmpty()) {
            runCatching { listState.animateScrollToItem(state.bubbles.size - 1) }
        }
    }

    Column(Modifier.fillMaxSize()) {
        if (state.offlineFromCache) {
            OfflineBanner("Offline — showing the last saved conversation")
        }
        if (state.bubbles.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                EmptyThreadState()
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
                    contentType = { "bubble" },
                ) { bubble ->
                    when {
                        bubble.system -> SystemBubbleRow(bubble)
                        bubble.mine -> UserBubbleRow(bubble)
                        else -> AgentBubbleRow(bubble)
                    }
                }
            }
        }
    }
}

/** user → right-aligned filled primary bubble + check + HH:mm. */
@Composable
private fun UserBubbleRow(bubble: ChatBubble) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End,
    ) {
        Column(horizontalAlignment = Alignment.End, modifier = Modifier.widthIn(max = 280.dp)) {
            Surface(
                color = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(
                    topStart = 16.dp,
                    topEnd = 16.dp,
                    bottomEnd = 4.dp,
                    bottomStart = 16.dp,
                ),
            ) {
                Text(
                    bubble.text,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                if (bubble.timeLabel.isNotBlank()) {
                    Text(
                        bubble.timeLabel,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                // The check appears only on server-confirmed messages — the
                // optimistic bubble never claims a delivery it has no proof of.
                if (bubble.confirmed) {
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        Icons.Outlined.Check,
                        contentDescription = "Sent",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(12.dp),
                    )
                }
            }
        }
    }
}

/** agent → left-aligned surface bubble with the small "Z" brand avatar. */
@Composable
private fun AgentBubbleRow(bubble: ChatBubble) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(24.dp)
                .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
        ) {
            Text(
                "Z",
                color = MaterialTheme.colorScheme.onPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
            )
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.Start, modifier = Modifier.widthIn(max = 280.dp)) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(
                    topStart = 4.dp,
                    topEnd = 16.dp,
                    bottomEnd = 16.dp,
                    bottomStart = 16.dp,
                ),
            ) {
                Text(
                    bubble.text,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
            if (bubble.timeLabel.isNotBlank()) {
                Text(
                    bubble.timeLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** system → centered small pill (no invented sender identity). */
@Composable
private fun SystemBubbleRow(bubble: ChatBubble) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(50),
        ) {
            Text(
                bubble.text,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}

/** Empty thread — the exact web honest copy about the encrypted session. */
@Composable
private fun EmptyThreadState() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Shield,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Protected Live Support Session",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your conversation is encrypted. Ask anything regarding orders, delivery status, or supplier disputes.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

/** Resolving/first pull — rounded bubble placeholders (web skeleton parity). */
@Composable
private fun LiveChatSkeleton() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBubble(width = 220.dp, alignEnd = false)
        SkeletonBubble(width = 260.dp, alignEnd = true)
        SkeletonBubble(width = 180.dp, alignEnd = false)
        SkeletonBubble(width = 240.dp, alignEnd = true)
        Text(
            "Connecting to support…",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun SkeletonBubble(width: androidx.compose.ui.unit.Dp, alignEnd: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (alignEnd) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.size(width = width, height = 40.dp),
        ) {}
    }
}

/* ─── input bar ──────────────────────────────────────────────────────────── */

@Composable
private fun LiveChatInputBar(
    state: LiveChatUiState,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onNewChat: () -> Unit,
    onDismissError: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        // Send/end-chat failure text — dismissible, cleared on the next send.
        val actionError = state.actionError
        if (actionError != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    actionError,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = onDismissError) {
                    Text("Dismiss", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (state.sessionEnded) {
            // The server-confirmed ended state — no input, an honest row.
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
            ) {
                Text(
                    "This chat session has ended.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(
                    onClick = onNewChat,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .height(40.dp),
                ) {
                    Text("Start New Chat", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = input,
                    onValueChange = onInputChange,
                    placeholder = {
                        Text(
                            "Type your question…",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    },
                    shape = RoundedCornerShape(24.dp),
                    singleLine = true,
                    enabled = !state.sending,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                val canSend = input.isNotBlank() && !state.sending
                Surface(
                    shape = RoundedCornerShape(50),
                    color = if (canSend) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    modifier = Modifier
                        .size(44.dp)
                        .clickable(enabled = canSend, onClick = onSend),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Send,
                            contentDescription = "Send",
                            tint = if (canSend) {
                                MaterialTheme.colorScheme.onPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        }
    }
}

/* ─── banners / gates ────────────────────────────────────────────────────── */

/** Amber banner over the cached thread — the RfqListScreen banner style. */
@Composable
private fun OfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
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

/**
 * Honest failure card (load errors incl. the definitive 404): red-tinted,
 * warning icon, the error text, and a Retry that re-runs the full init.
 */
@Composable
private fun LiveChatErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
    ) {
        Surface(
            color = error.copy(alpha = 0.08f),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
        ) {
            Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Outlined.Warning, null, tint = error, modifier = Modifier.size(24.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Button(
                    onClick = onRetry,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .padding(top = 12.dp)
                        .height(40.dp),
                ) {
                    Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * Honest gate for signed-out buyers: no token (or a 401 after the shared
 * authenticator's refresh attempt). No fabricated thread — the RfqList gate
 * pattern with live-support copy.
 */
@Composable
private fun LiveChatAuthGate(
    openPage: (pageId: String, query: String) -> Unit,
    onRetry: () -> Unit,
) {
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
            "Sign in to use live support chat",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your encrypted conversation with the Zylod support team appears here once you sign in as a buyer.",
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
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        TextButton(onClick = { openPage("home", "") }) {
            Text(
                "Browse the marketplace",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
