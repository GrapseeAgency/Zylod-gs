package com.zylod.wholesale.ui.vip

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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Percent
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.WorkspacePremium
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.session.SessionManager
import com.zylod.wholesale.data.api.VipTierDto
import com.zylod.wholesale.ui.rewards.RewardsAuthGate
import com.zylod.wholesale.ui.rewards.RewardsEmptyCard
import com.zylod.wholesale.ui.rewards.RewardsErrorCard
import com.zylod.wholesale.ui.rewards.RewardsOfflineBanner
import com.zylod.wholesale.ui.rewards.RewardsSkeleton
import com.zylod.wholesale.ui.wallet.formatBdt

/**
 * The web vip-components' amber accent (amber-400/500 pair), parsed once —
 * the t259 tint convention (RewardsScreen.asColor): the screen owns colors.
 */
private val VipAmber = Color(0xFFF59E0B)
private val VipAmberDeep = Color(0xFFB45309)
private val VipOnAmber = Color(0xFF020617)

/** #RRGGBB / #RGB → Color, or null when the hex fails [vipTierHex] checks. */
private fun tierColor(hex: String?): Color? {
    val sanitized = vipTierHex(hex) ?: return null
    val body = sanitized.drop(1)
    val expanded = if (body.length == 3) body.map { "$it$it" }.joinToString("") else body
    val value = expanded.toLongOrNull(16) ?: return null
    return Color(0xFF000000L or value)
}

/**
 * SHARED typed VIP screen (pageIds vip-benefits + vip-benefits-page +
 * vip-club + vip-membership + vip-program — the ui/screens delegates call
 * THIS, pageId-keyed so each page keeps its own [VipViewModel]).
 *
 * The five ids map to TWO web components (src/lib/page-chunks/chunk-misc.ts),
 * and the layout branch mirrors that split exactly:
 *
 *  - vip-benefits / vip-benefits-page → vip-benefits-page.tsx: the
 *    "Enterprise Procurement Privileges" header, the REAL tier ladder as
 *    cards (name, minSpendBDT via WalletFormat, the route's verbatim
 *    benefit bullets, badge chip, the route's own color hex on the tier
 *    icon, "Your tier" chip on the current card — no sign-in gate; the web
 *    renders it for guests too) and the "View Exclusive Mill Deals" CTA.
 *  - vip-club / vip-membership / vip-program → vip-membership-page.tsx:
 *    sign-in gate first (the web's AccountGate copy verbatim), then the
 *    amber status hero ("{Tier} Member" badge + Annual Wholesale Volume =
 *    the route's real totalSpendBDT), the web's four fixed privilege rows
 *    (its own UI copy verbatim), the real tier-privilege matrix (the same
 *    ladder cards, so the club pages carry the API's benefits too) and the
 *    "Browse VIP Exclusive Deals" CTA.
 *
 * Progress-to-next-tier: GET api/vip carries NO nextTier object and no
 * per-user progress — the screen renders the real spend + ladder and
 * never an invented progress bar. Honest loading / gate / error / offline
 * states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VipScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: VipViewModel = viewModel(key = "native-vip-$pageId") {
        VipViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            VipTopBar(
                title = if (vipIsLadder(pageId)) "VIP Wholesale Enterprise Club" else "VIP Wholesale Club",
                onBack = onBack,
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
                    title = "Sign in to view your VIP status",
                    body = "VIP tier and annual wholesale volume are calculated from your real order history. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    RewardsErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> VipContent(state = state, pageId = pageId, openPage = openPage)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun VipTopBar(title: String, onBack: (() -> Unit)?) {
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
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun VipContent(
    state: VipUiState,
    pageId: String,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val vip = state.vip
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            RewardsOfflineBanner("Offline — showing the last saved VIP tier ladder")
        }
        if (state.loading || vip == null) {
            RewardsSkeleton()
            return@Column
        }
        val ladder = vipIsLadder(pageId)
        if (ladder) {
            LadderHeader(vip.totalSpendBDT)
        } else {
            StatusHero(vip.currentTier, vip.totalSpendBDT)
            ClubPrivileges()
        }
        if (vip.tiers.isEmpty()) {
            RewardsEmptyCard(
                icon = Icons.Outlined.WorkspacePremium,
                title = "No VIP tiers configured",
                body = "The platform has not published its tier ladder yet — this page will not guess at the privileges.",
            )
        } else {
            TierMatrix(vip.currentTier, vip.tiers)
        }
        VipCta(
            label = if (ladder) "View Exclusive Mill Deals →" else "Browse VIP Exclusive Deals 💎",
            onOpen = { openPage("exclusive-deals", "") },
        )
    }
}

/** The web vip-benefits-page header block (its copy verbatim). */
@Composable
private fun LadderHeader(totalSpendBDT: Double?) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp, bottom = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            "Enterprise Procurement Privileges",
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            color = VipAmberDeep,
            textAlign = TextAlign.Center,
        )
        Text(
            "Membership tiers are based on your verified lifetime spend on Zylod.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        // The web renders the spend line ONLY for a signed-in viewer — the
        // guest payload's 0 is never shown as if it were a real balance.
        if (SessionManager.token() != null && totalSpendBDT != null) {
            Text(
                "Your lifetime paid spend: ${formatBdt(totalSpendBDT)}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** The web vip-membership-page amber status hero (its structure verbatim). */
@Composable
private fun StatusHero(currentTier: String?, totalSpendBDT: Double?) {
    Surface(
        color = VipAmber,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = VipOnAmber,
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        "${currentTier?.trim()?.replaceFirstChar { it.uppercase() } ?: "Standard"} Member",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = VipAmber,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                Icon(
                    Icons.Outlined.WorkspacePremium,
                    null,
                    tint = VipOnAmber,
                    modifier = Modifier.size(24.dp),
                )
            }
            Text(
                "Annual Wholesale Volume",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = VipOnAmber,
            )
            Text(
                formatBdt(totalSpendBDT ?: 0.0),
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                color = VipOnAmber,
            )
            Text(
                "Cumulative purchase turnover recorded on Zylod",
                fontSize = 11.sp,
                color = VipOnAmber.copy(alpha = 0.85f),
            )
        }
    }
}

/**
 * The web vip-membership-page's own fixed privilege rows (its UI copy
 * verbatim — these are component copy, not server data, and are labeled
 * as the platform's standing privileges).
 */
@Composable
private fun ClubPrivileges() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Your VIP Enterprise Privileges",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            PrivilegeRow(Icons.Outlined.Percent, "Factory Direct Volume Rebate", "Automatic 2% to 8% deduction on direct mill consignments.")
            PrivilegeRow(Icons.Outlined.LocalShipping, "Dedicated Fleet Dispatch", "Zero-cost return freight and priority nationwide road cargo.")
            PrivilegeRow(Icons.Outlined.Shield, "Documented Order Records", "Every order keeps its payment verification status and history on your account.")
            PrivilegeRow(Icons.Outlined.SupportAgent, "Key Account Director", "Direct WhatsApp and direct phone access to wholesale trading heads.")
        }
    }
}

