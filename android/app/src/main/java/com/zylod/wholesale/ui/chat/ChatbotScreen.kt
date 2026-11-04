package com.zylod.wholesale.ui.chat

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material3.AssistChip
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

/**
 * SHARED typed chatbot screen (pageIds chatbot, ai-assistant, support-bot —
 * the ui/screens delegates call THIS with their pageId, so every page keeps
 * its own ChatbotViewModel instance through the pageId-keyed factory).
 *
 * Port of the web chatbot-page: LOCAL greeting first, five exact
 * suggested-inquiry chips (EN/BN) while the thread is young, an EN/BN
 * toggle (globe icon; the label shows the OTHER language's name), an
 * optimistic user bubble, a typing indicator with pulsing dots while the
 * query is in flight, and bot bubbles that render the "read the article"
 * row (book icon + articleTitle, or the honest fallback label) opening
 * policy-detail with the slug. Network failure → the exact web offline bot
 * bubble — never a fake answer.
 *
 * Structure mirrors RfqListScreen/LiveChatScreen: Scaffold + TopAppBar,
 * theme colors only, stable fully-prefixed keys ("botm-…"),
 * sp+FontWeight styles.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatbotScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ChatbotViewModel = viewModel(key = "native-chatbot-$pageId") {
        ChatbotViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // rememberSaveable — rotation-safe chat draft.
    var input by rememberSaveable { mutableStateOf("") }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Zylod Assistant",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
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
                actions = {
                    // EN/BN toggle: the label shows the OTHER language's name.
                    TextButton(
                        onClick = { vm.setLanguage(if (state.language == "en") "bn" else "en") },
                    ) {
                        Icon(
                            Icons.Outlined.Public,
                            contentDescription = "Language",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            if (state.language == "en") "বাংলা" else "English",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            ChatbotInputBar(
                loading = state.loading,
                input = input,
                onInputChange = { input = it },
                onSend = {
                    vm.send(input)
                    input = ""
                },
            )
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            ChatbotThread(state = state, onSend = vm::send, openPage = openPage)
        }
    }
}

/* ─── thread ─────────────────────────────────────────────────────────────── */

@Composable
private fun ChatbotThread(
    state: ChatbotUiState,
    onSend: (String) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val listState = rememberLazyListState()

    // Keep the newest bubble (or the typing indicator) visible; runCatching
    // keeps any index race from ever crashing the screen.
    LaunchedEffect(state.messages.size, state.loading) {
        val last = state.messages.size - 1 + if (state.loading) 1 else 0
        if (last >= 0) {
            runCatching { listState.animateScrollToItem(last) }
        }
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        // The five exact web quick prompts — visible only while the thread
        // is young (greeting + at most the first user/bot pair).
        if (state.messages.size <= 2 && !state.loading) {
            item(key = "bot-chips", contentType = "chips") {
                QuickPrompts(language = state.language, onSend = onSend)
            }
        }
        items(
            state.messages,
            key = { it.key },
            contentType = { "bubble" },
        ) { message ->
            if (message.fromUser) {
                ChatbotUserBubbleRow(message)
            } else {
                ChatbotBotBubbleRow(message, openPage)
            }
        }
        if (state.loading) {
            item(key = "bot-typing", contentType = "typing") {
                TypingIndicator()
            }
        }
    }
}

/** "Suggested Inquiries" (EN) / "প্রস্তাবিত প্রশ্নাবলী" (BN) + the 5 chips. */
@Composable
private fun QuickPrompts(language: String, onSend: (String) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Text(
            if (language == "bn") CHATBOT_LABEL_BN else CHATBOT_LABEL_EN,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        CHATBOT_QUICK_PROMPTS.forEach { prompt ->
            val text = if (language == "bn") prompt.bn else prompt.en
            AssistChip(
                onClick = { onSend(text) },
                label = {
                    Text(
                        text,
                        fontSize = 11.sp,
                        maxLines = 2,
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
            )
        }
    }
}

/** user → right-aligned filled primary bubble + HH:mm. */
@Composable
private fun ChatbotUserBubbleRow(message: ChatbotMessage) {
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
                    message.text,
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                )
            }
            if (message.timeLabel.isNotBlank()) {
                Text(
                    message.timeLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** bot → left-aligned surface bubble with the bot icon avatar (+ article row). */
@Composable
private fun ChatbotBotBubbleRow(
    message: ChatbotMessage,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        BotAvatar()
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
                Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text(
                        message.text,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = 13.sp,
                    )
                    // article source: the link row INSIDE the bubble opens the
                    // full policy article with the slug (native key=value query
                    // convention, same as productId=/orderId= call sites).
                    val slug = message.articleLink
                    if (slug != null) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .padding(top = 6.dp)
                                .clickable { openPage("policy-detail", "slug=$slug") },
                        ) {
                            Icon(
                                Icons.AutoMirrored.Outlined.MenuBook,
                                contentDescription = "Open article",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                message.articleTitle?.takeIf(String::isNotBlank)
                                    ?: "Read Full Policy Article",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
            if (message.timeLabel.isNotBlank()) {
                Text(
                    message.timeLabel,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

/** 24dp circle + bot icon — the chatbot's avatar (no invented photo). */
@Composable
private fun BotAvatar() {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(24.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
    ) {
        Icon(
            Icons.Outlined.SmartToy,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(14.dp),
        )
    }
}

/** Bot avatar + bubble with three pulsing dots while the query is in flight. */
@Composable
private fun TypingIndicator() {
    val transition = rememberInfiniteTransition(label = "typing")
    val alpha by transition.animateFloat(
        initialValue = 0.25f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "typing-alpha",
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start,
    ) {
        BotAvatar()
        Spacer(Modifier.width(8.dp))
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(
                topStart = 4.dp,
                topEnd = 16.dp,
                bottomEnd = 16.dp,
                bottomStart = 16.dp,
            ),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                repeat(3) {
                    Box(
                        Modifier
                            .size(6.dp)
                            .background(
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
                                RoundedCornerShape(50),
                            ),
                    )
                }
            }
        }
    }
}

/* ─── input bar ──────────────────────────────────────────────────────────── */

@Composable
private fun ChatbotInputBar(
    loading: Boolean,
    input: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
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
            enabled = !loading,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        val canSend = input.isNotBlank() && !loading
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
