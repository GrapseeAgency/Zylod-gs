package com.zylod.wholesale.ui.rewards

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.NavigateNext
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.TrendingDown
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Button
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.PointsLedgerRowDto
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t282 page metadata — the "points-history" pageId (the loyalty LEDGER).
 * t281 forwarded it to the WebView with "typed ui/rewards port noted for
 * later"; this typed screen is that port: GET api/rewards/history with the
 * web's three filter tabs and the sign-in gate.
 */
data object PointsHistoryTypedPageMeta : NativePageMeta() {
    override val pageId = "points-history"
    override val title = "Points Transaction Ledger"
    override val category = "Rewards & Engagement"
    override val kind = NativePageKind.CONTENT
    override val endpoint = "api/rewards/history?limit=20" // authenticated, page-paginated
    override val summary =
        "Your real points ledger from GET api/rewards/history — every earn and redemption " +
            "with the web's All / Earned / Redemptions filter tabs."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Requires sign-in — guests get the gate, never a fabricated 'No point transactions found' page (the web's own honesty fix).",
        "Redemption rows carry NEGATIVE points — the sign is the ledger's own, rendered verbatim.",
        "Offline, the last saved page renders from the device cache.",
    )
    override val related = listOf(
        NativePageLink("redeem-points", "Redeem Points"),
        NativePageLink("reward-points", "Reward Points"),
        NativePageLink("buyer-rewards", "Buyer Rewards"),
    )
}

private val FILTER_TABS = listOf(
    "" to "All Transactions",
    "earn" to "Points Earned",
    "redeem" to "Redemptions",
)

/**
 * NATIVE Points History (t282) — the real ledger with the web's filter
 * tabs, green/amber earn/redeem split, page-paginated Load More.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PointsHistoryScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val vm: PointsHistoryViewModel = viewModel { PointsHistoryViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Points Transaction Ledger",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
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
                    // The web header's Redeem shortcut.
                    TextButton(onClick = { openPage("redeem-points", "") }) {
                        Text(
                            "Redeem",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.loading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            } else if (state.needsAuth) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    NeedsAuthState(openPage = openPage)
                }
            } else if (state.error != null) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    ErrorState(onRetry = vm::refresh)
                }
            } else {
                FilterTabs(state.activeType, vm::setType)
                LedgerList(state = state, onLoadMore = vm::loadMore)
            }
        }
    }
}

@Composable
private fun FilterTabs(active: String, onSelect: (String) -> Unit) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(FILTER_TABS.size) { index ->
            val (key, label) = FILTER_TABS[index]
            val selected = active == key
            Surface(
                shape = RoundedCornerShape(50),
                color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier
                    .clickable { onSelect(key) },
            ) {
                Text(
                    label,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun LedgerList(state: PointsHistoryUiState, onLoadMore: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        if (state.rows.isEmpty()) {
            item(key = "empty", contentType = "empty") {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                ) {
                    Text(
                        "No point transactions found",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Earn points by making purchases or completing daily activities.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        } else {
            state.rows.forEach { row ->
                item(key = "ph-${row.stableKey}", contentType = "points-row") { LedgerRow(row) }
            }
            if (state.page < state.totalPages) {
                item(key = "load-more", contentType = "load-more") {
                    Box(Modifier.fillMaxWidth().padding(top = 4.dp), contentAlignment = Alignment.Center) {
                        if (state.loadingMore) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            TextButton(onClick = onLoadMore) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("Load more", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                    Icon(Icons.AutoMirrored.Outlined.NavigateNext, null, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

@Composable
private fun LedgerRow(row: PointsLedgerRowDto) {
    val success = LocalZylodExtra.current.success
    val warning = LocalZylodExtra.current.warning
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        (if (row.isEarn) success else warning).copy(alpha = 0.12f),
                        RoundedCornerShape(12.dp),
                    ),
            ) {
                Icon(
                    if (row.isEarn) Icons.Outlined.TrendingUp else Icons.Outlined.TrendingDown,
                    null,
                    tint = if (row.isEarn) success else warning,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    row.description?.takeIf(String::isNotBlank)
                        ?: if (row.isEarn) "Points Earned" else "Points Redeemed",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    row.createdAt?.let { formatLedgerDate(it) } ?: "",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                if (row.isEarn) "+${row.points} Pts" else "${row.points} Pts",
                fontSize = 13.sp,
                fontWeight = FontWeight.Black,
                color = if (row.isEarn) success else warning,
            )
        }
    }
}

/** The web's en-GB ledger timestamp shape: "12 Nov 2026, 14:05". */
internal fun formatLedgerDate(iso: String): String = runCatching {
    val instant = java.time.Instant.parse(iso)
    val formatter = java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm")
        .withZone(java.time.ZoneOffset.UTC)
    formatter.format(instant)
}.getOrDefault("")

@Composable
private fun NeedsAuthState(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Text(
            "Sign in to view your points ledger",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Text(
            "Every point you earn and redeem is recorded on your account. Sign in to see your real transaction history.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved ledger page",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun ErrorState(onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Text(
            "Could not load your points history",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Try Again", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}