@Composable
private fun PrivilegeRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, body: String) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(36.dp)
                    .background(VipAmber.copy(alpha = 0.12f), RoundedCornerShape(12.dp)),
            ) {
                Icon(icon, null, tint = VipAmberDeep, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    body,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * The REAL tier-privilege matrix from GET api/vip: one card per tier —
 * badge chip, the route's color hex on the icon, the minSpend threshold
 * via WalletFormat, and the verbatim benefit bullets. The current tier's
 * card gets the amber ring + "Your tier" chip (web parity).
 */
@Composable
private fun TierMatrix(currentTier: String?, tiers: List<VipTierDto>) {
    val token = currentTier?.trim()?.lowercase().orEmpty()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Tier Privilege Matrix",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp),
        )
        tiers.forEach { tier ->
            val isCurrent = token.isNotBlank() && tier.id?.trim()?.lowercase() == token
            val accent = tierColor(tier.color) ?: VipAmber
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        if (isCurrent) VipAmber else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                        RoundedCornerShape(24.dp),
                    ),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(40.dp)
                                .background(accent.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                        ) {
                            Icon(Icons.Outlined.WorkspacePremium, null, tint = accent, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                tier.name.orEmpty().ifBlank { "—" },
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                tier.minSpendBDT?.takeIf { it > 0.0 }
                                    ?.let { "${formatBdt(it)}+ lifetime paid spend" }
                                    ?: "No spend requirement",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(50),
                            ) {
                                Text(
                                    tier.badge.orEmpty().uppercase().ifBlank { "—" },
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                )
                            }
                            if (isCurrent) {
                                Spacer(Modifier.height(4.dp))
                                Surface(
                                    color = VipAmber.copy(alpha = 0.14f),
                                    shape = RoundedCornerShape(50),
                                ) {
                                    Text(
                                        "Your tier",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = VipAmberDeep,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    )
                                }
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        tier.benefits.forEach { benefit ->
                            Row(verticalAlignment = Alignment.Top) {
                                Icon(
                                    Icons.Outlined.CheckCircle,
                                    null,
                                    tint = VipAmberDeep,
                                    modifier = Modifier.size(14.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    benefit,
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

/** The web components' single CTA (each variant's own label verbatim). */
@Composable
private fun VipCta(label: String, onOpen: () -> Unit) {
    Button(
        onClick = onOpen,
        shape = RoundedCornerShape(18.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = VipAmber,
            contentColor = VipOnAmber,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .padding(top = 4.dp),
    ) {
        Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}
