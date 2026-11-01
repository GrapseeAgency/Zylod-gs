package com.zylod.wholesale.ui.rewards

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.outlined.Casino
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SpinRowDto
import com.zylod.wholesale.ui.finance.formatMoneyDate

/** The web spin-history-page's amber accent pair (the screen owns colors). */
private val HistoryAmber = Color(0xFFF59E0B)
private val HistoryAmberDeep = Color(0xFFB45309)

/**
 * SHARED typed spin-history screen (pageIds spin-history + game-history —
 * the ui/screens delegates call THIS, pageId-keyed so each page keeps its
 * own [SpinHistoryViewModel]).
 *
 * Data truth: GET api/rewards/spin-history via [SpinHistoryViewModel] —
 * the last 50 spinWinResults rows (prize label verbatim, the server's
 * createdAt date, the Claimed chip the web row carries) plus the REAL
 * spinsToday / spinsRemaining counters in an honest summary line. The
 * game-history pageId renders the SAME feed with its own title and an
 * explicit scope note: the server's game ledger currently records Lucky
 * Spin & Win results, and the screen says exactly that instead of
 * inventing other game types. The honest empty state mirrors the web's
 * "No spin history recorded" card.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpinHistoryScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SpinHistoryViewModel = viewModel(key = "native-spin-history-$pageId") {
        SpinHistoryViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val gameHistoryLayout = pageId == "game-history"

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            HistoryTopBar(
                title = if (gameHistoryLayout) "Game History" else "Spin & Win History",
                onBack = onBack,
                onSpin = { openPage("spin-win", "") },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> if (gameHistoryLayout) {
                    RewardsAuthGate(
                        title = "Sign in to view game history",
                        body = "Score history shows your real mini game plays and points. Sign in to continue.",
                        onSignIn = { openPage("login", "") },
                    )
                } else {
                    RewardsAuthGate(
                        title = "Sign in to view your spin history",
                        body = "Spin & Win history shows the prizes won on your account. Sign in to continue.",
                        onSignIn = { openPage("login", "") },
                    )
                }
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> HistoryContent(state, gameHistoryLayout)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HistoryTopBar(title: String, onBack: (() -> Unit)?, onSpin: () -> Unit) {
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
            Button(
                onClick = onSpin,
                shape = RoundedCornerShape(12.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = HistoryAmber,
                    contentColor = Color(0xFF020617),
                ),
                modifier = Modifier
                    .padding(end = 8.dp)
                    .height(32.dp),
            ) {
                Text("Spin Wheel", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun HistoryContent(state: SpinHistoryUiState, gameHistoryLayout: Boolean) {
    val envelope = state.envelope
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved game ledger")
        }
        if (state.loading || envelope == null) {
            RewardsSkeleton()
            return@Column
        }
        if (gameHistoryLayout) {
            // The web's game-history page reads /api/mini-games — a feed
            // this batch does not re-host. The route that DOES serve this
            // account's game ledger is spin-history, and the header says
            // exactly that: what renders below is what the server returns.
            Surface(
                color = HistoryAmber.copy(alpha = 0.08f),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Casino,
                        null,
                        tint = HistoryAmberDeep,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "This account's game ledger records Lucky Spin & Win results — the feed below is exactly what the server returns.",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = HistoryAmberDeep,
                    )
                }
            }
        }
        envelope.spinsToday?.let { today ->
            Text(
                "Spins used today: $today of 3 · ${envelope.spinsRemaining ?: 0} left",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = HistoryAmberDeep,
            )
        }
        if (envelope.data.isEmpty()) {
            RewardsEmptyCard(
                icon = Icons.Outlined.CardGiftcard,
                title = "No spin history recorded",
                body = "Take your free daily turns on the Lucky Wheel to unlock prizes.",
            )
        } else {
            envelope.data.forEach { row ->
                SpinRowCard(row)
            }
        }
    }
}

/** One spinWinResults row (the web history card, verbatim structure). */
@Composable
private fun SpinRowCard(row: SpinRowDto) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(HistoryAmber.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
            ) {
                Icon(
                    Icons.Outlined.EmojiEvents,
                    null,
                    tint = HistoryAmberDeep,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    row.prizeLabel.orEmpty().ifBlank { "—" },
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    formatMoneyDate(row.createdAt).ifBlank { row.spinDate.orEmpty().ifBlank { "—" } },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Surface(
                color = HistoryAmber.copy(alpha = 0.1f),
                shape = RoundedCornerShape(50),
            ) {
                Text(
                    "Claimed",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = HistoryAmberDeep,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }
    }
}
