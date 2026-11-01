package com.zylod.wholesale.ui.finance

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
import androidx.compose.material.icons.outlined.Shield
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.CreditFactorDto

/**
 * SHARED typed credit-score screen (pageId credit-score — the ui/screens
 * delegate calls THIS, so the page keeps its own CreditScoreViewModel).
 *
 * Data truth: GET api/credits/score via [CreditScoreViewModel] — the score
 * dial/progress toward the server's maxScore (850), the tier title, risk
 * rating, repayment %, trade history, utilization, and the 4 factor rows
 * with color-coded impact chips (High Positive / Positive / Verified /
 * Good — exactly the wire's values). Honest loading / sign-in / error /
 * offline states — nothing fabricated.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditScoreScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CreditScoreViewModel = viewModel(key = "native-credit-score-$pageId") {
        CreditScoreViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            ScoreTopBar(onBack = onBack, onLimit = { openPage("credit-limit", "") })
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                state.needsAuth -> FinanceAuthGate(
                    title = "Sign in to view your trade credit score",
                    body = "Your credit score is computed from your real repayment and order history. Sign in to continue.",
                    onSignIn = { openPage("login", "") },
                )
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> CreditScoreContent(
                    state = state,
                    onOpenLimit = { openPage("credit-limit", "") },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScoreTopBar(onBack: (() -> Unit)?, onLimit: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                "Trade Credit Score",
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
            IconButton(onClick = onLimit) {
                Icon(Icons.Outlined.Shield, "Credit line", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
    )
}

@Composable
private fun CreditScoreContent(state: CreditScoreUiState, onOpenLimit: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            FinanceOfflineBanner("Offline — showing the last saved credit score")
        }
        when {
            state.loading -> FinanceSkeleton()
            else -> {
                state.score?.let { score ->
                    ScoreDialCard(score = score)
                    CreditMetricsCard(score = score)
                    CreditFactorsCard(factors = score.factors)
                }
                Button(
                    onClick = onOpenLimit,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                ) {
                    Icon(Icons.Outlined.Shield, null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("View Revolving Credit Line", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** The score dial: tier chip, score toward maxScore, gradient progress. */
@Composable
private fun ScoreDialCard(score: com.zylod.wholesale.data.api.CreditScoreDto) {
    val current = score.score ?: 0
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(24.dp),
            ),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            score.tier?.takeIf(String::isNotBlank)?.let { tier ->
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        tier,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                    )
                }
            }
            Text(
                "$current",
                fontSize = 44.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                "Out of ${score.maxScore} Commercial Rating Index",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            LinearProgressIndicator(
                progress = { creditScoreFraction(current, score.maxScore) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp)
                    .clip(RoundedCornerShape(50)),
            )
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Risk Rating: ",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    score.riskRating.orEmpty(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(end = 12.dp),
                )
                Text(
                    "Settlement SLA: ",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    score.repaymentTimeliness.orEmpty(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

/** Credit utilization + trade history tiles (the route's real strings). */
@Composable
private fun CreditMetricsCard(score: com.zylod.wholesale.data.api.CreditScoreDto) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        MetricTile(
            label = "Credit Utilization",
            value = score.creditUtilization.orEmpty(),
            caption = "Optimal wholesale range",
            modifier = Modifier.weight(1f),
        )
        MetricTile(
            label = "Trade History",
            value = score.tradeHistoryLength.orEmpty(),
            caption = "Verified fulfillment",
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun MetricTile(label: String, value: String, caption: String, modifier: Modifier = Modifier) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = modifier,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                value,
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                caption,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** The 4 factor rows with impact chips color-coded by the wire's token. */
@Composable
private fun CreditFactorsCard(factors: List<CreditFactorDto>) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "Credit Rating Evaluation Factors",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            factors.forEach { factor ->
                FactorRow(factor)
            }
        }
    }
}

@Composable
private fun FactorRow(factor: CreditFactorDto) {
    Row(Modifier.padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
        Icon(
            Icons.Outlined.CheckCircle,
            null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .padding(top = 1.dp)
                .size(16.dp),
        )
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    factor.name.orEmpty(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(8.dp))
                FactorImpactChip(factor.impact)
            }
            Text(
                factor.description.orEmpty(),
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

/**
 * The impact chip — the wire's EXACT tokens (Positive / High Positive /
 * Verified / Good) get their own container colors; an unknown token degrades
 * to the neutral surface instead of inventing a color semantics.
 */
@Composable
private fun FactorImpactChip(impact: String?) {
    val token = impact?.trim().orEmpty()
    val container = when (token) {
        "High Positive" -> MaterialTheme.colorScheme.primary
        "Positive" -> MaterialTheme.colorScheme.primary.copy(alpha = 0.75f)
        "Verified" -> MaterialTheme.colorScheme.tertiary
        "Good" -> MaterialTheme.colorScheme.secondary
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val content = when (token) {
        "High Positive" -> MaterialTheme.colorScheme.onPrimary
        "Positive" -> MaterialTheme.colorScheme.onPrimary
        "Verified" -> MaterialTheme.colorScheme.onTertiaryContainer
        "Good" -> MaterialTheme.colorScheme.onSecondaryContainer
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(color = container, shape = RoundedCornerShape(50)) {
        Text(
            token.ifBlank { "—" },
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            color = content,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}
