package com.zylod.wholesale.ui.welcome

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zylod.wholesale.ui.components.ZylodEntrance

// Faithful port of src/components/pages/welcome-page.tsx (mobile layout) —
// Phase 1 welcome gate (spec §3.1). Slide copy is verbatim from SLIDES[].
private data class WelcomeSlide(val title: String, val description: String, val icon: ImageVector)

private val SLIDES = listOf(
    WelcomeSlide(
        "Source Global",
        "Access millions of high-quality products from certified manufacturers worldwide with zero friction.",
        Icons.Outlined.LocalShipping,
    ),
    WelcomeSlide(
        "Trade Securely",
        "Every transaction is protected with escrow payments, verified suppliers, and end-to-end encryption.",
        Icons.Outlined.Shield,
    ),
    WelcomeSlide(
        "Scale Faster",
        "From bulk orders to custom manufacturing, streamline your wholesale operations on one platform.",
        Icons.Outlined.TrendingUp,
    ),
)

private const val ONBOARDING_PREFS = "zylod_onboarding"
private const val ONBOARDING_KEY = "zylod-onboarding-seen"

fun isOnboardingSeen(context: android.content.Context): Boolean =
    context.getSharedPreferences(ONBOARDING_PREFS, android.content.Context.MODE_PRIVATE)
        .getBoolean(ONBOARDING_KEY, false)

fun markOnboardingSeen(context: android.content.Context) {
    context.getSharedPreferences(ONBOARDING_PREFS, android.content.Context.MODE_PRIVATE)
        .edit().putBoolean(ONBOARDING_KEY, true).apply()
}

@Composable
fun WelcomeScreen(
    onCreateBuyerAccount: () -> Unit,
    onSignIn: () -> Unit,
    onContinueAsGuest: () -> Unit,
) {
    val context = LocalContext.current
    var slide by remember { mutableIntStateOf(0) }
    val isLast = slide == SLIDES.lastIndex

    // CTA callbacks always mark onboarding seen first (web markSeen, L254-256).
    fun complete(action: () -> Unit) {
        markOnboardingSeen(context)
        action()
    }

    ZylodEntrance(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(48.dp))
            // Brand header (web: text-2xl font-bold text-[#C8102E])
            Text(
                "Zylod",
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.weight(1f))

            // Illustration circle
            Surface(
                shape = CircleShape,
                color = Color.Transparent,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)),
                modifier = Modifier.size(260.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(230.dp)
                            .background(
                                Brush.linearGradient(
                                    listOf(
                                        MaterialTheme.colorScheme.primaryContainer,
                                        MaterialTheme.colorScheme.background,
                                    )
                                ),
                                CircleShape,
                            ),
                    ) {
                        Icon(
                            SLIDES[slide].icon,
                            contentDescription = SLIDES[slide].title,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(96.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(32.dp))
            // Slide copy (keyed re-animation per slide — web SlideContent)
            LaunchedEffect(slide) { /* re-entrance per slide via ZylodEntrance below */ }
            ZylodEntrance(Modifier.fillMaxWidth()) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        SLIDES[slide].title,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onBackground,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        SLIDES[slide].description,
                        fontSize = 15.sp,
                        lineHeight = 22.sp,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                }
            }

            Spacer(Modifier.height(28.dp))
            // Pagination dots (active dot widens — web PaginationDots)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SLIDES.indices.forEach { i ->
                    Box(
                        Modifier
                            .width(if (i == slide) 26.dp else 8.dp)
                            .height(8.dp)
                            .background(
                                if (i == slide) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                                RoundedCornerShape(50),
                            ),
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            // Primary action: Next → … → Get Started (web handleNext)
            Button(
                onClick = {
                    if (isLast) complete(onContinueAsGuest) else slide++
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
            ) {
                Text(
                    if (isLast) "Get Started" else "Next",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(Modifier.height(12.dp))

            // Phase 1 CTA pair (brief §D.11) — account creation shortcuts.
            if (isLast) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = { complete(onCreateBuyerAccount) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                    ) {
                        Text("Create buyer account", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    }
                    Button(
                        onClick = { complete(onSignIn) },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.primary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                    ) {
                        Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                Spacer(Modifier.height(8.dp))
            }

            TextButton(onClick = { complete(onContinueAsGuest) }) {
                Text(
                    if (isLast) "Continue as guest" else "Skip",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(28.dp))
        }
    }
}

