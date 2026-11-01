package com.zylod.wholesale.ui.careers

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FlashOn
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.FlightTakeoff
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Smartphone
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material.icons.outlined.Visibility
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.MilestoneDto

/**
 * SHARED faithful career/company section screens (pageIds
 * "career-benefits", "career-culture", "career-life", "career-internships",
 * "company-values", "company-milestones" — the ui/screens delegates call
 * THIS, so each page keeps its own pageId-keyed CareerSectionViewModel).
 *
 * Data truth (chunk-misc.ts:440-452): the web maps career-internships AND
 * career-life onto the SAME career-culture-page component as career-culture,
 * and career-benefits / company-values onto pure static copy components —
 * so those five native pageIds render their component's copy VERBATIM with
 * zero wire calls (honest statics, nothing fetched, nothing invented). The
 * four culture-triple ids all show the web's "High Autonomy, High Impact"
 * intro + the four numbered pillars + "Join the Team"; benefits shows the
 * six perk cards + "Explore Open Roles"; values shows the four value cards
 * + "Back to About Us". ONLY company-milestones composes an endpoint (GET
 * api/about/milestones) — the published timeline rows with the iconType →
 * glyph map and the month/year badges, the web's verbatim empty card, and
 * the same "Back to About Zylod" footer. PUBLIC content — signed-out
 * renders exactly the same screens.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CareerSectionScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CareerSectionViewModel = viewModel(key = "native-career-section-$pageId") {
        CareerSectionViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        title,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                    )
                },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Outlined.ArrowBack,
                                "Go back",
                                tint = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            when (pageId) {
                "career-benefits" -> {
                    val benefits = listOf(
                        SectionItem(
                            "Market-Leading Compensation",
                            "Top 10th percentile benchmarked compensation in BDT with quarterly performance bonuses.",
                            Icons.Outlined.TrendingUp,
                        ),
                        SectionItem(
                            "Equity & Stock Options",
                            "Own a piece of South Asia’s fastest growing B2B marketplace with ESOP grants.",
                            Icons.Outlined.WorkspacePremium,
                        ),
                        SectionItem(
                            "Comprehensive Medical Coverage",
                            "Full hospitalization, OPD, and dental coverage for you, your spouse, and children.",
                            Icons.Outlined.Favorite,
                        ),
                        SectionItem(
                            "Equipment & Workstation Stipend",
                            "Latest Apple MacBook Pro / high-end Linux dev box + 4K dual monitor setup.",
                            Icons.Outlined.Smartphone,
                        ),
                        SectionItem(
                            "Two Festival Bonuses",
                            "Full month base salary bonuses on Eid-ul-Fitr and Eid-ul-Adha / Puja.",
                            Icons.Outlined.CardGiftcard,
                        ),
                        SectionItem(
                            "Learning & Conference Fund",
                            "Annual \$1,000 USD budget for books, online courses, and international developer conferences.",
                            Icons.AutoMirrored.Outlined.MenuBook,
                        ),
                    )
                    items(benefits, key = { "benefit-${it.title}" }) { item ->
                        IconTextCard(item)
                    }
                    item(key = "cta") {
                        PrimaryFooterButton("Explore Open Roles") { openPage("careers-page", "") }
                    }
                }
                "career-culture", "career-life", "career-internships" -> {
                    // The web maps ALL THREE ids onto career-culture-page —
                    // one composition, verbatim, exactly like the SPA.
                    item(key = "intro") {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(24.dp))
                                .padding(18.dp),
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Outlined.People,
                                    null,
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(18.dp),
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "High Autonomy, High Impact",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                            }
                            Text(
                                "We are solving hard problems at the intersection of B2B fintech, bulk freight logistics, and manufacturing digitisation in Bangladesh.",
                                fontSize = 12.sp,
                                lineHeight = 17.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    val pillars = listOf(
                        SectionItem(
                            "Extreme Ownership",
                            "No micro-management. You own projects end-to-end from technical RFC to production monitoring and metric impact.",
                        ),
                        SectionItem(
                            "Field Grounding",
                            "Every product manager and engineer visits textile mills in Gazipur and Narayanganj to understand real supplier friction.",
                        ),
                        SectionItem(
                            "Zero Ego, High Empathy",
                            "We debate ideas rigorously on facts and telemetry, not hierarchy or job titles.",
                        ),
                        SectionItem(
                            "Work-Life Balance & Flexibility",
                            "Hybrid schedule (3 days in our Banani collaborative space, 2 days remote) with flexible working hours.",
                        ),
                    )
                    itemsIndexedNumbered(pillars)
                    item(key = "cta") {
                        PrimaryFooterButton("Join the Team") { openPage("careers-page", "") }
                    }
                }
                "company-values" -> {
                    val values = listOf(
                        SectionItem(
                            "Real Verification, Always Visible",
                            "Every supplier profile on Zylod shows its real verification status, reviewed by a Zylod admin. If a profile is not verified yet, it says so — no inflated badges.",
                            Icons.Outlined.Visibility,
                        ),
                        SectionItem(
                            "Honest Numbers",
                            "Supplier, product, and order counts across this site are live database figures — including zeros while the marketplace is new. We never stage demo data or inflated stats.",
                            Icons.Outlined.VerifiedUser,
                        ),
                        SectionItem(
                            "Built for Bulk",
                            "Zylod is designed for wholesale trade — bulk quantities, negotiated quotes, and business documents — not retail impulse buys.",
                            Icons.Outlined.FlashOn,
                        ),
                        SectionItem(
                            "Win-Win Commercial Fairness",
                            "We succeed only when local manufacturers thrive and retail merchants expand their bottom-line margins.",
                            Icons.Outlined.Favorite,
                        ),
                    )
                    items(values, key = { "value-${it.title}" }) { item ->
                        IconTextCard(item)
                    }
                    item(key = "cta") {
                        PrimaryFooterButton("Back to About Us") { openPage("about-us", "") }
                    }
                }
                "company-milestones" -> {
                    when {
                        state.loading -> items(count = 3, key = { "skeleton-$it" }) {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .height(88.dp)
                                    .background(
                                        MaterialTheme.colorScheme.surfaceVariant,
                                        RoundedCornerShape(16.dp),
                                    ),
                            )
                        }
                        state.error != null -> item(key = "error") {
                            CareersErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                        }
                        state.milestones.isEmpty() -> item(key = "empty") {
                            MilestonesEmptyCard()
                        }
                        else -> items(state.milestones, key = { it.stableKey }) { milestone ->
                            MilestoneRow(milestone)
                        }
                    }
                    if (state.offlineFromCache && !state.loading && state.error == null) {
                        item(key = "offline") {
                            CareersOfflineBanner("Offline — showing the last saved milestones")
                        }
                    }
                    item(key = "cta") {
                        PrimaryFooterButton("Back to About Zylod") { openPage("about-us", "") }
                    }
                }
            }
        }
    }
}

/** One static copy row — title + verbatim description (+ optional glyph). */
private data class SectionItem(
    val title: String,
    val description: String,
    val icon: ImageVector? = null,
)

