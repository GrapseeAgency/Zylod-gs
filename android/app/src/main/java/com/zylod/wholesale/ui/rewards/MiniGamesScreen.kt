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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.VideogameAsset
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.SpinHistoryEnvelope
import com.zylod.wholesale.ui.finance.formatMoneyDate

/** The web mini-games-page's red/rose gradient pair, flattened to one red. */
private val GamesRed = Color(0xFFDC2626)
private val GamesRedDeep = Color(0xFFB91C1C)

/** The daily check-in game card's flame accent (the check-in screen's own). */
private val GamesEmber = Color(0xFFEA580C)

/**
 * SHARED typed mini-games hub (pageId mini-games — the ui/screens delegate
 * calls THIS, pageId-keyed with its own [MiniGamesViewModel]).
 *
 * Data truth: the hub composes the TWO real game GETs (GET
 * api/rewards/checkin + GET api/rewards/spin-history via
 * [MiniGamesViewModel]) — the same two feeds the daily-checkin and
 * spin screens render. The web's trivia / memory / crate games live on
 * /api/mini-games, which this batch does not re-host, so the hub shows
 * exactly the two server-backed games with their REAL playable state:
 * the check-in card's streak + today's claim state, the wheel card's
 * real spins-left-of-3 counter, each opening its registered native
 * pageId via openPage, plus the recent-win rows and the High Scores jump
 * (the web's own header action) to game-history. No invented games.
 *
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MiniGamesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: MiniGamesViewModel = viewModel(key = "native-mini-games-$pageId") {
        MiniGamesViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            GamesTopBar(
                title = "Gamified Rewards",
                onBack = onBack,
                onScores = { openPage("game-history", "") },
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
                state.needsAuth -> RewardsAuthGate(
                    title = "Sign in to play & earn",
                    body = "Game rounds and the points you win are tied to your account. Sign in to see your real daily attempts and rewards.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> GamesContent(state, openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GamesTopBar(title: String, onBack: (() -> Unit)?, onScores: () -> Unit) {
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
            IconButton(onClick = onScores) {
                Icon(Icons.Outlined.History, "High Scores", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun GamesContent(
    state: MiniGamesUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved game state")
        }
        if (state.loading || (state.checkin == null && state.spin == null)) {
            RewardsSkeleton()
            return@Column
        }
        GamesHero()
        Text(
            "Available Games",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        state.checkin?.let { checkin ->
            CheckinGameCard(
                streak = checkin.currentStreak ?: 0,
                checkedInToday = checkin.checkedInToday,
                onPlay = { openPage("daily-checkin", "") },
            )
        }
        state.spin?.let { spin ->
            SpinGameCard(
                spinsRemaining = spin.spinsRemaining,
                spinsToday = spin.spinsToday,
                onPlay = { openPage("spin-wheel", "") },
            )
            RecentWins(spin)
        }
        Text(
            "Every reward above is served by the same routes the games screens render — no scores are stored on this device.",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The web mini-games-page hero (its copy verbatim, red rail flattened). */
@Composable
private fun GamesHero() {
    Surface(
        color = GamesRed,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.VideogameAsset, null, tint = Color(0xFFFDE68A), modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Play & Earn Wholesale Points",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFFFFE4E6),
                )
            }
            Text(
                "Real Games, Real Grading, Real Points",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFFF1F2),
            )
            Text(
                "Every score is earned against the server — check-ins are claimed on your account and spins are graded on the wheel. Points redeem for real order discounts.",
                fontSize = 11.sp,
                color = Color(0xFFFFE4E6),
            )
        }
    }
}

/** The Daily Check-in game card with its REAL account state inline. */
@Composable
private fun CheckinGameCard(streak: Int, checkedInToday: Boolean, onPlay: () -> Unit) {
    GameCard(
        icon = Icons.Outlined.LocalFireDepartment,
        iconTint = GamesEmber,
        title = "Daily Check-in",
        reward = "up to +500 Pts",
        stateLine = if (checkedInToday) {
            "Claimed today — Day $streak of your streak. Come back tomorrow."
        } else {
            "Day ${streak + 1} of your streak is claimable right now."
        },
        progress = null,
        actionLabel = "Check in Now",
        onAction = onPlay,
    )
}

/** The Lucky Spin & Win game card with its REAL spins-left counter inline. */
@Composable
private fun SpinGameCard(spinsRemaining: Int?, spinsToday: Int?, onPlay: () -> Unit) {
    val remaining = spinsRemaining ?: 0
    val exhausted = remaining <= 0
    GameCard(
        icon = Icons.Outlined.Casino,
        iconTint = GamesRedDeep,
        title = "Lucky Spin & Win",
        reward = "Free · 3/day",
        stateLine = if (spinsToday == null) {
            "3 free turns per day — sign-in state loads from the wheel."
        } else {
            "$spinsToday of 3 used today · $remaining left"
        },
        progress = spinsToday?.let { today ->
            (today.coerceIn(0, 3) / 3f)
        },
        actionLabel = if (exhausted) "Done today" else "Spin Wheel",
        onAction = onPlay,
    )
}

/** Shared game-card scaffold (the web's game rows, structure verbatim). */
@Composable
private fun GameCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    title: String,
    reward: String,
    stateLine: String,
    progress: Float?,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(44.dp)
                        .background(iconTint.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                ) {
                    Icon(icon, null, tint = iconTint, modifier = Modifier.size(22.dp))
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            color = iconTint.copy(alpha = 0.1f),
                            shape = RoundedCornerShape(50),
                        ) {
                            Text(
                                reward,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = iconTint,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            )
                        }
                    }
                    Text(
                        stateLine,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Button(
                    onClick = onAction,
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = GamesRedDeep,
                        contentColor = Color(0xFFFFFFFF),
                    ),
                    modifier = Modifier.height(34.dp),
                ) {
                    Text(actionLabel, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            progress?.let { value ->
                LinearProgressIndicator(
                    progress = { value.coerceIn(0f, 1f) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(50)),
                    color = iconTint,
                    trackColor = iconTint.copy(alpha = 0.15f),
                )
            }
        }
    }
}

/** The wheel's recent server-truth wins (the ledger's own rows). */
@Composable
private fun RecentWins(spin: SpinHistoryEnvelope) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Recent Wins",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
        val recent = spin.data.take(5)
        if (recent.isEmpty()) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "No spins recorded yet — the wheel's wins land here.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(14.dp),
                )
            }
        } else {
            recent.forEach { row ->
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.CheckCircle,
                            null,
                            tint = GamesRedDeep,
                            modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            row.prizeLabel.orEmpty().ifBlank { "—" },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            formatMoneyDate(row.createdAt).ifBlank { row.spinDate.orEmpty().ifBlank { "—" } },
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
