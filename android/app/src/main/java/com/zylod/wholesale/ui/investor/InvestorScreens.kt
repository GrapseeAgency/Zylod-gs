package com.zylod.wholesale.ui.investor

import android.content.Intent
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.InvestorDocDto
import com.zylod.wholesale.ui.careers.careersDateString
import com.zylod.wholesale.ui.careers.investorBadgeLabel

/**
 * SHARED typed investor surfaces (pageIds "investor-relations",
 * "investor-presentation" AND "investor-contact" — the ui/screens delegates
 * call THESE, so each page keeps its own pageId-keyed ViewModel).
 *
 * Data truth: investor-relations-page.tsx / investor-presentation-page.tsx
 * / investor-contact-page.tsx ported. The portal (GET api/investor, PUBLIC)
 * renders the emerald hero — INCLUDING the web's hardcoded "Nothing
 * Published Yet" headline (that string is unconditional in the SPA source;
 * the live document count still renders in the stats row and the list, so
 * the copy is mirrored verbatim rather than "improved") — the Investor
 * Resources quick-nav grid (all six targets are registered native pageIds),
 * and the doc cards: the uppercase docType·fiscalYear badge, title, summary,
 * the "Published MMM yyyy" footer and the download affordance — an
 * ACTION_VIEW on the row's REAL fileUrl (http/https only, the web's
 * <a href={doc.fileUrl} download>). investor-presentation composes the same
 * route with docType=investor_presentation and the web's "Deck · YYYY"
 * amber cards. investor-contact is the IR inquiry POST (the route's
 * validation + verbatim strings mirrored; see InvestorContactViewModel).
 * PUBLIC content — signed-out renders exactly the same screens.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvestorRelationsScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InvestorViewModel = viewModel(key = "native-investor-$pageId") {
        InvestorViewModel(context.applicationContext, pageId)
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
                actions = {
                    // The web top bar's "IR Contact" button.
                    TextButton(onClick = { openPage("investor-contact", "") }) {
                        Icon(
                            Icons.Outlined.Mail,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "IR Contact",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
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
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // Hero (the web's emerald gradient card, verbatim copy).
            item(key = "hero") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                            RoundedCornerShape(24.dp),
                        )
                        .padding(20.dp),
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Text(
                            "Investor Relations",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    Text(
                        "Nothing Published Yet",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Investor relations materials — audited financials, filings, funding information — have not been released. They will appear on this page as they are published." +
                            if (state.supportEmail.isNotBlank()) {
                                " In the meantime, contact ${state.supportEmail}."
                            } else {
                                " In the meantime, reach us through the Help Center."
                            },
                        fontSize = 12.sp,
                        lineHeight = 17.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                    ) {
                        HeroStat("${state.documents.size}", "Documents Published", MaterialTheme.colorScheme.primary)
                        HeroStat("None", "Funding Rounds Announced", MaterialTheme.colorScheme.primary)
                        HeroStat("None", "Audited Financials Released", com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning)
                    }
                }
            }

            // Investor Resources quick-nav (all six are registered native pageIds).
            item(key = "quick-nav") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(24.dp))
                        .padding(14.dp),
                ) {
                    Text(
                        "Investor Resources",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    val links = listOf(
                        "Annual Reports" to "annual-report",
                        "Financial Filings" to "financial-filings",
                        "Investor Presentations" to "investor-presentation",
                        "Corporate Governance" to "company-values",
                        "Leadership Team" to "leadership-team",
                        "IR Contact Desk" to "investor-contact",
                    )
                    for (chunk in links.chunked(2)) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            for (link in chunk) {
                                InvestorQuickNavLink(
                                    label = link.first,
                                    modifier = Modifier.weight(1f),
                                ) { openPage(link.second, "") }
                            }
                        }
                    }
                }
            }

            item(key = "section-header") {
                Text(
                    "Recent Publications & Filings",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            if (state.offlineFromCache && !state.loading && state.error == null) {
                item(key = "offline") {
                    InvestorOfflineBanner("Offline — showing the last saved investor documents")
                }
            }

            when {
                state.loading -> items(count = 3, key = { "skeleton-$it" }) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(96.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                state.error != null -> item(key = "error") {
                    InvestorErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                }
                state.documents.isEmpty() -> item(key = "empty") {
                    InvestorEmptyCard(supportEmail = state.supportEmail)
                }
                else -> items(state.documents, key = { it.stableKey }) { doc ->
                    InvestorDocCard(doc = doc, badgeTint = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

/**
 * SHARED typed investor-presentation screen (pageId "investor-presentation"
 * — the web's investor-presentation-page: GET api/investor with
 * docType=investor_presentation, the "Deck · YYYY" amber cards, the
 * "Back to Investor Portal" footer). Honest empty: the web renders an
 * empty grid — the native card says exactly what is (not) published.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvestorPresentationScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InvestorViewModel = viewModel(key = "native-investor-$pageId") {
        InvestorViewModel(context.applicationContext, pageId)
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
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (state.offlineFromCache && !state.loading && state.error == null) {
                item(key = "offline") {
                    InvestorOfflineBanner("Offline — showing the last saved investor presentations")
                }
            }

            when {
                state.loading -> items(count = 2, key = { "skeleton-$it" }) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(96.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                    )
                }
                state.error != null -> item(key = "error") {
                    InvestorErrorCard(message = state.error.orEmpty(), onRetry = vm::retry)
                }
                state.documents.isEmpty() -> item(key = "empty") {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(20.dp)) {
                            Text(
                                "No investor presentations published yet",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Strategy decks appear here the moment the investor relations team publishes them.",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                else -> items(state.documents, key = { it.stableKey }) { doc ->
                    PresentationDocCard(doc = doc)
                }
            }

            item(key = "cta") {
                Button(
                    onClick = { openPage("investor-relations", "") },
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(42.dp),
                ) {
                    Text("Back to Investor Portal", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/**
 * SHARED typed investor-contact screen (pageId "investor-contact" — the
 * web's investor-contact-page form: the "Institutional Representative"
 * card, the six-value Nature of Inquiry select, the message textarea and
 * the Submit Investor Inquiry button; success swaps the form for the
 * "Inquiry Received" card exactly like the web's submitted branch).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvestorContactScreen(
    pageId: String,
    title: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: InvestorContactViewModel = viewModel(key = "native-investor-contact-$pageId") {
        InvestorContactViewModel(context.applicationContext, pageId)
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (state.successRef != null || state.successMessage != null) {
                // The web's submitted branch — verbatim copy + the REAL ref.
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
                        Icon(
                            Icons.Outlined.CheckCircle,
                            null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(48.dp),
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Inquiry Received",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Your inquiry reference is ${state.successRef.orEmpty()}. It has been saved to our inbox for review — we reply by email when action is needed." +
                                if (state.supportEmail.isNotBlank()) {
                                    " For anything urgent, email ${state.supportEmail}."
                                } else {
                                    " For anything urgent, reach us through the Help Center."
                                },
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = { openPage("investor-relations", "") },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        ) {
                            Text("Back to Investor Portal", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(18.dp),
                    ) {
                        Text(
                            "Institutional Representative",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        OutlinedTextField(
                            value = state.name,
                            onValueChange = vm::setName,
                            label = { Text("Full Name *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            placeholder = { Text("Your full name", fontSize = 12.sp) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = state.email,
                            onValueChange = vm::setEmail,
                            label = { Text("Corporate Email *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            placeholder = { Text("name@yourfund.com", fontSize = 12.sp) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = state.company,
                            onValueChange = vm::setCompany,
                            label = { Text("Fund / Organization Name", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            placeholder = { Text("Your fund or organization", fontSize = 12.sp) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        // The web <select> — the six REAL inquiry types, verbatim labels.
                        InquiryTypeDropdown(selected = state.inquiryType, onSelected = vm::setInquiryType)
                        OutlinedTextField(
                            value = state.message,
                            onValueChange = vm::setMessage,
                            label = { Text("Message / Inquiry *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                            placeholder = {
                                Text("Please specify your request or scheduled meeting requirements...", fontSize = 12.sp)
                            },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                        )

                        state.error?.let { message ->
                            Text(
                                message,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }

                        Button(
                            onClick = vm::submit,
                            enabled = !state.submitting,
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary,
                                contentColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                        ) {
                            Text(
                                if (state.submitting) "Sending Inquiry..." else "Submit Investor Inquiry",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
    }
}

/* ─── shared small composables (investor-scoped, one definition) ─────────── */

