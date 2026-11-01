package com.zylod.wholesale.ui.rewards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ReferralUseRowDto
import com.zylod.wholesale.ui.finance.formatMoneyDate

/**
 * SHARED typed referral screen (pageIds referral-program +
 * referral-program-page + referral-earnings — the ui/screens delegates call
 * THIS; the web renders ONE GET for all three, so the native mirror does
 * too, layout keyed by [pageId] exactly like the web's two components).
 *
 * Data truth: GET api/referrals via [ReferralViewModel] —
 *  - PROGRAM layout (referral-program / referral-program-page): the
 *    "Give ৳200, Get 500 Points" banner (the web page's own copy), the
 *    invite-code card with the Copy Link affordance (LocalClipboardManager
 *    writes the route's shareUrl), the invited/points stats, and the
 *    "Have an Invite Code?" claim form — POST api/referrals/claim with the
 *    route's verbatim success message and 400/404/409 texts.
 *  - EARNINGS layout (referral-earnings): the total-points hero (the
 *    route's own math: 500 × the rewardGiven uses) and the invited
 *    merchants ledger with the web's email mask, dates and the credited
 *    chip (the row's own rewardGiven field decides "+500 Pts Credited" vs
 *    "Reward pending" — an honest split the web renders as a constant).
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferralScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ReferralViewModel = viewModel(key = "native-referral-$pageId") {
        ReferralViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val earningsLayout = pageId == "referral-earnings"

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ReferralTopBar(
                title = if (earningsLayout) "Referral Earnings Ledger" else "Refer & Earn",
                onBack = onBack,
                onCrossLink = { openPage(if (earningsLayout) "referral-program" else "referral-earnings", "") },
                crossLinkLabel = if (earningsLayout) "Share Code" else "Earnings History",
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
                    title = if (earningsLayout) "Sign in to view referral earnings" else "Sign in to use the referral program",
                    body = if (earningsLayout) {
                        "Referral rewards are credited to your account when invited merchants join. Sign in to see your real ledger."
                    } else {
                        "Invite codes and referral rewards are tied to your account. Sign in to get your real invite code."
                    },
                    onSignIn = { openPage("login", "") },
                )
            }
            state.error != null -> {
                val errorMessage = state.error
                RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
            }
            else -> if (earningsLayout) {
                ReferralEarningsContent(state = state)
            } else {
                ReferralProgramContent(state = state, vm = vm)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReferralTopBar(
    title: String,
    onBack: (() -> Unit)?,
    onCrossLink: () -> Unit,
    crossLinkLabel: String,
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
            TextButton(onClick = onCrossLink) {
                Text(
                    crossLinkLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── program layout (referral-program / referral-program-page) ──────────── */

