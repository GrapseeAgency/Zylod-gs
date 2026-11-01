package com.zylod.wholesale.ui.support

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed FAQ screen (pageId faq-page — the ui/screens delegate calls
 * THIS, so the page keeps its own FaqViewModel).
 *
 * Data truth: GET api/support/faqs via [FaqViewModel] — the REAL active
 * faqItems rows with their live helpful counters. Structure mirrors
 * faq-page.tsx 1:1: the language pill (EN⇄BN — bn rows render
 * questionBn/answerBn when present), the search field, the seven category
 * pills (selecting one REFETCHES with ?category=), the accordion cards
 * (question, ExpandMore chevron, answer, "Was this answer helpful?" with
 * the REAL POST …/vote Yes/No buttons that disable after one session-only
 * tap), the honest empty card, and the red "Still have questions?" CTA
 * (Live Chat + Submit Ticket). Loading = five skeleton cards; failures =
 * the error card with Retry or the saved snapshot with the offline banner.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaqScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: FaqViewModel = viewModel(key = "native-support-faq-$pageId") {
        FaqViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (ReviewsListScreen parity) — fresh counters
    // and the entry query's category seed land on the way back too.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FaqTopBar(title = state.title, onBack = onBack, onToggleLanguage = vm::toggleLanguage, language = state.language)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                FaqSearchField(state = state, onSearch = vm::setSearch)
                Spacer(Modifier.height(12.dp))
                CategoryPills(
                    language = state.language,
                    selected = state.category,
                    onSelect = vm::selectCategory,
                )
            }
            Spacer(Modifier.height(12.dp))
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                when {
                    state.error != null -> {
                        val errorMessage = state.error
                        SupportErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                    }
                    state.loading -> FaqSkeleton()
                    else -> {
                        if (state.offlineFromCache) {
                            SupportOfflineBanner("Offline — showing the last saved FAQs")
                        }
                        if (state.filtered.isEmpty()) {
                            FaqEmptyCard(language = state.language)
                        } else {
                            state.filtered.forEach { row ->
                                FaqCard(row = row, state = state, onExpand = vm::toggleExpanded, onVote = vm::vote)
                            }
                        }
                        FaqHelpCta(language = state.language, openPage = openPage)
                    }
                }
            }
        }
    }
}

/* ─── top bar + header controls ──────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FaqTopBar(
    title: String,
    onBack: (() -> Unit)?,
    onToggleLanguage: () -> Unit,
    language: String,
) {
    Column {
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
            actions = {
                // Language switcher — the web header's pill (Globe → Public).
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
}

@Composable
private fun FaqSearchField(state: FaqUiState, onSearch: (String) -> Unit) {
    val bn = state.language == FaqCategories.BN
    OutlinedTextField(
        value = state.searchQuery,
        onValueChange = onSearch,
        placeholder = {
            Text(
                if (bn) "প্রশ্ন দিয়ে খুঁজুন..." else "Search questions or keywords...",
                fontSize = 12.sp,
            )
        },
        leadingIcon = {
            Icon(Icons.Outlined.Search, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
        },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
    )
}

/** The web's seven category pills — verbatim ids and EN/BN labels. */
@Composable
private fun CategoryPills(language: String, selected: String, onSelect: (String) -> Unit) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
    ) {
        FaqCategories.ALL_LIST.forEach { cat ->
            val active = selected == cat.id
            Surface(
                color = if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(50),
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .clickable(onClick = { onSelect(cat.id) }),
            ) {
                Text(
                    if (language == FaqCategories.BN) cat.labelBn else cat.labelEn,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (active) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }
    }
}

/* ─── accordion cards ────────────────────────────────────────────────────── */

@Composable
private fun FaqCard(
    row: FaqRow,
    state: FaqUiState,
    onExpand: (String) -> Unit,
    onVote: (String, Boolean) -> Unit,
) {
    val expanded = state.expandedId == row.id
    val bn = state.language == FaqCategories.BN
    val question = if (bn && row.questionBn != null) row.questionBn.orEmpty() else row.questionEn
    val answer = if (bn && row.answerBn != null) row.answerBn.orEmpty() else row.answerEn
    val voted = state.voted[row.id]
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = { onExpand(row.id) })
                    .padding(16.dp),
            ) {
                Text(
                    question,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                val rotation by animateFloatAsState(
                    targetValue = if (expanded) 180f else 0f,
                    animationSpec = tween(durationMillis = 180),
                    label = "faqChevron",
                )
                Icon(
                    Icons.Outlined.ExpandMore,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(18.dp)
                        .graphicsLayer { rotationZ = rotation },
                )
            }
            if (expanded) {
                Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                    // Answer — whitespace-pre-line on the web; the real stored text.
                    Text(
                        answer,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    // Helpful vote footer — API-backed rows only (every native
                    // row IS an API row; the web's static fallback never exists
                    // here, so the vote section always renders).
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                    ) {
                        Text(
                            if (bn) "এই উত্তরটি কি সহায়ক ছিল?" else "Was this answer helpful?",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        VoteButton(
                            label = "Yes (${row.helpfulYes})",
                            icon = Icons.Outlined.Check,
                            active = voted == "yes",
                            activeColor = LocalZylodExtra.current.success,
                            enabled = voted == null,
                            onVote = { onVote(row.id, true) },
                        )
                        Spacer(Modifier.width(8.dp))
                        VoteButton(
                            label = "No",
                            icon = Icons.Outlined.Close,
                            active = voted == "no",
                            activeColor = MaterialTheme.colorScheme.error,
                            enabled = voted == null,
                            onVote = { onVote(row.id, false) },
                        )
                    }
                }
            }
        }
    }
}