/** The web's verbatim investor-relations empty card. */
@Composable
private fun InvestorEmptyCard(supportEmail: String) {
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
            Text(
                "No investor documents published yet",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "Investor relations materials are not published yet. Nothing is listed here because nothing has been released — reports and filings will appear on this page as they are published." +
                    if (supportEmail.isNotBlank()) {
                        " Contact $supportEmail with any inquiry."
                    } else {
                        " Reach us through the Help Center with any inquiry."
                    },
                fontSize = 11.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** One investor-relations doc card — badge, title, download, summary, footer. */
@Composable
private fun InvestorDocCard(doc: InvestorDocDto, badgeTint: androidx.compose.ui.graphics.Color) {
    val context = LocalContext.current
    val fileUrl = doc.fileUrl?.takeIf { url ->
        url.startsWith("http://") || url.startsWith("https://")
    }
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Surface(
                        color = badgeTint.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            investorBadgeLabel(doc).uppercase(),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = badgeTint,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        doc.title.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (fileUrl != null) {
                    // The web's <a href={doc.fileUrl} download> — ACTION_VIEW
                    // on the REAL fileUrl only (the PressScreen convention).
                    IconButton(onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(fileUrl)))
                        }
                    }) {
                        Icon(
                            Icons.Outlined.Download,
                            "Download ${doc.title.orEmpty()}",
                            tint = badgeTint,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
            doc.summary?.takeIf(String::isNotBlank)?.let { summary ->
                Spacer(Modifier.height(4.dp))
                Text(
                    summary,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    Icons.Outlined.CalendarMonth,
                    null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "Published ${careersDateString(doc.publishedAt, "MMM yyyy")}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "PDF Download",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = badgeTint,
                )
            }
        }
    }
}

