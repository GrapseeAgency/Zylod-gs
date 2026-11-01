package com.zylod.wholesale.ui.rewards

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.RewardsBookDto
import com.zylod.wholesale.data.api.RewardsHistoryRowDto
import com.zylod.wholesale.data.api.RewardsRedeemOptionDto
import com.zylod.wholesale.ui.finance.formatMoneyDate
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed rewards screen (pageIds buyer-rewards + reward-points — the
 * ui/screens delegates call THIS, so each page keeps its own
 * [RewardsViewModel] instance, pageId-keyed).
 *
 * Data truth: GET api/rewards via [RewardsViewModel] — the buyer-scoped
 * full book: the points-balance hero (balance + totalEarned/totalRedeemed),
 * the server's tier + next-tier progress bar, the fixed wallet-credit
 * redemption catalog (POST api/rewards — the redeem action the web's
 * redeem-points flow performs against THIS route, with the verbatim
 * success message + the REAL walletBalanceAfter), and the last-50 ledger
 * (earn/redeem chips, the ledger's own ± sign, descriptions verbatim).
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RewardsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: RewardsViewModel = viewModel(key = "native-rewards-$pageId") {
        RewardsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            RewardsTopBar(
                title = if (pageId == "buyer-rewards") "Buyer Rewards" else "Reward Points",
                onBack = onBack,
                onLoyalty = { openPage("loyalty-points", "") },
            )
        },
    ) { padding ->
        when {
            state.needsAuth -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                RewardsAuthGate(
                    title = "Sign in to view your reward points",
                    body = "Reward points are earned on wholesale purchase orders, reviews, referrals and the daily check-in. Sign in to see your real balance.",
                    onSignIn = { openPage("login", "") },
                )
            }
            state.error != null -> {
                val errorMessage = state.error
                RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
            }
            else -> RewardsContent(
                state = state,
                vm = vm,
                onOpenLoyalty = { openPage("loyalty-points", "") },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RewardsTopBar(title: String, onBack: (() -> Unit)?, onLoyalty: () -> Unit) {
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
            IconButton(onClick = onLoyalty) {
                Icon(Icons.Outlined.Star, "Loyalty tiers", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun RewardsContent(state: RewardsUiState, vm: RewardsViewModel, onOpenLoyalty: () -> Unit) {
    val book = state.book
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.offlineFromCache) {
            item(key = "offline") {
                RewardsOfflineBanner("Offline — showing the last saved reward points")
            }
        }
        if (state.loading || book == null) {
            item(key = "loading") { RewardsSkeleton() }
            return@LazyColumn
        }
        item(key = "balance") { BalanceHero(book) }
        item(key = "redeem-result") {
            state.redeemSuccessMessage?.let { message ->
                RedeemSuccessCard(
                    message = message,
                    label = state.redeemSuccessLabel,
                    walletBalanceAfter = state.redeemWalletBalanceAfter,
                    onDismiss = vm::consumeRedeemResult,
                )
            }
        }
        item(key = "redeem-error") {
            state.redeemError?.let { message ->
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
        }
        item(key = "catalog") { RedeemCatalog(book, state, vm::redeem) }
        item(key = "history-header") { HistoryHeader(book) }
        if (book.history.isEmpty()) {
            item(key = "history-empty") {
                RewardsEmptyCard(
                    icon = Icons.Outlined.Schedule,
                    title = "No reward transactions yet",
                    body = "Every point you earn — orders, reviews, referrals, check-ins — and every redemption lands in this ledger.",
                )
            }
        } else {
            items(book.history, key = { it.stableKey }) { row ->
                HistoryRow(row)
            }
        }
        item(key = "loyalty-link") {
            TextButton(onClick = onOpenLoyalty, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Outlined.Star, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text(
                    "View loyalty tiers & progress",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/** The points hero: balance, tier chip, earned/redeemed counters, progress. */
@Composable
private fun BalanceHero(book: RewardsBookDto) {
    val progress = book.nextTier?.progressPct?.coerceIn(0, 100)
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.14f),
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        "${tierLabel(book.tier)} Tier Merchant",
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
                "${book.balance ?: 0}",
                fontSize = 40.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            Text(
                "Earned ${book.totalEarned ?: 0} · Redeemed ${book.totalRedeemed ?: 0}",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
            )
            book.nextTier?.let { next ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(
                            "Next Tier: ${tierLabel(next.tier)}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Text(
                            "+${next.pointsNeeded ?: 0} pts needed",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                        )
                    }
                    LinearProgressIndicator(
                        progress = { (progress ?: 0) / 100f },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(50)),
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        trackColor = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                    )
                }
            } ?: Text(
                "Highest tier achieved!",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
    }
}

/** The route's inline success card — verbatim message + real balance. */
@Composable
private fun RedeemSuccessCard(
    message: String,
    label: String?,
    walletBalanceAfter: Double?,
    onDismiss: () -> Unit,
) {
    val confirm = MaterialTheme.colorScheme.primary
    Surface(
        color = confirm.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, confirm.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CheckCircle, null, tint = confirm, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = confirm,
                )
            }
            Text(
                buildString {
                    append(label?.takeIf(String::isNotBlank) ?: "Wallet credit")
                    append(" — the credit is in your wallet")
                    walletBalanceAfter?.let { append(" (balance now ${formatBdt(it)})") }
                    append(", with a full ledger entry.")
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

/** The 4-option wallet-credit catalog (the route's fixed list). */
@Composable
private fun RedeemCatalog(book: RewardsBookDto, state: RewardsUiState, onRedeem: (String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Redeem Points for Wallet Credit",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (book.redeemOptions.isEmpty()) {
                Text(
                    "The redemption catalog is not available right now.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                book.redeemOptions.forEach { option ->
                    RedeemOptionRow(option, state, onRedeem)
                }
            }
        }
    }
}

@Composable
private fun RedeemOptionRow(option: RewardsRedeemOptionDto, state: RewardsUiState, onRedeem: (String) -> Unit) {
    val optionId = option.id.orEmpty()
    val busy = state.redeemingId == optionId
    val balance = state.book?.balance ?: 0
    val needed = option.points ?: 0
    val affordable = balance >= needed
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(16.dp)),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(38.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
            ) {
                Icon(Icons.Outlined.LocalOffer, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    option.label.orEmpty(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "$needed points",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(
                onClick = { onRedeem(optionId) },
                enabled = !busy && optionId.isNotBlank() && affordable,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                modifier = Modifier.height(34.dp),
            ) {
                if (busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                } else {
                    Text(
                        "Redeem",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun HistoryHeader(book: RewardsBookDto) {
    Text(
        "Points History (${book.history.size})",
        fontSize = 11.sp,
        fontWeight = FontWeight.Black,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp),
    )
}

/** One ledger row — type chip, the ledger's own ± points, description. */
@Composable
private fun HistoryRow(row: RewardsHistoryRowDto) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(38.dp)
                    .background(rewardTxTint(row.type).asColor().container.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
            ) {
                Icon(
                    if (row.type?.trim()?.lowercase() == "redeem") Icons.Outlined.LocalOffer else Icons.Outlined.Star,
                    null,
                    tint = rewardTxTint(row.type).asColor().container,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        row.type?.trim()?.uppercase()?.takeIf(String::isNotEmpty) ?: "—",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = rewardTxTint(row.type).asColor().container,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        formatMoneyDate(row.createdAt).ifBlank { "—" },
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    row.description.orEmpty().ifBlank { "—" },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                )
            }
            Text(
                formatSignedPoints(row.points),
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/* ─── shared rewards-package states (all five t259 screens use these) ────── */

/** The tint triple the package's chips/icons map onto theme roles. */
internal data class RewardsTint(val container: Color)

internal fun RewardTxTint.asColor(): RewardsTint = RewardsTint(
    container = when (this) {
        RewardTxTint.EMERALD -> Color(0xFF2E7D32)
        RewardTxTint.AMBER -> Color(0xFFB26A00)
        RewardTxTint.ROSE -> Color(0xFFC62828)
        RewardTxTint.NEUTRAL -> Color(0xFF616161)
    },
)

/**
 * The honest signed-out gate (FinanceAuthGate parity): copy + a soft Sign
 * In jump — no hard redirect, no fabricated content behind it.
 */
@Composable
internal fun RewardsAuthGate(title: String, body: String, onSignIn: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
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
            title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            body,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = onSignIn,
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
    }
}

/** Honest failure card (load errors): Retry re-runs the full fetch. */
@Composable
internal fun RewardsErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.06f),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Could not load this page", fontSize = 13.sp, fontWeight = FontWeight.Black, color = error)
            }
            Text(
                message,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = error, contentColor = MaterialTheme.colorScheme.onError),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Honest empty card — real icon + copy, never a fabricated placeholder. */
@Composable
internal fun RewardsEmptyCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    body: String,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(56.dp)
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
            ) {
                Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(26.dp))
            }
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Text(
                body,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Resolving — the two pulsing skeleton cards (FinanceSkeleton parity). */
@Composable
internal fun RewardsSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(Modifier.fillMaxWidth().height(140.dp))
        }
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Box(Modifier.fillMaxWidth().height(120.dp))
        }
    }
}

/** Amber banner over the cached snapshot — the FinanceOfflineBanner style. */
@Composable
internal fun RewardsOfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = warning)
        }
    }
}

/** One selectable pill (FilterChipButton parity, package-local). */
@Composable
internal fun RewardsChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
        )
    }
}
