package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * t269 — SHARED static Supplier Agreement screen (pageId
 * "supplier-agreement" — the ui/screens delegate calls THIS). The web page
 * (src/components/pages/community-guidelines-page.tsx) is 100% static
 * curated content with NO network calls, so the native port is a pure
 * Composable — no ViewModel, no cache, no state machine: honest by
 * construction. Content, ported 1:1: the intro card (eyebrow + "Rules for
 * Fair, Safe, and Professional B2B Trade" + the Digital Commerce Guidelines
 * paragraph with the Bengali text verbatim), the five B2B conduct cards,
 * the Prohibited Products link row (into prohibited-items) and the DNCRP
 * enforcement footnote. Theme colors only — red/rose accent family.
 */
@Suppress("UNUSED_PARAMETER") // pageId/query are part of the delegation contract
@Composable
fun SupplierAgreementScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SupplierCorePageScaffold(title = "Community Guidelines", onBack = onBack) {
        Column(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            AgreementIntroCard()
            GuidelineCard(
                icon = Icons.Outlined.CheckCircle,
                title = "1. Transparent Wholesale Listings",
                desc = "All products must accurately reflect actual factory specifications, unit dimensions, materials, and available warehouse inventory. False claims on certifications (ISO, CE) are strictly penalized.",
            )
            GuidelineCard(
                icon = Icons.Outlined.Block,
                title = "2. Zero Off-Platform Transactions",
                desc = "Asking buyers for direct bKash transfers, personal bank deposits, or cash handovers outside Zylod checkout is grounds for permanent supplier suspension and legal blacklisting.",
            )
            GuidelineCard(
                icon = Icons.Outlined.Gavel,
                title = "3. Respectful B2B Communication",
                desc = "All negotiation, customer queries, and dispute arbitration conversations must remain professional. Threatening, abusive, or coercive language leads to instant account deactivation.",
            )
            GuidelineCard(
                icon = Icons.Outlined.VerifiedUser,
                title = "4. Genuine Reviews & Rating Integrity",
                desc = "Review manipulation, paid ratings, or retaliatory negative feedback is prohibited. All reviews must represent genuine completed wholesale order experiences.",
            )
            GuidelineCard(
                icon = Icons.AutoMirrored.Outlined.MenuBook,
                title = "5. Fast Dispatch & Courier SLA",
                desc = "Suppliers must confirm and dispatch orders within the agreed lead time (standard: 48 hours for ready stock). Unreasonable order cancellations harm seller ranking score.",
            )
            ProhibitedLinkRow(onOpen = { openPage("prohibited-items", "") })
            EnforcementFootnote()
            Spacer(Modifier.height(8.dp))
        }
    }
}

/** The intro card: code-of-conduct eyebrow, title, commitment paragraph. */
@Composable
private fun AgreementIntroCard() {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = AgreementCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Description,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(14.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "BANGLADESH WHOLESALE CODE OF CONDUCT",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                "Rules for Fair, Safe, and Professional B2B Trade",
                fontSize = 15.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "Zylod is committed to fostering trust among manufacturers, wholesale distributors, and retail business owners across Bangladesh. By using our platform, all members agree to uphold these standards in accordance with the Digital Commerce Guidelines (\u09a1\u09bf\u099c\u09bf\u099f\u09be\u09b2 \u0995\u09ae\u09be\u09b0\u09cd\u09b8 \u09aa\u09b0\u09bf\u099a\u09be\u09b2\u09a8\u09be \u09a8\u09bf\u09b0\u09cd\u09a6\u09c7\u09b6\u09bf\u0995\u09be).",
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

/** One numbered conduct guideline: icon chip + title + description. */
@Composable
private fun GuidelineCard(icon: ImageVector, title: String, desc: String) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = AgreementCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(14.dp)) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(36.dp)
                    .background(
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                        RoundedCornerShape(12.dp),
                    ),
            ) {
                Icon(
                    icon,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    desc,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/**
 * The Prohibited Products link row — the web's red-tinted gradient card,
 * rendered as the theme's primary-tinted surface; opens prohibited-items.
 */
@Composable
private fun ProhibitedLinkRow(onOpen: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.06f),
        border = AgreementCardBorder(),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(14.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(40.dp)
                    .background(
                        MaterialTheme.colorScheme.primary,
                        RoundedCornerShape(14.dp),
                    ),
            ) {
                Icon(
                    Icons.Outlined.ErrorOutline,
                    null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Prohibited Products & Restricted Goods",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Review the complete list of items banned by Bangladesh law.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Icon(
                Icons.Outlined.ChevronRight,
                null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

/** The family card border — outline at the shared 0.5 alpha. */
@Composable
private fun AgreementCardBorder(): BorderStroke = BorderStroke(
    1.dp,
    MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
)

/**
 * The DNCRP enforcement footnote — the quiet full-width closing card.
 */
@Composable
private fun EnforcementFootnote() {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            "Violations of these guidelines may result in listing removal, supplier badge revocation, and referral to the Ministry of Commerce & Directorate of National Consumer Rights Protection (DNCRP).",
            fontSize = 11.sp,
            lineHeight = 16.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(14.dp),
        )
    }
}
