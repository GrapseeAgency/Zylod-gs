package com.zylod.wholesale.ui.suppliercore

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * t269 — SHARED static Supplier Guide screen (pageId "supplier-guide" — the
 * ui/screens delegate calls THIS). The web page
 * (src/components/pages/seller-verification-guide-page.tsx) is 100% static
 * curated content with NO network calls, so the native port is a pure
 * Composable — no ViewModel, no cache, no state machine: honest by
 * construction. Content, ported 1:1: the red/rose banner card (eyebrow +
 * "KYC & Factory Verification Standards" + the confidence line), the four
 * verification requirement cards (trade license, NID, e-TIN, bank account —
 * Bengali labels verbatim), the Review SLA card (24-48 business hours) and
 * the CTA into seller-verification. Theme colors only — the banner gradient
 * is primary-to-error (the app's red/rose accent family), never blue.
 */
@Suppress("UNUSED_PARAMETER") // pageId/query are part of the delegation contract
@Composable
fun SupplierGuideScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    SupplierCorePageScaffold(title = "Supplier Verification Guide", onBack = onBack) {
        Column(
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            GuideBanner()
            Spacer(Modifier.height(2.dp))
            RequirementCard(
                icon = Icons.Outlined.Business,
                title = "1. Trade License (\u099f\u09cd\u09b0\u09c7\u09a1 \u09b2\u09be\u0987\u09b8\u09c7\u09a8\u09cd\u09b8)",
                desc = "Valid trade license issued by City Corporation or Union Parishad for the current fiscal year.",
            )
            RequirementCard(
                icon = Icons.Outlined.VerifiedUser,
                title = "2. National ID (NID) of Proprietor",
                desc = "Clear color scan of front and back of the business owner or managing director\u2019s National Identity Card.",
            )
            RequirementCard(
                icon = Icons.Outlined.Description,
                title = "3. e-TIN Certificate (\u099f\u09bf\u09a8 \u09b8\u09be\u09b0\u09cd\u099f\u09bf\u09ab\u09bf\u0995\u09c7\u099f)",
                desc = "12-digit Tax Identification Number certificate registered in Bangladesh.",
            )
            RequirementCard(
                icon = Icons.Outlined.CreditCard,
                title = "4. Commercial Bank Account Verification",
                desc = "Bank statement or cheque leaf matching the official registered business name for automated payouts.",
            )
            SlaCard()
            Button(
                onClick = { openPage("seller-verification", "") },
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Icon(Icons.Outlined.CloudUpload, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Upload Verification Documents", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}

/**
 * The red/rose gradient banner: primary-to-error (the theme's red/rose
 * family — NO blue/indigo), white text, Award-badged eyebrow.
 */
@Composable
private fun GuideBanner() {
    val bannerBrush = guideBannerBrush()
    Surface(
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Box(
            Modifier
                .background(bannerBrush)
                .padding(20.dp),
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.EmojiEvents,
                        null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "VERIFIED SUPPLIER BADGE",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                    )
                }
                Text(
                    "KYC & Factory Verification Standards",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    "Boost customer confidence, unlock high-volume wholesale orders, and rank higher in search.",
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f),
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

/** The banner gradient built from theme slots only (red/rose family). */
@Composable
private fun guideBannerBrush(): Brush {
    // MaterialTheme.colorScheme is a @Composable getter — read it in the
    // composable scope, then key the brush cache on the resolved colors.
    val primary = MaterialTheme.colorScheme.primary
    val error = MaterialTheme.colorScheme.error
    return remember(primary, error) {
        Brush.horizontalGradient(
            listOf(primary, error),
        )
    }
}

/** One numbered verification requirement: icon chip + title + description. */
@Composable
private fun RequirementCard(icon: ImageVector, title: String, desc: String) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = SupplierCoreCardBorder(),
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

/** The Review SLA card — the 24-48 business hours commitment. */
@Composable
private fun SlaCard() {
    // The web paragraph carries **markdown** emphasis — rendered here as real
    // bold spans, never literal asterisks.
    val slaText = buildAnnotatedString {
        append("Our compliance team inspects submitted documents within ")
        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("24\u201348 business hours") }
        append(". Once approved, your storefront is automatically upgraded with the ")
        withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Verified Supplier") }
        append(" trust badge.")
    }
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = SupplierCoreCardBorder(),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.CheckCircle,
                    null,
                    tint = LocalZylodExtra.current.success,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "Review SLA & Timeline",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Text(
                slaText,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

/** The family card border — outline at the shared 0.5 alpha. */
@Composable
private fun SupplierCoreCardBorder(): BorderStroke = BorderStroke(
    1.dp,
    MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
)
