package com.zylod.wholesale.ui.rewards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.CheckinRowDto

/**
 * The web daily-checkin-page's flame accent (orange-500/600 pair) — the
 * t259 tint convention (RewardsScreen.asColor): the screen owns colors.
 */
private val CheckinOrange = Color(0xFFEA580C)
private val CheckinOrangeDeep = Color(0xFFC2410C)
private val CheckinOnOrange = Color(0xFFFFF7ED)
private val CheckinClaimed = Color(0xFF2E7D32)

/** True when the pageId renders the web's checkin-streak ledger layout. */
private fun isStreakPage(pageId: String): Boolean = pageId == "checkin-streak"

/**
 * SHARED typed daily check-in screen (pageIds daily-checkin +
 * checkin-streak — the ui/screens delegates call THIS, pageId-keyed so
 * each page keeps its own [CheckinViewModel]).
 *
 * Data truth: GET api/rewards/checkin via [CheckinViewModel] — the SAME
 * route the web renders on both pageIds, with each id's own layout:
 *
 *  - daily-checkin → daily-checkin-page.tsx: the "Active Streak" flame
 *    hero ("X Days In A Row"), the server's own 7-Day Reward Ladder grid
 *    (claimed/today/future states mirrored exactly from the component's
 *    isPastOrToday / isToday math), and the REAL claim: the button
 *    disabled on the GET's checkedInToday truth, POST success shows the
 *    route's message verbatim and re-fetches; 409 "You have already
 *    checked in today! Come back tomorrow." and 429 rate-limit text
 *    surface verbatim. No fake wheel/animation anywhere.
 *  - checkin-streak → checkin-streak-page.tsx: the "Current Consecutive
 *    Streak" summary and the "Recent Check-in Ledger" rows (Day N Streak
 *    Milestone / checkinDate / +points) — the honest empty state when the
 *    account has never checked in.
 *
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckinScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CheckinViewModel = viewModel(key = "native-checkin-$pageId") {
        CheckinViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val streakLayout = isStreakPage(pageId)

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CheckinTopBar(
                title = if (streakLayout) "Streak Milestones & Logs" else "Daily Check-in",
                onBack = onBack,
                actionLabel = if (streakLayout) "Check-in Now" else "Streak Milestones →",
                onAction = { openPage(if (streakLayout) "daily-checkin" else "checkin-streak", "") },
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
                state.needsAuth -> if (streakLayout) {
                    RewardsAuthGate(
                        title = "Sign in to view your check-in streak",
                        body = "Your streak and check-in ledger come from your real account. Sign in to continue.",
                        onSignIn = { openPage("login", "") },
                    )
                } else {
                    RewardsAuthGate(
                        title = "Sign in to claim daily check-in",
                        body = "Daily check-in awards loyalty points to your real account. Sign in to continue.",
                        onSignIn = { openPage("login", "") },
                    )
                }
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> if (streakLayout) {
                    StreakContent(state)
                } else {
                    CheckinContent(state, vm)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CheckinTopBar(
    title: String,
    onBack: (() -> Unit)?,
    actionLabel: String,
    onAction: () -> Unit,
) {
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
            TextButton(onClick = onAction) {
                Text(
                    actionLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = CheckinOrange,
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── daily-checkin: the claim flow ──────────────────────────────────────── */

