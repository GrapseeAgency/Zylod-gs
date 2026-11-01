package com.zylod.wholesale.ui.rewards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Star
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed loyalty screen (pageIds loyalty-points + loyalty-program —
 * the ui/screens delegates call THIS; the web renders the SAME
 * loyalty-points component for both ids, so the native mirror does too).
 *
 * Data truth: GET api/rewards/loyalty via [LoyaltyViewModel] — the tier
 * hero card (available balance, the server's tier chip, ≈ cash value at
 * the route's own 10 pts = ৳1, the tierProgressPercent bar and the
 * nextTier / pointsNeededForNextTier pair — or "Highest Tier Achieved!"),
 * the tier ladder built from the route's documented bands (bronze 0 /
 * silver 1,000 / gold 5,000 / platinum 15,000 with the current tier
 * highlighted and the progress to next), and the web page's OWN
 * "Quick Ways to Earn Points" rows (its copy verbatim) — navigation rows,
 * exactly what the web rows are (their targets — daily-checkin, spin-win,
 * category-browser, referral-program — are separate pageIds this batch
 * does not re-host). Honest loading / sign-in / error / offline states —
 * nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoyaltyScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: LoyaltyViewModel = viewModel(key = "native-loyalty-$pageId") {
        LoyaltyViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            LoyaltyTopBar(
                title = if (pageId == "loyalty-program") "Loyalty Program" else "Loyalty Points",
                onBack = onBack,
                onRedeem = { openPage("redeem-points", "") },
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
                    title = "Sign in to view loyalty points",
                    body = "Loyalty points are earned on wholesale purchase orders, reviews, and referrals. Sign in to see your real balance.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> LoyaltyContent(state = state, pageId = pageId, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoyaltyTopBar(title: String, onBack: (() -> Unit)?, onRedeem: () -> Unit) {
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
            IconButton(onClick = onRedeem) {
                Icon(Icons.Outlined.Star, "Redeem points", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun LoyaltyContent(
    state: LoyaltyUiState,
    pageId: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved loyalty points")
        }
        if (state.loading) {
            RewardsSkeleton()
            return@Column
        }
        state.loyalty?.let { loyalty ->
            TierHero(loyalty)
            TierLadder(loyalty)
            QuickWaysToEarn(
                onOpenCheckin = { openPage("daily-checkin", "") },
                onOpenReferrals = { openPage("referral-program", "") },
                onOpenSpin = { openPage("spin-win", "") },
                onOpenBrowse = { openPage("category-browser", "") },
            )
        }
    }
}

/** The tier hero — balance, tier chip, cash value, progress to next. */
@Composable
private fun TierHero(loyalty: com.zylod.wholesale.data.api.LoyaltyStatusDto) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.14f),
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        "${tierLabel(loyalty.tier)} Tier Merchant",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                Text(
                    "10 Pts = ৳1 BDT",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                )
            }
            Text(
                "Available Point Balance",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
            )
            Text(
                "${loyalty.pointsBalance ?: 0}",
                fontSize = 40.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                "≈ ${formatBdt((loyalty.cashValueBDT ?: 0).toDouble())} Wholesale Credit Value",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    val next = loyalty.nextTier.orEmpty()
                    Text(
                        if (next == "max") "Next Tier: —" else "Next Tier: ${tierLabel(next)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        if (next == "max") {
                            "Highest Tier Achieved!"
                        } else {
                            "+${loyalty.pointsNeededForNextTier ?: 0} pts needed"
                        },
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                    )
                }
                LinearProgressIndicator(
                    progress = { ((loyalty.tierProgressPercent ?: 0).coerceIn(0, 100)) / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(50)),
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    trackColor = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                )
            }
        }
    }
}

/**
 * The tier ladder — the route's OWN bands (bronze 0 / silver 1,000 /
 * gold 5,000 / platinum 15,000 on totalEarned), current tier highlighted,
 * each rung showing the band entry and the earned-so-far count.
 */
@Composable
private fun TierLadder(loyalty: com.zylod.wholesale.data.api.LoyaltyStatusDto) {
    val currentIndex = tierIndexFor(loyalty.totalEarned)
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(24.dp)),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "Membership Tiers",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            REWARD_TIERS.forEachIndexed { index, (tier, min) ->
                val current = index == currentIndex
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(34.dp)
                            .background(
                                if (current) {
                                    MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                } else {
                                    MaterialTheme.colorScheme.surface
                                },
                                RoundedCornerShape(50),
                            ),
                    ) {
                        Icon(
                            if (current) Icons.Outlined.CheckCircle else Icons.Outlined.Star,
                            null,
                            tint = if (current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(17.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                tierLabel(tier),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (current) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            )
                            if (current) {
                                Spacer(Modifier.width(8.dp))
                                Surface(
                                    color = MaterialTheme.colorScheme.primary,
                                    shape = RoundedCornerShape(50),
                                ) {
                                    Text(
                                        "YOUR TIER",
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Black,
                                        color = MaterialTheme.colorScheme.onPrimary,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                    )
                                }
                            }
                        }
                        Text(
                            "From $min points" + if (index < REWARD_TIERS.lastIndex) {
                                " · up to ${REWARD_TIERS[index + 1].second - 1}"
                            } else {
                                " · and beyond"
                            },
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Text(
                "Tier is computed from your lifetime earned points — every earn moves it, redemptions never demote it.",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * The web page's OWN quick-earn rows (loyalty-points-page.tsx:186-190
 * copy verbatim) — pure navigation, exactly what the web rows are: each
 * target is its own pageId (daily-checkin / spin-win / category-browser /
 * referral-program), registered in the native registry the same way.
 */
@Composable
private fun QuickWaysToEarn(
    onOpenCheckin: () -> Unit,
    onOpenReferrals: () -> Unit,
    onOpenSpin: () -> Unit,
    onOpenBrowse: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Quick Ways to Earn Points",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            QuickEarnRow(
                title = "Daily App Check-in",
                pts = "+50 to +500 Pts",
                onClick = onOpenCheckin,
            )
            QuickEarnRow(
                title = "Lucky Spin & Win",
                pts = "Up to +500 Pts",
                onClick = onOpenSpin,
            )
            QuickEarnRow(
                title = "Wholesale Purchase Orders",
                pts = "1 Pt per ৳100 spent",
                onClick = onOpenBrowse,
            )
            QuickEarnRow(
                title = "Invite Retail Colleagues",
                pts = "+500 Pts per signup",
                onClick = onOpenReferrals,
            )
        }
    }
}

@Composable
private fun QuickEarnRow(title: String, pts: String, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Outlined.Schedule,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                title,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Text(
                "$pts →",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
