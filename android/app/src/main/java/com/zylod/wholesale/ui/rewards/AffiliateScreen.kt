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
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Public
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * SHARED typed affiliate screen (pageIds affiliate-program +
 * affiliate-dashboard — the ui/screens delegates call THIS, layout keyed by
 * [pageId] exactly like the web's two components).
 *
 * Data truth:
 *  - PROGRAM layout: GET api/affiliate via [AffiliateViewModel] — NOT
 *    enrolled → the hero ("5% Commission on Bulk Orders" / "Monetize Your
 *    B2B Industry Network", the web's own copy) + the free enroll CTA
 *    (POST, no body) whose verbatim success/refusal text renders inline;
 *    enrolled → the tracking-link card with the Copy affordance
 *    (LocalClipboardManager) and the jump to the analytics dashboard.
 *    Benefits grid mirrors the web's three backed-by-record cards.
 *  - DASHBOARD layout: GET api/affiliate/dashboard — the honest 404 gate
 *    ("Affiliate profile not found" verbatim + the join jump, NO zero-
 *    shaped KPI cards), or the KPI cards (Clicks / PO Orders / Conversion /
 *    Commission — the server's display strings), the pending/paid payout
 *    card and the conversions ledger's honest empty state (the route serves
 *    an always-empty list by its own t220 honesty fix). The payout button
 *    is an honest "Coming Soon" notice — NO payout-request API exists
 *    (the web's own t219 fix), so nothing pretends to submit.
 * Honest loading / sign-in / error / offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AffiliateScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: AffiliateViewModel = viewModel(key = "native-affiliate-$pageId") {
        AffiliateViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    val dashboardLayout = pageId == "affiliate-dashboard"

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            AffiliateTopBar(
                title = if (dashboardLayout) "Affiliate Partner Analytics" else "Affiliate Partner Program",
                onBack = onBack,
                onCrossLink = {
                    openPage(if (dashboardLayout) "affiliate-program" else "affiliate-dashboard", "")
                },
                crossLinkLabel = if (dashboardLayout) "My Link" else "Dashboard",
                crossLinkEnabled = if (dashboardLayout) true else state.enrolled == true,
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
                    title = if (dashboardLayout) "Sign in to view affiliate analytics" else "Sign in to join the affiliate program",
                    body = if (dashboardLayout) {
                        "Clicks, conversions, and pending payouts are your real account earnings. Sign in to continue."
                    } else {
                        "Affiliate tracking links and commissions belong to your account. Sign in to enroll."
                    },
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                dashboardLayout -> AffiliateDashboardContent(state = state, openPage = openPage)
                else -> AffiliateProgramContent(state = state, vm = vm, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AffiliateTopBar(
    title: String,
    onBack: (() -> Unit)?,
    onCrossLink: () -> Unit,
    crossLinkLabel: String,
    crossLinkEnabled: Boolean,
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
            TextButton(onClick = onCrossLink, enabled = crossLinkEnabled) {
                Text(
                    crossLinkLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (crossLinkEnabled) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    },
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

/* ─── program layout (affiliate-program) ─────────────────────────────────── */

@Composable
private fun AffiliateProgramContent(
    state: AffiliateUiState,
    vm: AffiliateViewModel,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved affiliate status")
        }
        if (state.loading) {
            RewardsSkeleton()
            return@Column
        }
        // Hero (the web page's own copy).
        Surface(
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Surface(
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.14f),
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        "5% Commission on Bulk Orders",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                }
                Text(
                    "Monetize Your B2B Industry Network",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    "Earn continuous 5% cash commissions on every completed purchase order placed by manufacturers and retailers you introduce.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                )
            }
        }
        when (state.enrolled) {
            true -> state.profile?.let { profile ->
                TrackingLinkCard(
                    profile = profile,
                    linkCopied = state.linkCopied,
                    onCopy = {
                        profile.trackingLink?.takeIf(String::isNotBlank)?.let { url ->
                            clipboard.setText(AnnotatedString(url))
                            vm.copyLink()
                        }
                    },
                    onOpenDashboard = { openPage("affiliate-dashboard", "") },
                )
            }
            false -> JoinCard(
                statusMessage = state.statusMessage,
                joinError = state.joinError,
                joining = state.joining,
                onJoin = vm::join,
            )
            else -> RewardsSkeleton()
        }
        state.joinSuccessMessage?.let { message ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CheckCircle, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        BenefitsGrid(state.profile)
    }
}

@Composable
private fun TrackingLinkCard(
    profile: com.zylod.wholesale.data.api.AffiliateProfileDto,
    linkCopied: Boolean,
    onCopy: () -> Unit,
    onOpenDashboard: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "YOUR UNIQUE TRACKING LINK",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                if (affiliateIsActive(profile.status)) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(50),
                    ) {
                        Text(
                            "Active Partner",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(14.dp)),
            ) {
                Row(
                    Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        profile.trackingLink.orEmpty().ifBlank { "—" },
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = onCopy,
                        enabled = !profile.trackingLink.isNullOrBlank(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                        modifier = Modifier.height(32.dp),
                    ) {
                        Text(if (linkCopied) "Copied" else "Copy", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Button(
                onClick = onOpenDashboard,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp),
            ) {
                Icon(Icons.Outlined.TrendingUp, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Open Full Analytics & Payouts Dashboard", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun JoinCard(statusMessage: String?, joinError: String?, joining: Boolean, onJoin: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(24.dp)),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Become a Certified Wholesale Affiliate",
                fontSize = 14.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Text(
                "Get instant access to tracked wholesale referral links, real-time commission analytics, and monthly bKash/bank account settlements.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            statusMessage?.takeIf(String::isNotBlank)?.let { message ->
                Text(
                    message,
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
            Button(
                onClick = onJoin,
                enabled = !joining,
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                if (joining) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("Setting up account…", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                } else {
                    Text("Enroll in Affiliate Program (Free)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            joinError?.let { message ->
                Text(
                    message,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/**
 * The web's three benefit cards — only claims the real affiliate record
 * backs (the commission % from the payload when present; the schema's 5%
 * default otherwise, which IS the route's own enroll rate).
 */
@Composable
private fun BenefitsGrid(profile: com.zylod.wholesale.data.api.AffiliateProfileDto?) {
    val commission = profile?.commissionPercent?.takeIf(String::isNotBlank) ?: "5%"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        BenefitCard(
            icon = Icons.Outlined.AccountBalanceWallet,
            title = "$commission Commission",
            body = "Earn ${commission.trimEnd('%')} of every completed wholesale order placed through your link.",
            modifier = Modifier.weight(1f),
        )
        BenefitCard(
            icon = Icons.Outlined.Public,
            title = "Tracked Referral Links",
            body = "Every click and order made through your unique link is counted in your dashboard.",
            modifier = Modifier.weight(1f),
        )
    }
    BenefitCard(
        icon = Icons.Outlined.CheckCircle,
        title = "Automatic Bank Payouts",
        body = "Approved commissions are transferred to your nominated BEFTN/bKash account.",
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun BenefitCard(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
            Text(
                title,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                body,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/* ─── dashboard layout (affiliate-dashboard) ─────────────────────────────── */

@Composable
private fun AffiliateDashboardContent(
    state: AffiliateUiState,
    openPage: (pageId: String, query: String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved affiliate analytics")
        }
        if (state.loading) {
            RewardsSkeleton()
            return@Column
        }
        state.dashboardNotFoundMessage?.let { message ->
            // The route's own 404 verdict — the honest not-enrolled gate.
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 40.dp),
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(72.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
                ) {
                    Icon(
                        Icons.Outlined.Lock,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(32.dp),
                    )
                }
                Text(
                    "No affiliate profile yet",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 14.dp),
                )
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Text(
                    "Join the program to get your tracked link — the analytics dashboard fills from your real clicks and orders.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Button(
                    onClick = { openPage("affiliate-program", "") },
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .padding(top = 20.dp)
                        .height(46.dp),
                ) {
                    Text("Open the Affiliate Program", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            return@Column
        }
        val dashboard = state.dashboard
        if (dashboard == null) {
            RewardsSkeleton()
            return@Column
        }
        // KPI cards (the server's display strings — never reformatted).
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Clicks", "${dashboard.stats?.totalClicks ?: 0}", Modifier.weight(1f))
            KpiCard("PO Orders", "${dashboard.stats?.totalOrders ?: 0}", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard("Conversion", dashboard.stats?.conversionRate.orEmpty().ifBlank { "0%" }, Modifier.weight(1f))
            KpiCard("Commission", dashboard.stats?.commissionRate.orEmpty().ifBlank { "5%" }, Modifier.weight(1f))
        }
        // Payout card + the honest "Coming Soon" notice (t219: NO
        // payout-request API exists — nothing pretends to submit).
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f), RoundedCornerShape(24.dp)),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "PENDING PAYOUT",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    formatBdt(dashboard.stats?.pendingPayoutBDT ?: 0.0),
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "Paid to date: ${formatBdt(dashboard.stats?.paidPayoutBDT ?: 0.0)} · " +
                        "Lifetime earnings ${formatBdt(dashboard.stats?.totalEarningsBDT ?: 0.0)}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "Payout transfers are not open yet. Your pending balance is tracked and will be payable when the affiliate payout program launches.",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        // Conversions ledger — the route serves an always-empty list (its
        // own honesty fix); render the honest empty state it implies.
        Surface(
            color = MaterialTheme.colorScheme.surfaceContainer,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Attributed Purchase Order Conversions",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (dashboard.recentConversions.isEmpty()) {
                    Text(
                        "No attributed conversions recorded yet. Orders placed through your tracking link will appear here.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    )
                } else {
                    dashboard.recentConversions.forEach { conversion ->
                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Outlined.Inventory,
                                null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(15.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                conversion.orderNumber.orEmpty(),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.weight(1f),
                            )
                            Text(
                                "+${formatBdt(conversion.commissionBDT ?: 0.0)}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiCard(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(16.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