@Composable
private fun ReferralProgramContent(state: ReferralUiState, vm: ReferralViewModel) {
    val clipboard = LocalClipboardManager.current
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.offlineFromCache) {
            item(key = "offline") {
                RewardsOfflineBanner("Offline — showing the last saved referral data")
            }
        }
        if (state.loading || state.referrals == null) {
            item(key = "loading") { RewardsSkeleton() }
            return@LazyColumn
        }
        val referrals = state.referrals
        item(key = "banner") {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        "MERCHANT REFERRAL NETWORK",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                    Text(
                        "Give ৳200, Get 500 Points",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        "Invite fellow wholesale retailers and factory buyers. They get ৳200 voucher + 300 points, and you receive 500 points per registered business!",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        item(key = "code-card") {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        "YOUR UNIQUE INVITE CODE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
                    ) {
                        Row(
                            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                referrals?.code.orEmpty().ifBlank { "—" },
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.weight(1f),
                            )
                            Button(
                                onClick = {
                                    referrals?.shareUrl?.takeIf(String::isNotBlank)?.let { url ->
                                        clipboard.setText(AnnotatedString(url))
                                        vm.copyLink()
                                    }
                                },
                                enabled = !referrals?.shareUrl.isNullOrBlank(),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = MaterialTheme.colorScheme.onPrimary,
                                ),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                modifier = Modifier.height(34.dp),
                            ) {
                                Text(
                                    if (state.linkCopied) "Copied Link" else "Copy Link",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ReferralStatTile(
                            label = "Invited Businesses",
                            value = "${referrals?.totalInvited ?: 0}",
                            modifier = Modifier.weight(1f),
                        )
                        ReferralStatTile(
                            label = "Points Earned",
                            value = "+${referrals?.totalPointsEarned ?: 0}",
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Text(
                        "Reward per verified business: ${referrals?.rewardPerReferral ?: 0} points · " +
                            "${referrals?.successfulReferrals ?: 0} verified of " +
                            "${referrals?.totalInvited ?: 0} invited",
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        item(key = "claim-result") {
            state.claimSuccessMessage?.let { message ->
                Surface(
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        message,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(14.dp),
                    )
                }
            }
        }
        item(key = "claim-form") {
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(24.dp)),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "HAVE AN INVITE CODE?",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "Enter a colleague's code below to claim your ৳200 welcome voucher and 300 bonus points.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    OutlinedTextField(
                        value = state.friendCode,
                        onValueChange = vm::setFriendCode,
                        label = { Text("e.g. ZY-8492", fontSize = 11.sp) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    state.claimError?.let { message ->
                        Text(
                            message,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                    Button(
                        onClick = vm::submitClaim,
                        enabled = !state.claiming && !state.friendCodeBlank,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                    ) {
                        if (state.claiming) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                            Spacer(Modifier.width(8.dp))
                            Text("Applying…", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        } else {
                            Text("Apply Code", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        item(key = "dismiss") {
            TextButton(
                onClick = vm::consumeClaimResult,
                enabled = state.claimSuccessMessage != null || state.claimError != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Dismiss result", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ReferralStatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/* ─── earnings layout (referral-earnings) ────────────────────────────────── */

@Composable
private fun ReferralEarningsContent(state: ReferralUiState) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.offlineFromCache) {
            item(key = "offline") {
                RewardsOfflineBanner("Offline — showing the last saved referral ledger")
            }
        }
        if (state.loading || state.referrals == null) {
            item(key = "loading") { RewardsSkeleton() }
            return@LazyColumn
        }
        val referrals = state.referrals
        item(key = "hero") {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "TOTAL REFERRAL REWARD POINTS",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                    )
                    Text(
                        "+${referrals?.totalPointsEarned ?: 0} Pts",
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        "Earned from ${referrals?.successfulReferrals ?: 0} verified business onboarding events.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                    )
                }
            }
        }
        item(key = "list-header") {
            Text(
                "Invited Merchants (${referrals?.referralHistory?.size ?: 0})",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (referrals?.referralHistory.isNullOrEmpty()) {
            item(key = "empty") {
                RewardsEmptyCard(
                    icon = Icons.Outlined.Person,
                    title = "No colleagues have registered with your invite code yet.",
                    body = "Share your code from the Refer & Earn page — every verified business signup credits you 500 points.",
                )
            }
        } else {
            items(referrals?.referralHistory ?: emptyList(), key = { it.stableKey }) { row ->
                ReferralLedgerRow(row)
            }
        }
    }
}

/**
 * One invited-merchant row — the web's masked email + join date, and the
 * credited chip decided by the row's OWN rewardGiven field (the web renders
 * "+500 Pts Credited" unconditionally; a rewardGiven=false row is a real
 * wire state, so it renders the honest "Reward pending" instead).
 */
@Composable
private fun ReferralLedgerRow(row: ReferralUseRowDto) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(38.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.08f), RoundedCornerShape(12.dp)),
            ) {
                Icon(
                    if (row.rewardGiven) Icons.Outlined.Inventory else Icons.Outlined.Person,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    maskReferralEmail(row.referredUser?.email),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Joined ${formatMoneyDate(row.createdAt).ifBlank { "—" }}",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Surface(
                color = if (row.rewardGiven) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                } else {
                    MaterialTheme.colorScheme.surfaceVariant
                },
                shape = RoundedCornerShape(50),
            ) {
                Text(
                    if (row.rewardGiven) "+500 Pts Credited" else "Reward pending",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (row.rewardGiven) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }
    }
}