/** One investor-presentation card — the web's amber "Deck · YYYY" variant. */
@Composable
private fun PresentationDocCard(doc: InvestorDocDto) {
    val context = LocalContext.current
    val warning = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning
    val fileUrl = doc.fileUrl?.takeIf { url ->
        url.startsWith("http://") || url.startsWith("https://")
    }
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Surface(
                        color = warning.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            // The web's exact `Deck · {fiscalYear || '2026'}`.
                            "Deck · ${doc.fiscalYear?.takeIf(String::isNotBlank) ?: "2026"}",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = warning,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        doc.title.orEmpty(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (fileUrl != null) {
                    IconButton(onClick = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(fileUrl)))
                        }
                    }) {
                        Icon(
                            Icons.Outlined.Download,
                            "Download ${doc.title.orEmpty()}",
                            tint = warning,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
            doc.summary?.takeIf(String::isNotBlank)?.let { summary ->
                Spacer(Modifier.height(4.dp))
                Text(
                    summary,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Investor Relations Team",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "Presentation Deck",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = warning,
                )
            }
        }
    }
}

/** One hero stat — the value + the tiny label under it. */
@Composable
private fun HeroStat(value: String, label: String, tint: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, fontSize = 16.sp, fontWeight = FontWeight.Black, color = tint)
        Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** One quick-nav pill (label + chevron) — the web's grid button. */
@Composable
private fun InvestorQuickNavLink(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
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

/** The web's Nature of Inquiry <select> — the six REAL values, verbatim labels. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InquiryTypeDropdown(selected: String, onSelected: (String) -> Unit) {
    val expanded = remember { mutableStateOf(false) }
    val options = listOf(
        "general" to "General Investor Information",
        "annual_report" to "Audited Financial Queries",
        "financial_data" to "Unit Economics & GMV Telemetry",
        "media_request" to "Financial Media Request",
        "analyst_coverage" to "Equity Research & Coverage",
        "esg" to "ESG & Sustainability Inquiries",
    )
    ExposedDropdownMenuBox(expanded = expanded.value, onExpandedChange = { expanded.value = it }) {
        OutlinedTextField(
            value = options.firstOrNull { it.first == selected }?.second.orEmpty(),
            onValueChange = {},
            readOnly = true,
            label = { Text("Nature of Inquiry *", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
            shape = RoundedCornerShape(12.dp),
            trailingIcon = {
                Icon(Icons.Outlined.ExpandMore, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
        )
        ExposedDropdownMenu(
            expanded = expanded.value,
            onDismissRequest = { expanded.value = false },
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option.second, fontSize = 12.sp) },
                    onClick = {
                        onSelected(option.first)
                        expanded.value = false
                    },
                )
            }
        }
    }
}

/** Error card with Retry — the t255 SupportErrorCard idiom, investor-scoped. */
@Composable
private fun InvestorErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    null,
                    tint = error,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = error,
                )
            }
            Button(
                onClick = onRetry,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .fillMaxWidth()
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Amber banner over a cached snapshot (SupportOfflineBanner's twin). */
@Composable
private fun InvestorOfflineBanner(text: String) {
    val warning = com.zylod.wholesale.ui.theme.LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                Icons.Outlined.CloudOff,
                null,
                tint = warning,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
