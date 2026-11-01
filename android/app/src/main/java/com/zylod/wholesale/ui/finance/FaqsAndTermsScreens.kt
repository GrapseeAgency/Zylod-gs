package com.zylod.wholesale.ui.finance

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
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material.icons.outlined.Warning
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.LegalFaqItemDto
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * The payment LEGAL surfaces (t257) — the three pageIds the brief calls the
 * static-copy screens, each mirroring its web page EXACTLY:
 *
 *  - [PaymentFaqScreen] (pageId payment-faq): GET api/legal/faq?docType=
 *    payment_terms — the web page is API-BACKED, so the native screen is
 *    too (accordion cards, the web's empty/error copy).
 *  - [PaymentTermsScreen] (pageId payment-terms): GET api/legal/payment_terms
 *    + the SAME FAQ call (the web page composes both) + the web page's own
 *    static sections (payment routes table, key rules) as verbatim copy.
 *  - [CreditTermsScreen] (pageId credit-terms): the web page IS purely
 *    static copy — the three credit tiers, hero and CTA are replicated
 *    VERBATIM as Kotlin constants (copy, not fabricated data; no endpoints
 *    exist for it on the web either).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LegalTopBar(title: String, subtitle: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Column {
                Text(
                    title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                )
                if (subtitle.isNotBlank()) {
                    Text(
                        subtitle,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
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

/* ─── Payment FAQ (pageId payment-faq) ───────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentFaqScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentFaqViewModel = viewModel(key = "native-payment-faq-$pageId") {
        PaymentFaqViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            LegalTopBar(
                title = "Payment FAQ",
                subtitle = "Bank transfers & mobile banking (bKash / Nagad)",
                onBack = onBack,
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.offlineFromCache) {
                FinanceOfflineBanner("Offline — showing the last saved FAQs")
            }
            when {
                state.loading -> FinanceSkeleton()
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                state.rows.isEmpty() -> FinanceEmptyCard(
                    icon = Icons.Outlined.ChevronRight,
                    title = "No Payment FAQs have been published yet.",
                    body = "Published questions about bank transfers and mobile banking appear here.",
                )
                else -> {
                    FaqAccordion(rows = state.rows)
                    Button(
                        onClick = { openPage("payment-terms", "") },
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                    ) {
                        Text("Back to Payment Terms", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/** The shared accordion — question rows that expand to their real answers. */
@Composable
private fun FaqAccordion(rows: List<LegalFaqItemDto>) {
    var openKey by remember { mutableStateOf<String?>(null) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column {
            rows.forEach { faq ->
                FaqRow(
                    faq = faq,
                    expanded = openKey == faq.stableKey,
                    onToggle = {
                        openKey = if (openKey == faq.stableKey) null else faq.stableKey
                    },
                )
            }
        }
    }
}

@Composable
private fun FaqRow(faq: LegalFaqItemDto, expanded: Boolean, onToggle: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                faq.questionEn.orEmpty(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.Outlined.ExpandMore,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
        if (expanded) {
            Text(
                faq.answerEn.orEmpty(),
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}

/* ─── Payment Terms (pageId payment-terms) ───────────────────────────────── */

/** One accepted-payment-method row of the web page's static table (copy). */
private data class PaymentRouteCopy(
    val name: String,
    val type: String,
    val limit: String,
    val fee: String,
)

/**
 * HONESTY NOTE (the web page's own, mirrored verbatim): only the two real
 * payment routes are listed — no invented platform fees, daily limits,
 * card rails, or SafePay escrow rows (payment-terms-page.tsx:36-42).
 */
private val PAYMENT_ROUTE_COPY = listOf(
    PaymentRouteCopy(
        "bKash",
        "Mobile Banking",
        "Send to the merchant number shown on your order",
        "Sender-side charges may apply",
    ),
    PaymentRouteCopy(
        "Nagad",
        "Mobile Banking",
        "Send to the merchant number shown on your order",
        "Sender-side charges may apply",
    ),
    PaymentRouteCopy(
        "Bank Transfer",
        "Bank",
        "Account details shown on your order",
        "Sender-side charges may apply",
    ),
)

private val KEY_PAYMENT_RULES: List<Pair<ImageVector, String>> = listOf(
    Icons.Outlined.Shield to "Orders stay UNPAID until your payment is verified by Zylod",
    Icons.Outlined.Schedule to "Suppliers fulfil verified orders — payment verification comes first",
    Icons.Outlined.Warning to "Reported problems are reviewed by the Zylod team and documented",
    Icons.Outlined.CheckCircle to "Approved refunds are returned to your original payment method",
)

/** The web page's resource links — mapped to LIVE native pageIds only. */
private val PAYMENT_RESOURCE_LINKS = listOf(
    "All Payment Methods" to "payment-methods-detail",
    "Credit & Installment Terms" to "credit-terms",
    "Payment FAQs" to "payment-faq",
    "My Payment Methods" to "payment-method",
    "Wallet Balance" to "wallet",
    "Invoice List" to "invoice-management",
)

private val legalDateParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}
private val legalDateFormat = SimpleDateFormat("d MMM yyyy", Locale.US)

private fun formatLegalUpdated(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val parsed = runCatching { legalDateParser.parse(iso) }.getOrNull() ?: return ""
    return legalDateFormat.format(parsed)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentTermsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: PaymentTermsViewModel = viewModel(key = "native-payment-terms-$pageId") {
        PaymentTermsViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.load() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            LegalTopBar(title = "Payment Terms", subtitle = "The live legal document, updated on the web", onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.offlineFromCache) {
                FinanceOfflineBanner("Offline — showing the last saved document")
            }
            // Hero (the web page's static copy, verbatim).
            TermsHero()
            // Payment Resources (the web page's link grid → live native ids).
            ResourceGrid(openPage = openPage)
            // Accepted Payment Methods — the web page's honest two-route table.
            PaymentRoutesCard()
            // Key Payment Rules — the web page's static rule list.
            KeyRulesCard()
            // Full policy — the LIVE legal document from api/legal/payment_terms.
            when {
                state.loading -> FinanceSkeleton()
                state.error != null -> {
                    val errorMessage = state.error
                    FinanceErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                else -> state.document?.let { document ->
                    FullTermsCard(
                        title = document.titleEn.orEmpty().ifBlank { "Full Payment Terms" },
                        content = document.contentEn.orEmpty(),
                        updated = formatLegalUpdated(document.updatedAt),
                    )
                }
            }
            // FAQs — the same legalFaqs rows the web page appends.
            if (state.faqs.isNotEmpty()) {
                FaqSectionCard(rows = state.faqs)
            }
            Button(
                onClick = { openPage("payment-method", "") },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
            ) {
                Icon(Icons.Outlined.CreditCard, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Manage Payment Methods", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun TermsHero() {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.CreditCard,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Flexible Wholesale Payment Options",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Text(
                "Pay via bank transfer or mobile banking (bKash/Nagad) using the details shown on your " +
                    "order. Orders stay UNPAID until Zylod verifies the payment.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                HeroStat("2", "Payment Routes")
                HeroStat("100%", "Verified")
                HeroStat("0", "Escrow Products")
            }
        }
    }
}

@Composable
private fun HeroStat(value: String, label: String) {
    Column {
        Text(
            value,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        Text(
            label,
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
        )
    }
}

@Composable
private fun ResourceGrid(openPage: (pageId: String, query: String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Payment Resources",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        PAYMENT_RESOURCE_LINKS.forEach { (label, target) ->
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { openPage(target, "") },
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                ) {
                    Text(
                        label,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        Icons.Outlined.ChevronRight,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun PaymentRoutesCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column {
            Text(
                "Accepted Payment Methods",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(16.dp),
            )
            PAYMENT_ROUTE_COPY.forEach { route ->
                Row(
                    verticalAlignment = Alignment.Top,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            route.name,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "${route.type} · ${route.limit}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.secondaryContainer,
                        shape = RoundedCornerShape(50),
                    ) {
                        Text(
                            route.fee,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun KeyRulesCard() {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Key Payment Rules",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            KEY_PAYMENT_RULES.forEach { (icon, text) ->
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        icon,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .padding(top = 1.dp)
                            .size(15.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun FullTermsCard(title: String, content: String, updated: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (updated.isNotBlank()) {
                Text(
                    "Updated $updated",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                content,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun FaqSectionCard(rows: List<LegalFaqItemDto>) {
    var openKey by remember { mutableStateOf<String?>(null) }
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column {
            Text(
                "Payment FAQs",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(16.dp),
            )
            rows.forEach { faq ->
                FaqRow(
                    faq = faq,
                    expanded = openKey == faq.stableKey,
                    onToggle = {
                        openKey = if (openKey == faq.stableKey) null else faq.stableKey
                    },
                )
            }
        }
    }
}

/* ─── Credit Terms (pageId credit-terms) — PURE STATIC COPY, verbatim ────── */

/** One credit-tier card of the web page's static copy (credit-terms-page.tsx). */
private data class CreditTierCopy(
    val tier: String,
    val eligible: String,
    val limit: String,
    val tenor: String,
    val criteria: String,
)

/**
 * The web credit-terms page's ONLY content — its own static Kotlin-side
 * array, copied verbatim (it is policy copy, not server data; the page
 * fetches nothing on the web either).
 */
private val CREDIT_TIER_COPY = listOf(
    CreditTierCopy(
        tier = "Net-15 Trade Credit",
        eligible = "Silver VIP & Above",
        limit = "Up to ৳3,00,000",
        tenor = "15 Days from Dispatch",
        criteria = "3+ successful completed orders with zero disputes",
    ),
    CreditTierCopy(
        tier = "Net-30 Enterprise Credit",
        eligible = "Gold VIP & Above",
        limit = "Up to ৳10,00,000",
        tenor = "30 Days from Dispatch",
        criteria = "Monthly GMV > ৳5,00,000 + Valid CIB credit report",
    ),
    CreditTierCopy(
        tier = "Net-60 Institutional Financing",
        eligible = "Platinum & Enterprise",
        limit = "Up to ৳50,00,000",
        tenor = "60 Days + Milestone installments",
        criteria = "Bank solvency certificate + Corporate board resolution",
    ),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreditTermsScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            LegalTopBar(
                title = "Trade Credit & Net Terms",
                subtitle = "Institutional Financing Facilities for Accredited Buyers",
                onBack = onBack,
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Hero (the web page's static copy, verbatim).
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.Schedule,
                            null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Grow Your Wholesale Inventory on Credit",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                    Text(
                        "Accredited retail shopkeepers and commercial chains can purchase factory stock " +
                            "with flexible Net-15, Net-30, and Net-60 post-paid terms.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                    )
                }
            }
            // The three credit tiers — the web page's verbatim copy.
            CREDIT_TIER_COPY.forEach { tier ->
                CreditTierCard(tier)
            }
            Button(
                onClick = { openPage("vip-membership", "") },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
            ) {
                Icon(Icons.Outlined.Storefront, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Apply via VIP Membership", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun CreditTierCard(tier: CreditTierCopy) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                RoundedCornerShape(20.dp),
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        tier.tier,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        tier.eligible,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(50),
                ) {
                    Text(
                        tier.limit,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp),
                    )
                }
            }
            Text(
                "Tenor: ${tier.tenor}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "Requirements: ${tier.criteria}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
                    .padding(10.dp),
            )
        }
    }
}
