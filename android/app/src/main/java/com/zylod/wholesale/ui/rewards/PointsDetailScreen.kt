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
import androidx.compose.material.icons.outlined.Coins
import androidx.compose.material3.Button
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t282 page metadata — the "points-detail" pageId. The WEB component
 * (points-detail-page.tsx) is a STATIC rules page — "How Points Work on
 * Zylod" — with no API call anywhere in it, exactly like the finance
 * CREDIT_TIER_COPY precedent (static copy the web itself fetches nothing
 * for). Mirrored VERBATIM rather than "improved" into a fake data surface.
 */
data object PointsDetailTypedPageMeta : NativePageMeta() {
    override val pageId = "points-detail"
    override val title = "Points System Rules"
    override val category = "Rewards & Engagement"
    override val kind = NativePageKind.CONTENT
    override val endpoint: String? = null // the web page fetches NOTHING — static rules copy
    override val summary =
        "How points work on Zylod — the earning formula, the 12-month validity, and the " +
            "non-transfer rule, verbatim from the web's static rules page, with the redemption CTA."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Static rules copy mirrored from points-detail-page.tsx — the web fetches nothing for this page either.",
        "The CTA routes to the typed redeem-points screen (real balance, real redemption).",
    )
    override val related = listOf(
        NativePageLink("redeem-points", "Redeem Points"),
        NativePageLink("points-history", "Points Transaction Ledger"),
        NativePageLink("reward-points", "Reward Points"),
    )
}

/**
 * NATIVE Points System Rules (t282) — the web page's three rules sections
 * and the "Go to Points Redemption Center" CTA, verbatim.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PointsDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val warning = LocalZylodExtra.current.warning
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Points System Rules",
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
                ),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(40.dp)
                                .background(warning.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                        ) {
                            Icon(Icons.Outlined.Coins, null, tint = warning, modifier = Modifier.size(20.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                "How Points Work on Zylod",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "10 Points = ৳1.00 BDT Standard Ratio",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Column(
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        RuleBlock(
                            heading = "1. Earning Formula",
                            body = "Every confirmed B2B order earns 1 Point for every ৳100 spent. Gamified check-ins and lucky wheel spins award up to 500 bonus points.",
                        )
                        RuleBlock(
                            heading = "2. Validity & Expiry",
                            body = "Loyalty points remain valid for 12 months from the date of earning. Unused points expire on rolling annual cycles.",
                        )
                        RuleBlock(
                            heading = "3. Non-Transferable",
                            body = "Points are locked to your verified merchant account and cannot be transferred to third-party accounts.",
                        )
                    }
                    Button(
                        onClick = { openPage("redeem-points", "") },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 20.dp)
                            .height(46.dp),
                    ) {
                        Text(
                            "Go to Points Redemption Center",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RuleBlock(heading: String, body: String) {
    Column {
        Text(heading, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text(
            body,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}
