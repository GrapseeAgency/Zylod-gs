package com.zylod.wholesale.ui.support

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed feedback screen (pageId feedback-page — the ui/screens
 * delegate calls THIS, so the page keeps its own FeedbackViewModel).
 *
 * Data truth: feedback-suggestions-page.tsx ported 1:1 — the red
 * "Shape the Future of Wholesale" banner, the four filter pills (server
 * REFETCH per pill via ?type=), the community wall of REAL
 * GET api/support/feedback rows (type badge, the amber rating star chip,
 * locale date, subject, description), the honest empty card and the
 * error+Retry card with the web's verbatim lines. The "Share Idea" modal
 * posts the REAL POST api/support/feedback (type select, title, details,
 * the route's 400 text as the client gate, the verbatim 401/403 line,
 * server error text, the submitting guard and the 1.2s
 * "Feedback Submitted!" pause before the wall refetches with the new row).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: FeedbackViewModel = viewModel(key = "native-support-feedback-$pageId") {
        FeedbackViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            FeedbackTopBar(onBack = onBack, onShareIdea = vm::openModal)
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            Column(
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                // Banner.
                Surface(
                    color = MaterialTheme.colorScheme.primary,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                ) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.Star,
                                null,
                                tint = LocalZylodExtra.current.warning,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "SHAPE THE FUTURE OF WHOLESALE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp,
                                color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                            )
                        }
                        Text(
                            "Have an idea to improve Zylod?",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Text(
                            "Suggest features, new payment options, logistics integrations, or report workflow bottlenecks.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                        )
                    }
                }

                // Filter tabs.
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .horizontalScroll(rememberScrollState()),
                ) {
                    FEEDBACK_FILTERS.forEach { filter ->
                        val active = state.typeFilter == filter.value
                        Surface(
                            color = if (active) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.surfaceContainer
                            },
                            shape = RoundedCornerShape(50),
                            border = if (active) {
                                null
                            } else {
                                BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f))
                            },
                            modifier = Modifier
                                .clip(RoundedCornerShape(50))
                                .clickable(onClick = { vm.setTypeFilter(filter.value) }),
                        ) {
                            Text(
                                filter.label,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (active) {
                                    MaterialTheme.colorScheme.onPrimary
                                } else {
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                },
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                            )
                        }
                    }
                }

                // Feedback wall.
                Column(
                    Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    when {
                        state.loading -> repeat(3) {
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(96.dp),
                            ) {}
                        }
                        state.loadError != null -> SupportErrorCard(
                            message = state.loadError.orEmpty(),
                            onRetry = vm::retry,
                        )
                        !state.hasItems -> FeedbackEmptyCard()
                        else -> state.items.forEach { row -> FeedbackCard(row = row) }
                    }
                }
            }

            // Submit modal (the web's fixed overlay).
            if (state.showSubmitModal) {
                FeedbackModal(state = state, vm = vm)
            }
        }
    }
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedbackTopBar(onBack: (() -> Unit)?, onShareIdea: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Feedback & Suggestions",
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
            Surface(
                color = MaterialTheme.colorScheme.primary,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .padding(end = 12.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onShareIdea),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Icon(
                        Icons.Outlined.Add,
                        null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "Share Idea",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── wall cards ─────────────────────────────────────────────────────────── */

@Composable
private fun FeedbackCard(row: FeedbackRow) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(6.dp),
                ) {
                    Text(
                        row.typeLabel.uppercase(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                if (row.rating != null) {
                    Icon(
                        Icons.Filled.Star,
                        null,
                        tint = LocalZylodExtra.current.warning,
                        modifier = Modifier.size(12.dp),
                    )
                    Spacer(Modifier.width(2.dp))
                    Text(
                        "${row.rating}.0",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = LocalZylodExtra.current.warning,
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    row.dateLabel,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                row.subject,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                row.description,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun FeedbackEmptyCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 40.dp, horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Icon(
                Icons.Outlined.Forum,
                null,
                tint = MaterialTheme.colorScheme.outlineVariant,
                modifier = Modifier.size(44.dp),
            )
            Text(
                "No suggestions in this category yet",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Text(
                "Be the first to share an idea with our product team!",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/* ─── submit modal ───────────────────────────────────────────────────────── */

@Composable
private fun FeedbackModal(state: FeedbackUiState, vm: FeedbackViewModel) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxSize()
            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.5f)),
    ) {
        Surface(
            color = MaterialTheme.colorScheme.background,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "Share Feedback & Ideas",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = vm::closeModal) {
                        Text(
                            "Cancel",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                if (state.submitted) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(
                            Icons.Outlined.CheckCircle,
                            null,
                            tint = LocalZylodExtra.current.success,
                            modifier = Modifier.size(40.dp),
                        )
                        Text(
                            "Feedback Submitted!",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = LocalZylodExtra.current.success,
                        )
                    }
                } else {
                    // Real POST error line (verbatim server copy / web fallbacks).
                    state.submitError?.let { message ->
                        val error = MaterialTheme.colorScheme.error
                        Surface(
                            color = error.copy(alpha = 0.08f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(
                                    BorderStroke(1.dp, error.copy(alpha = 0.25f)),
                                    RoundedCornerShape(12.dp),
                                ),
                        ) {
                            Text(
                                message,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = error,
                                modifier = Modifier.padding(12.dp),
                            )
                        }
                    }

                    Column {
                        Text(
                            "Feedback Type",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(6.dp))
                        FeedbackTypeDropdown(selected = state.formType, onSelected = vm::setFormType)
                    }

                    Column {
                        Text(
                            "Title",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(6.dp))
                        OutlinedTextField(
                            value = state.formSubject,
                            onValueChange = vm::setFormSubject,
                            placeholder = {
                                Text("e.g. Add instant bank invoice PDF export", fontSize = 12.sp)
                            },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                            colors = feedbackFieldColors(),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Column {
                        Text(
                            "Details",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(6.dp))
                        OutlinedTextField(
                            value = state.formDescription,
                            onValueChange = vm::setFormDescription,
                            placeholder = {
                                Text(
                                    "Describe how this feature will help your wholesale operations...",
                                    fontSize = 12.sp,
                                )
                            },
                            minLines = 4,
                            maxLines = 8,
                            shape = RoundedCornerShape(12.dp),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
                            colors = feedbackFieldColors(),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }

                    Button(
                        onClick = vm::submit,
                        enabled = !state.submitting,
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp),
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.Send, null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (state.submitting) "Submitting..." else "Post Feedback",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

/** The web modal <select> — the three REAL type values, verbatim labels. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedbackTypeDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = FEEDBACK_TYPES.firstOrNull { it.first == selected }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            shape = RoundedCornerShape(12.dp),
            textStyle = MaterialTheme.typography.bodyMedium.copy(fontSize = 12.sp),
            colors = feedbackFieldColors(),
            trailingIcon = {
                Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(expanded = expanded.value, onDismissRequest = { expanded.value = false }) {
            FEEDBACK_TYPES.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label, fontSize = 12.sp) },
                    onClick = {
                        onSelected(value)
                        expanded.value = false
                    },
                )
            }
        }
    }
}

@Composable
private fun feedbackFieldColors() = OutlinedTextFieldDefaults.colors(
    unfocusedContainerColor = androidx.compose.ui.graphics.Color.Transparent,
    focusedContainerColor = androidx.compose.ui.graphics.Color.Transparent,
)