/** One Yes/No vote chip — disabled once this faq has a session-only mark. */
@Composable
private fun VoteButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    active: Boolean,
    activeColor: androidx.compose.ui.graphics.Color,
    enabled: Boolean,
    onVote: () -> Unit,
) {
    Surface(
        color = if (active) activeColor.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onVote),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
        ) {
            Icon(
                icon,
                null,
                tint = if (active) activeColor else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(12.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (active) activeColor else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* ─── CTA + states ───────────────────────────────────────────────────────── */

/** The red "Still have questions?" card (Live Chat + Submit Ticket). */
@Composable
private fun FaqHelpCta(language: String, openPage: (pageId: String, query: String) -> Unit) {
    val bn = language == FaqCategories.BN
    Surface(
        color = MaterialTheme.colorScheme.primary,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 14.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                if (bn) "এখনো কোনো প্রশ্ন আছে?" else "Still have questions?",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary,
                textAlign = TextAlign.Center,
            )
            Text(
                if (bn) {
                    "আমাদের গ্রাহক সেবা দল আপনার যেকোনো পাইকারি সহায়তায় প্রস্তুত রয়েছে।"
                } else {
                    "Our dedicated wholesale support specialists are ready to assist with your inquiries."
                },
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                Surface(
                    color = MaterialTheme.colorScheme.onPrimary,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = { openPage("live-chat", "") }),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    ) {
                        Icon(
                            Icons.Outlined.Forum,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (bn) "লাইভ চ্যাট" else "Start Live Chat",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Surface(
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.16f),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = { openPage("submit-ticket", "") }),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    ) {
                        Icon(
                            Icons.Outlined.Mail,
                            null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (bn) "টিকেট খুলুন" else "Submit Ticket",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                }
            }
        }
    }
}

/** Web parity empty card (no questions / no search hit). */
@Composable
private fun FaqEmptyCard(language: String) {
    val bn = language == FaqCategories.BN
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                Icons.Outlined.SupportAgent,
                null,
                tint = MaterialTheme.colorScheme.outlineVariant,
                modifier = Modifier.size(44.dp),
            )
            Text(
                if (bn) "কোনো প্রশ্ন পাওয়া যায়নি" else "No matching questions found",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Text(
                if (bn) {
                    "সরাসরি লাইভ চ্যাটে আমাদের সাথে যোগাযোগ করুন"
                } else {
                    "Try searching another keyword or contact live support"
                },
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Resolving the list — the web's five skeleton cards. */
@Composable
private fun FaqSkeleton() {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(5) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
            ) {}
        }
    }
}

/**
 * Honest failure card (load errors): red-tinted, warning icon, the error
 * text, and a Retry that re-runs the fetch. Shared by every t255 support
 * screen (the ReviewsListScreen card idiom).
 */
@Composable
internal fun SupportErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over a cached snapshot (TrackOrderScreen banner style). */
@Composable
internal fun SupportOfflineBanner(text: String) {
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
