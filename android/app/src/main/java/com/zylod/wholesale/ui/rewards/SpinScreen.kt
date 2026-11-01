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
import androidx.compose.material.icons.outlined.Casino
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.TrendingUp
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
import com.zylod.wholesale.data.api.SpinPrizeDto

/**
 * The web spin-win-page's OWN wheel segment table (spin-win-page.tsx
 * PRIZES const, verbatim labels + colors) — the prize table the web draws
 * its wheel from. The POST route's segment list is route-internal (no GET
 * serves it), so the native screen renders THIS table and highlights the
 * row the server's segmentIndex answers. Colors are the web's own hexes.
 */
private data class SpinSegment(val label: String, val color: Color)

private val SPIN_SEGMENTS: List<SpinSegment> = listOf(
    SpinSegment("৳100 Voucher", Color(0xFFEF4444)),
    SpinSegment("50 Points", Color(0xFF00897B)),
    SpinSegment("৳250 Off", Color(0xFF10B981)),
    SpinSegment("Free Cargo", Color(0xFFF59E0B)),
    SpinSegment("200 Points", Color(0xFF8B5CF6)),
    SpinSegment("৳500 VIP", Color(0xFFEC4899)),
    SpinSegment("500 Points", Color(0xFFC62828)),
)

/** The web spin-win-page's amber accent pair (the screen owns colors). */
private val SpinAmber = Color(0xFFF59E0B)
private val SpinAmberDeep = Color(0xFFB45309)

/**
 * SHARED typed lucky-wheel screen (pageIds spin-wheel + spin-win — the
 * ui/screens delegates call THIS, pageId-keyed so each page keeps its own
 * [SpinViewModel]).
 *
 * Data truth: POST api/rewards/spin via [SpinViewModel], status from GET
 * api/rewards/spin-history (the same probe the web spin-win component
 * makes first for its "Daily Spins Left" counter). The web's flow is
 * mirrored honestly: "Spin the Lucky Wheel" header + its "Guaranteed
 * discount vouchers or loyalty points on every turn!" line, the static
 * prize-segment table (the component's own labels/colors — spins are
 * FREE, the route has no cost field, so the CTA reads "SPIN NOW (Free)"
 * like the web), the spin button gated on the server's spinsRemaining of
 * 3, and the WON banner showing the server's real prize verbatim (its
 * segmentIndex highlights the matching table row — there is NO fake wheel
 * animation that could pretend a prize before the server answers). 429s
 * surface the route's verbatim daily-cap text.
 *
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpinScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: SpinViewModel = viewModel(key = "native-spin-$pageId") {
        SpinViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            SpinTopBar(
                title = "Lucky Spin & Win",
                onBack = onBack,
                onHistory = { openPage("spin-history", "") },
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
                    title = "Sign in to spin & win",
                    body = "The Lucky Wheel rewards your account with vouchers and loyalty points. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> SpinContent(state, vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SpinTopBar(title: String, onBack: (() -> Unit)?, onHistory: () -> Unit) {
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
            IconButton(onClick = onHistory) {
                Icon(Icons.Outlined.History, "Past wins", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun SpinContent(state: SpinUiState, vm: SpinViewModel) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved spin status")
        }
        if (state.loading) {
            RewardsSkeleton()
            return@Column
        }
        Text(
            "Spin the Lucky Wheel",
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            color = SpinAmberDeep,
            textAlign = TextAlign.Center,
        )
        Text(
            "Guaranteed discount vouchers or loyalty points on every turn!",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        state.wonPrize?.let { prize ->
            WonPrizeCard(
                prize = prize,
                onDismiss = vm::consumeSpinResult,
            )
        }
        state.spinError?.let { message ->
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
        PrizeTable(state.wonSegmentIndex)
        val remaining = state.effectiveSpinsRemaining()
        val exhausted = remaining != null && remaining <= 0
        Button(
            onClick = vm::spin,
            enabled = !state.spinning && !exhausted,
            shape = RoundedCornerShape(18.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = SpinAmber,
                contentColor = Color(0xFF020617),
                disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
        ) {
            if (state.spinning) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = Color(0xFF020617),
                )
                Spacer(Modifier.width(8.dp))
                Text("Spinning the Wheel...", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            } else {
                Text(
                    if (exhausted) "No Spins Remaining Today" else "SPIN NOW (Free)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                )
            }
        }
        Text(
            buildString {
                append("Daily Spins Left: ")
                append(remaining ?: "—")
                append(" of 3")
            },
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = SpinAmberDeep,
        )
        Text(
            "Voucher wins land in your My Coupons vault (7-day validity); points wins credit your loyalty balance — both server-side.",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

/** The server-truth result banner — the REAL prize, verbatim. */
@Composable
private fun WonPrizeCard(prize: SpinPrizeDto, onDismiss: () -> Unit) {
    Surface(
        color = SpinAmber.copy(alpha = 0.08f),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, SpinAmber.copy(alpha = 0.4f), RoundedCornerShape(18.dp)),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Icon(Icons.Outlined.CheckCircle, null, tint = SpinAmberDeep, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    "Prize Unlocked",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = SpinAmberDeep,
                )
            }
            Text(
                prize.label.orEmpty().ifBlank { "—" },
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "Reward has been deposited into your My Coupons / Points vault!",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                Text("Dismiss", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * The static prize-segment table (the web component's own PRIZES list).
 * The row the server's segmentIndex answers gets the amber ring — honest
 * "you landed here" marking, no animation pretending a prize.
 */
@Composable
private fun PrizeTable(wonSegmentIndex: Int?) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Prize Table",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Icon(
                    Icons.Outlined.TrendingUp,
                    null,
                    tint = SpinAmberDeep,
                    modifier = Modifier.size(14.dp),
                )
            }
            SPIN_SEGMENTS.forEachIndexed { index, segment ->
                val isWon = wonSegmentIndex != null && wonSegmentIndex == index
                Surface(
                    color = if (isWon) SpinAmber.copy(alpha = 0.1f) else MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(
                            1.dp,
                            if (isWon) SpinAmber else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                            RoundedCornerShape(12.dp),
                        ),
                ) {
                    Row(
                        Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .background(segment.color, RoundedCornerShape(50)),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            segment.label,
                            fontSize = 12.sp,
                            fontWeight = if (isWon) FontWeight.Black else FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                        )
                        if (isWon) {
                            Icon(
                                Icons.Outlined.Star,
                                null,
                                tint = SpinAmberDeep,
                                modifier = Modifier.size(14.dp),
                            )
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Casino,
                    null,
                    tint = SpinAmberDeep,
                    modifier = Modifier.size(13.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "3 free turns per day — the wheel's odds live server-side.",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