/** The benefits/values card: icon roundel (when present) + title + description. */
@Composable
private fun IconTextCard(item: SectionItem) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.Top,
            modifier = Modifier.padding(16.dp),
        ) {
            item.icon?.let { icon ->
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                            RoundedCornerShape(14.dp),
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(12.dp))
            }
            Column {
                Text(
                    item.title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    item.description,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** The culture pillars — the web's numbered 1..4 circles + copy. */
private fun androidx.compose.foundation.lazy.LazyListScope.itemsIndexedNumbered(
    pillars: List<SectionItem>,
) {
    itemsIndexed(pillars, key = { _, item -> "pillar-${item.title}" }) { index, item ->
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "${index + 1}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                    Spacer(Modifier.width(8.dp))
                    Text(
                        item.title,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    item.description,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 32.dp),
                )
            }
        }
    }
}

/** The web's verbatim milestones empty card. */
@Composable
private fun MilestonesEmptyCard() {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.05f), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.Flag,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(26.dp),
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                "No milestones published yet",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Milestones will be posted here as the platform grows — only real, verifiable ones. Zylod does not invent dates or achievements to look established.",
                fontSize = 11.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * One timeline row — the iconType glyph circle (the web's ICON_MAP with the
 * honest Star default for anything outside the admin console's eight
 * glyphs), the title + month/year badge and the verbatim description.
 */
@Composable
private fun MilestoneRow(milestone: MilestoneDto) {
    val icon = milestoneGlyph(milestone.iconType)
    Row(verticalAlignment = Alignment.Top) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .background(MaterialTheme.colorScheme.primary, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(14.dp))
        }
        Spacer(Modifier.width(12.dp))
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier.weight(1f),
        ) {
            Column(Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        milestone.title.orEmpty(),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.05f),
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            careersMonthLabel(milestone.month, milestone.year),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    milestone.description.orEmpty(),
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/**
 * The web's ICON_MAP (star/rocket/users/package/globe/award/building/
 * trending) — each glyph is an icon symbol already used elsewhere in this
 * app (repo-verified), and anything else falls back to Star exactly like
 * the web's `ICON_MAP[iconType ?? ''] ?? Star`.
 */
private fun milestoneGlyph(iconType: String?): ImageVector = when (iconType) {
    "star" -> Icons.Outlined.Star
    "rocket" -> Icons.Outlined.FlightTakeoff
    "users" -> Icons.Outlined.People
    "package" -> Icons.Outlined.Inventory
    "globe" -> Icons.Outlined.Public
    "award" -> Icons.Outlined.EmojiEvents
    "building" -> Icons.Outlined.Storefront
    "trending" -> Icons.Outlined.TrendingUp
    else -> Icons.Outlined.Star
}

/** The section footer CTA — the web's full-width teal button. */
@Composable
private fun PrimaryFooterButton(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(42.dp),
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}
