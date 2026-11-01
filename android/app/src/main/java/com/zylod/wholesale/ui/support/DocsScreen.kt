package com.zylod.wholesale.ui.support

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SupportArticleDto
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * SHARED typed docs screen (pageId docs-page — the ui/screens delegate
 * calls THIS, so the page keeps its own DocsViewModel).
 *
 * Data truth: docs-browser-page.tsx ported to a single-column native
 * layout — the sidebar TOC (GET api/support/policies, the web reads ONLY
 * tableOfContents) renders inline above the article pane with the same
 * grouped categories, search filter, selected-row highlight and the "Ask
 * AI Policy Assistant" footer button. The detail pane is the REAL
 * GET api/support/articles/{slug} payload: breadcrumbs (Docs → the typed
 * helpdesk), the lightweight heading/bullet/paragraph render of the stored
 * markdown content (EN⇄BN via titleBn/contentBn), the updated/views meta
 * line, the "Need specific order assistance?" callout (Open Ticket + Live
 * Chat) and the one-shot "Was this documentation helpful?" widget POSTing
 * api/support/articles/{slug}/feedback. The entry query's "slug=" pair
 * seeds the open article (web pageParams.slug || 'how-it-works').
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: DocsViewModel = viewModel(key = "native-support-docs-$pageId") {
        DocsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            DocsTopBar(language = state.language, onBack = onBack, onToggleLanguage = vm::toggleLanguage)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                if (state.offlineFromCache) {
                    SupportOfflineBanner("Offline — showing the last saved documentation")
                }
                // Sidebar search (web: the sidebar's top field).
                OutlinedTextField(
                    value = state.searchQuery,
                    onValueChange = vm::setSearch,
                    placeholder = { Text("Search documentation...", fontSize = 12.sp) },
                    leadingIcon = {
                        Icon(
                            Icons.Outlined.Search,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(16.dp),
                        )
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                    colors = OutlinedTextFieldDefaults.colors(
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )

                // Navigation tree (the sidebar TOC, inline).
                when {
                    state.tocLoading -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        repeat(4) {
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(32.dp),
                            ) {}
                        }
                    }
                    state.tocError != null -> SupportErrorCard(
                        message = state.tocError.orEmpty(),
                        onRetry = vm::retryToc,
                    )
                    else -> {
                        val sections = state.filteredToc
                        sections.forEach { section ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    (section.category ?: "").uppercase(Locale.US),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(start = 10.dp),
                                )
                                section.articles.forEach { art ->
                                    val slug = art.slug.orEmpty()
                                    val selected = state.activeSlug == slug
                                    val title = if (state.language == FaqCategories.BN && art.titleBn?.isNotBlank() == true) {
                                        art.titleBn.orEmpty()
                                    } else {
                                        art.titleEn.orEmpty()
                                    }
                                    Surface(
                                        color = if (selected) {
                                            MaterialTheme.colorScheme.primary
                                        } else {
                                            MaterialTheme.colorScheme.surfaceContainer
                                        },
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(12.dp))
                                            .clickable(onClick = { vm.selectArticle(slug) }),
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                        ) {
                                            Text(
                                                title,
                                                fontSize = 12.sp,
                                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                                                color = if (selected) {
                                                    MaterialTheme.colorScheme.onPrimary
                                                } else {
                                                    MaterialTheme.colorScheme.onSurface
                                                },
                                                modifier = Modifier.weight(1f),
                                            )
                                            if (selected) {
                                                Icon(
                                                    Icons.Outlined.ChevronRight,
                                                    null,
                                                    tint = MaterialTheme.colorScheme.onPrimary,
                                                    modifier = Modifier.size(12.dp),
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Surface(
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable(onClick = { openPage("chatbot", "") }),
                        ) {
                            Text(
                                "Ask AI Policy Assistant",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 10.dp),
                            )
                        }
                    }
                }

                // Main document content area.
                when {
                    state.articleLoading -> ArticleSkeleton()
                    state.articleError != null -> SupportErrorCard(
                        message = state.articleError.orEmpty(),
                        onRetry = vm::retryArticle,
                    )
                    state.article == null -> EmptyArticleCard()
                    else -> ArticlePane(state = state, openPage = openPage, onFeedback = vm::sendFeedback)
                }
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DocsTopBar(language: String, onBack: (() -> Unit)?, onToggleLanguage: () -> Unit) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(28.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(8.dp)),
                ) {
                    Icon(
                        Icons.AutoMirrored.Outlined.MenuBook,
                        null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(16.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    "Zylod Wholesale Documentation",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
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
        actions = {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(50),
                modifier = Modifier
                    .padding(end = 12.dp)
                    .clip(RoundedCornerShape(50))
                    .clickable(onClick = onToggleLanguage),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Icon(
                        Icons.Outlined.Public,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (language == FaqCategories.BN) "English" else "বাংলা",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── article pane ───────────────────────────────────────────────────────── */

@Composable
private fun ArticlePane(
    state: DocsUiState,
    openPage: (pageId: String, query: String) -> Unit,
    onFeedback: (Boolean) -> Unit,
) {
    val article = state.article ?: return
    val title = state.articleTitle.orEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Breadcrumbs (Docs → the typed helpdesk).
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                "Docs",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable { openPage("helpdesk", "") }
                    .padding(horizontal = 2.dp),
            )
            Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
            Text(
                article.category.orEmpty(),
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Icon(Icons.Outlined.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(12.dp))
            Text(
                title,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
        }

        // Document render — the stored markdown, honestly structured.
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            val meta = remember(article.updatedAt, article.views) { articleMetaLine(article) }
            if (meta.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Schedule,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(12.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        meta,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            state.articleContent.orEmpty().parseDocBlocks().forEach { block ->
                when (block) {
                    is DocBlock.Heading -> Text(
                        block.text,
                        fontSize = when (block.level) {
                            1 -> 16.sp
                            2 -> 14.sp
                            else -> 13.sp
                        },
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    is DocBlock.Bullet -> Row {
                        Text(
                            "•",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.width(14.dp),
                        )
                        Text(
                            block.text,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    is DocBlock.Paragraph -> Text(
                        block.text,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        // App cross-navigation callout card.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(36.dp)
                            .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp)),
                    ) {
                        Icon(
                            Icons.Outlined.Shield,
                            null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Column {
                        Text(
                            "Need specific order assistance?",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "You can open a formal dispute ticket or connect with human support.",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { openPage("submit-ticket", "") },
                    ) {
                        Text(
                            "Open Ticket",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        )
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { openPage("live-chat", "") },
                    ) {
                        Text(
                            "Live Chat",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                        )
                    }
                }
            }
        }

        // Was this documentation helpful widget (one-shot POST).
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
            ) {
                Text(
                    if (state.language == FaqCategories.BN) "এই ডকুমেন্টটি কি সহায়ক ছিল?"
                    else "Was this documentation helpful?",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                if (state.feedbackSent) {
                    Icon(
                        Icons.Outlined.CheckCircle,
                        null,
                        tint = LocalZylodExtra.current.success,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "Thank you for your feedback!",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LocalZylodExtra.current.success,
                    )
                } else {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { onFeedback(true) },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Icon(Icons.Outlined.Check, null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(13.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Yes", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { onFeedback(false) },
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Icon(Icons.Outlined.Close, null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(13.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("No", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
            }
        }
    }
}

/** Web parity placeholder while no article is open. */
@Composable
private fun EmptyArticleCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 48.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                Icons.AutoMirrored.Outlined.MenuBook,
                null,
                tint = MaterialTheme.colorScheme.outlineVariant,
                modifier = Modifier.size(44.dp),
            )
            Text(
                "Select an article from the left sidebar",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** The web detail skeleton (title bar + meta bar + two content blocks). */
@Composable
private fun ArticleSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().height(40.dp),
        ) {}
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier.fillMaxWidth(0.4f).height(14.dp),
        ) {}
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(140.dp),
        ) {}
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(140.dp),
        ) {}
    }
}

/* ─── content + meta helpers (pure JVM) ──────────────────────────────────── */

private sealed interface DocBlock {
    data class Heading(val level: Int, val text: String) : DocBlock
    data class Paragraph(val text: String) : DocBlock
    data class Bullet(val text: String) : DocBlock
}

/**
 * Lightweight markdown structuring of the REAL stored content: `#/##/###`
 * lines become headings, `- `/`* ` lines become bullets, consecutive plain
 * lines merge into paragraphs. Nothing is invented — the exact stored
 * characters render.
 */
private fun String.parseDocBlocks(): List<DocBlock> {
    val blocks = mutableListOf<DocBlock>()
    val paragraph = StringBuilder()
    fun flush() {
        if (paragraph.isNotEmpty()) {
            blocks += DocBlock.Paragraph(paragraph.toString().trim())
            paragraph.clear()
        }
    }
    lines().forEach { raw ->
        val line = raw.trim()
        when {
            line.isEmpty() -> flush()
            line.startsWith("### ") -> {
                flush()
                blocks += DocBlock.Heading(3, line.removePrefix("### ").trim())
            }
            line.startsWith("## ") -> {
                flush()
                blocks += DocBlock.Heading(2, line.removePrefix("## ").trim())
            }
            line.startsWith("# ") -> {
                flush()
                blocks += DocBlock.Heading(1, line.removePrefix("# ").trim())
            }
            line.startsWith("- ") || line.startsWith("* ") -> {
                flush()
                blocks += DocBlock.Bullet(line.substring(2).trim())
            }
            else -> {
                if (paragraph.isNotEmpty()) paragraph.append(' ')
                paragraph.append(line)
            }
        }
    }
    flush()
    return blocks
}

/** "Updated <locale date> · <n> views" — blank when nothing is known. */
private fun articleMetaLine(article: SupportArticleDto): String {
    val parts = mutableListOf<String>()
    article.updatedAt?.takeIf(String::isNotBlank)?.let { iso ->
        runCatching { articleIsoParser.parse(iso.take(19)) }
            .getOrNull()
            ?.let { parts += "Updated " + articleDateFormatter.format(it) }
    }
    if (article.views > 0) {
        parts += NumberFormat.getIntegerInstance(Locale.US).format(article.views) + " views"
    }
    return parts.joinToString(" · ")
}

private val articleIsoParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}
private val articleDateFormatter = SimpleDateFormat("MMM d, yyyy", Locale.US)