@Composable
private fun CheckinContent(state: CheckinUiState, vm: CheckinViewModel) {
    val status = state.status
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved check-in status")
        }
        if (state.loading || status == null) {
            RewardsSkeleton()
            return@Column
        }
        StreakHero(status.currentStreak ?: 0)
        RewardLadder(status.currentStreak ?: 0, status.checkedInToday, status.schedule)
        state.checkinSuccessMessage?.let { message ->
            CheckinSuccessCard(
                message = message,
                streak = state.checkinSuccessStreak,
                points = state.checkinSuccessPoints,
                onDismiss = vm::consumeCheckinResult,
            )
        }
        state.checkinError?.let { message ->
            Surface(
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.08f),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(14.dp),
                )
            }
        }
        val claimed = status.checkedInToday
        Button(
            onClick = vm::checkin,
            enabled = !claimed && !state.checkingIn,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CheckinOrange,
                contentColor = CheckinOnOrange,
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            if (state.checkingIn) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = CheckinOnOrange,
                )
                Spacer(Modifier.width(8.dp))
                Text("Claiming Points...", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            } else {
                Text(
                    if (claimed) "Checked in Today (Come back tomorrow)" else "Claim Today’s Check-in Points",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        status.todayReward?.let { reward ->
            Text(
                "Today's claimable reward: +$reward points",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = CheckinOrangeDeep,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        }
        Text(
            "Points can be converted into discount vouchers or wallet funds in the Redeem center.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}

/** The web's "Active Streak" gradient hero, simplified to its orange-600. */
@Composable
private fun StreakHero(currentStreak: Int) {
    Surface(
        color = CheckinOrange,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(64.dp)
                    .background(CheckinOnOrange.copy(alpha = 0.2f), RoundedCornerShape(50)),
            ) {
                Icon(
                    Icons.Outlined.LocalFireDepartment,
                    null,
                    tint = CheckinOnOrange,
                    modifier = Modifier.size(32.dp),
                )
            }
            Text(
                "Active Streak",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = CheckinOnOrange.copy(alpha = 0.9f),
            )
            Text(
                "$currentStreak Days In A Row",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = CheckinOnOrange,
            )
            Text(
                "Check in every consecutive day to multiply your wholesale point rewards up to 500 points on Day 7.",
                fontSize = 11.sp,
                color = CheckinOnOrange.copy(alpha = 0.9f),
                textAlign = TextAlign.Center,
            )
        }
    }
}

/**
 * The server's 7-Day Reward Ladder (rewards/checkin GET schedule), with the
 * web component's own claimed/today/future math mirrored exactly:
 * isPastOrToday = dayNum <= currentStreak && checkedInToday;
 * isToday = dayNum == currentStreak + 1 || (dayNum == currentStreak && !checkedInToday).
 */
@Composable
private fun RewardLadder(currentStreak: Int, checkedInToday: Boolean, schedule: List<Int>) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "7-Day Reward Ladder",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Cycle Resets Day 7",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CheckinOrange,
                )
            }
            if (schedule.isEmpty()) {
                Text(
                    "The reward schedule is not available right now.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                // The web's mobile grid is 4 columns → rows of 4 then 3.
                schedule.withIndex().forEach { (index, _) ->
                    if (index % 4 == 0) {
                        val row = schedule.drop(index).take(4)
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            row.forEachIndexed { offset, pts ->
                                DayCard(
                                    dayNum = index + offset + 1,
                                    points = pts,
                                    currentStreak = currentStreak,
                                    checkedInToday = checkedInToday,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCard(
    dayNum: Int,
    points: Int,
    currentStreak: Int,
    checkedInToday: Boolean,
    modifier: Modifier = Modifier,
) {
    val isPastOrToday = dayNum <= currentStreak && checkedInToday
    val isToday = dayNum == currentStreak + 1 || (dayNum == currentStreak && !checkedInToday)
    val bg = when {
        isPastOrToday -> CheckinClaimed.copy(alpha = 0.08f)
        isToday -> CheckinOrange.copy(alpha = 0.08f)
        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    }
    val border = when {
        isPastOrToday -> CheckinClaimed.copy(alpha = 0.35f)
        isToday -> CheckinOrange.copy(alpha = 0.6f)
        else -> MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
    }
    val content = when {
        isPastOrToday -> CheckinClaimed
        isToday -> CheckinOrangeDeep
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        color = bg,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.border(1.dp, border, RoundedCornerShape(14.dp)),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 4.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Text("Day $dayNum", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = content)
            Text("+$points", fontSize = 12.sp, fontWeight = FontWeight.Black, color = content)
            Icon(
                if (isPastOrToday) Icons.Outlined.CheckCircle else Icons.Outlined.CardGiftcard,
                null,
                tint = content,
                modifier = Modifier.size(14.dp),
            )
        }
    }
}

/** The route's inline success card — verbatim message + the confirmed row. */
@Composable
private fun CheckinSuccessCard(
    message: String,
    streak: Int?,
    points: Int?,
    onDismiss: () -> Unit,
) {
    Surface(
        color = CheckinClaimed.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, CheckinClaimed.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CheckCircle, null, tint = CheckinClaimed, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = CheckinClaimed,
                )
            }
            Text(
                buildString {
                    append("Day ")
                    append(streak ?: 1)
                    append(" streak milestone")
                    points?.let { append(" · +$it loyalty points") }
                    append(" — credited with a full ledger entry.")
                },
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                Text("Dismiss", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/* ─── checkin-streak: the summary + ledger ───────────────────────────────── */

@Composable
private fun StreakContent(state: CheckinUiState) {
    val status = state.status
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved check-in streak")
        }
        if (state.loading || status == null) {
            RewardsSkeleton()
            return@Column
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    "Current Consecutive Streak",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "${status.currentStreak ?: 0} Days",
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    color = CheckinOrange,
                )
                Text(
                    "Keep opening Zylod daily without breaking the chain to maximize bonus payouts.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
        Text(
            "Recent Check-in Ledger",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (status.history.isEmpty()) {
            RewardsEmptyCard(
                icon = Icons.Outlined.LocalFireDepartment,
                title = "No previous check-in records found. Start today!",
                body = "Every daily claim lands here with its streak milestone and the points it credited.",
            )
        } else {
            status.history.forEach { row ->
                CheckinLedgerRow(row)
            }
        }
    }
}

/** One dailyCheckins ledger row (the web streak page's card, verbatim). */
@Composable
private fun CheckinLedgerRow(row: CheckinRowDto) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(36.dp)
                    .background(CheckinOrange.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
            ) {
                Icon(
                    Icons.Outlined.CheckCircle,
                    null,
                    tint = CheckinOrange,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Day ${row.streakCount ?: 1} Streak Milestone",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    row.checkinDate.orEmpty().ifBlank { "—" },
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                "+${row.pointsAwarded ?: 0} Pts",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = CheckinOrangeDeep,
            )
        }
    }
}
