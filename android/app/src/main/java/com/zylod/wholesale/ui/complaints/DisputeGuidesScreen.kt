package com.zylod.wholesale.ui.complaints

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.support.stringSetting

/**
 * The web dispute-resolution-guide page's red accent (its kicker, step
 * chips and evidence headers), parsed once — the t259 tint convention (the
 * screen owns colors).
 */
private val GuideRed = Color(0xFFDC2626)

/**
 * SHARED typed dispute-guide surface (pageIds dispute-guide +
 * dispute-resolution-guide + dispute-resolution + arbitration-guide — ALL
 * FOUR map onto the SAME web component, dispute-resolution-guide-page.tsx,
 * in src/lib/page-chunks/chunk-support.ts:99-113).
 *
 * COPY SCREEN — the web page composes NO dispute endpoint; it renders its
 * static guide copy (with the owner-published support.email shaping step
 * 2, read from GET api/settings/public exactly like the web's
 * usePublicSettings). The Kotlin constants below reproduce that copy
 * VERBATIM: the no-escrow banner ("How Zylod Handles Order Disputes"), the
 * four timeline steps (Inspect & Keep Evidence → Contact Zylod Support →
 * Human Review → Outcome Recorded in Writing), the two-card evidence
 * checklist (Unboxing Video / Defect Photographs) and the two CTAs (the
 * submit-ticket jump carrying the web's seller_issue category, and the
 * report-user jump). This is the web's own text, not invented copy — zero
 * fabricated data.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DisputeGuidesScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current

    // The owner-published support.email (GET api/settings/public) — the
    // web's usePublicSettings analogue. Best-effort: absent → the generic
    // wording, never an invented address.
    var supportEmail by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        try {
            val base = ServerConfig.resolve(context.applicationContext)
            val response = ApiClient.supportPublicApi(base).publicSettings()
            val email = response.body()
                ?.takeIf { response.isSuccessful && it.success }
                ?.data
                ?.settings
                ?.stringSetting("support.email")
                .orEmpty()
            supportEmail = email
        } catch (_: Exception) {
            // Generic wording stays — the web's own fallback.
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            GuideTopBar(onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Banner (the web's gradient hero, verbatim copy).
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.VerifiedUser, null, tint = GuideRed, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "ORDER DISPUTE HELP",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = GuideRed,
                        )
                    }
                    Text(
                        "How Zylod Handles Order Disputes",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Zylod has no escrow system and makes no automatic-protection guarantee. What we promise: " +
                            "every dispute is reviewed by a real person on the Zylod team, and the outcome is " +
                            "documented on your ticket.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Timeline steps (the web's four cards, verbatim titles/descs).
            GuideStep(
                time = "STEP 1: ON DELIVERY",
                title = "Inspect & Keep Evidence",
                desc = "Count all units, test product operation, and record clear unboxing video/photos. Keep your " +
                    "order number handy — you will need it for every support contact.",
            )
            GuideStep(
                time = "STEP 2: REPORT THE ISSUE",
                title = "Contact Zylod Support",
                desc = if (supportEmail.isNotBlank()) {
                    "Email $supportEmail or open a support ticket with your order number, photos, and video. Every " +
                        "report is read by the Zylod team."
                } else {
                    "Open a support ticket or reach us through the Help Center with your order number, photos, and " +
                        "video. Every report is read by the Zylod team."
                },
            )
            GuideStep(
                time = "STEP 3: TEAM REVIEW",
                title = "Human Review of Your Case",
                desc = "A Zylod team member reviews your evidence against the product listing and follows up with " +
                    "you and the supplier. There are no automated decisions.",
            )
            GuideStep(
                time = "STEP 4: DOCUMENTED OUTCOME",
                title = "Outcome Recorded in Writing",
                desc = "The decision is documented on your ticket. Where a refund is approved, it is returned to " +
                    "your original payment method — timing depends on your bank or mobile-money provider.",
            )

            // Evidence checklist (the web's two cards, verbatim).
            Surface(
                color = MaterialTheme.colorScheme.surfaceContainer,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f),
                        RoundedCornerShape(24.dp),
                    ),
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Evidence That Helps Your Case",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    EvidenceCard(
                        title = "Unboxing Video",
                        body = "Continuous video showing sealed shipping label and opening parcel.",
                    )
                    EvidenceCard(
                        title = "Defect Photographs",
                        body = "Close-ups of broken parts, missing units, or incorrect color/specs.",
                    )
                }
            }

            // CTAs (the web's two buttons — the ticket jump carries the
            // web's seller_issue category).
            Button(
                onClick = { openPage("submit-ticket", "category=seller_issue") },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = GuideRed,
                    contentColor = Color.White,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp),
            ) {
                Text("Open a Support Ticket", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            OutlinedButton(
                onClick = { openPage("report-user", "") },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = GuideRed,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(46.dp),
            ) {
                Text("Report Seller Misconduct →", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GuideTopBar(onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                "Dispute & Arbitration Guide",
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
private fun GuideStep(time: String, title: String, desc: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Surface(
                color = GuideRed.copy(alpha = 0.08f),
                shape = RoundedCornerShape(14.dp),
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(10.dp),
                ) {
                    Icon(Icons.Outlined.Schedule, null, tint = GuideRed, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Surface(color = GuideRed.copy(alpha = 0.08f), shape = RoundedCornerShape(6.dp)) {
                    Text(
                        time,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = GuideRed,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                Text(
                    title,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(top = 4.dp),
                )
                Text(
                    desc,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun EvidenceCard(title: String, body: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.CheckCircle, null, tint = GuideRed, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    title,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            Text(
                body,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 3.dp),
            )
        }
    }
}
