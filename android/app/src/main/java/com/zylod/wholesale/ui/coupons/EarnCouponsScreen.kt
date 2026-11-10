package com.zylod.wholesale.ui.coupons

import android.graphics.Color as AndroidColor
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CardGiftcard
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.BorderStroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * Native Earn Coupons screen — the Task 111 reward-tasks rail, wire-exact
 * with the web's earn-coupons page (src/components/pages/earn-coupons-page.tsx):
 *
 *  - the SAME GET api/coupons/earn window (active tasks; signed-in rows
 *    carry the server's claimed flag + REAL proof progress),
 *  - the SAME three button states (Claimed / Claim reward / "n of m done"),
 *  - the SAME honesty contract: the server's own 403 shortfall and 409
 *    already-claimed wording surface verbatim in the inline banner — no
 *    blind Claim button, no invented success,
 *  - a soft sign-in CTA for guests (the web page's AccountGate), the
 *    offline saved-tasks banner, and the honest first-launch error state —
 *    never a white screen.
 *
 * Visual language = My Coupons (Scaffold + TopAppBar, 16dp surfaces on
 * surfaceContainer with the 0.5-alpha outline border, M3 progress track,
 * brand-red primary actions). M3 rule: the ONE page-level loading
 * animation is the center spinner — no shimmer, no custom loaders.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EarnCouponsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: EarnCouponsViewModel = viewModel { EarnCouponsViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Wallet/Orders/Coupons: re-pull on EVERY entry —
    // progress moved elsewhere in the app (an order placed, a review
    // written) shows up the moment the user lands back here.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Earn Coupons",
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
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                // THE one page-level loading animation (M3 rule).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Signed out: rewards are per-buyer money promises — a soft
                // sign-in CTA, never a hard redirect (CouponsAuthRequired
                // precedent; the web page's AccountGate).
                state.needsAuth -> EarnAuthRequired(onSignIn = { openPage("login", "") })
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> EarnOfflineEmpty(message = state.error!!, onRetry = vm::retry)
                else -> EarnContent(state = state, onClaim = vm::claim)
            }
        }
    }
}

@Composable
private fun EarnContent(state: EarnUiState, onClaim: (EarnTask) -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { EarnOfflineBanner() }
        }
        state.notice?.let { notice ->
            item(key = "notice", contentType = "banner") { EarnNoticeBanner(notice) }
        }
        item(key = "intro", contentType = "meta") {
            Text(
                "Complete real actions on Zylod — the server checks each task against your account before a voucher exists.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        items(items = state.tasks, key = { it.stableKey }, contentType = { "task" }) { task ->
            EarnTaskCard(
                task = task,
                claimingThis = state.claimingKey == task.stableKey,
                anyClaimInFlight = state.claimingKey != null,
                onClaim = onClaim,
            )
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * One reward-task card — icon per task type (the web page's TASK_ICONS
 * mapping), the task's own iconColor as the tint when the server ships one,
 * the reward line, the M3 progress track (count/required) and the honest
 * claim button.
 */
@Composable
private fun EarnTaskCard(
    task: EarnTask,
    claimingThis: Boolean,
    anyClaimInFlight: Boolean,
    onClaim: (EarnTask) -> Unit,
) {
    val icon = remember(task.type) { iconForType(task.type) }
    val tint = remember(task.iconColor) { parseTaskColor(task.iconColor) }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(38.dp)
                        .background(tint.copy(alpha = 0.1f), CircleShape),
                ) {
                    Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        task.title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (task.description.isNotBlank()) {
                        Text(
                            task.description,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 10.dp),
            ) {
                Text(
                    task.rewardLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "৳${formatRewardBdt(task.rewardBDT)} voucher",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!task.claimed) {
                LinearProgressIndicator(
                    progress = { task.progressFraction() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .height(6.dp),
                    color = tint,
                    trackColor = tint.copy(alpha = 0.15f),
                )
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 8.dp),
            ) {
                EarnClaimButton(
                    task = task,
                    claimingThis = claimingThis,
                    anyClaimInFlight = anyClaimInFlight,
                    onClaim = onClaim,
                )
                Spacer(Modifier.weight(1f))
                if (!task.claimed && !task.progressMet) {
                    Text(
                        "Target ${task.progressRequired.coerceAtLeast(1)}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun EarnClaimButton(
    task: EarnTask,
    claimingThis: Boolean,
    anyClaimInFlight: Boolean,
    onClaim: (EarnTask) -> Unit,
) {
    when {
        task.claimed -> Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.CheckCircle,
                null,
                tint = LocalZylodExtra.current.success,
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                "Claimed — in your vault",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        task.progressMet -> Button(
            onClick = { onClaim(task) },
            enabled = !anyClaimInFlight,
            shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
            modifier = Modifier.height(34.dp),
        ) {
            if (claimingThis) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
                Spacer(Modifier.width(6.dp))
                Text("Claiming", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            } else {
                Text("Claim reward", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        // The honest pre-target state: the web page keeps the button visible
        // but the claim would be refused with the shortfall — the native
        // surface shows the live count/required instead (no fake tap).
        else -> Text(
            task.actionLabel,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun EarnNoticeBanner(notice: EarnUiState.Notice) {
    val color = if (notice.isError) {
        MaterialTheme.colorScheme.error
    } else {
        LocalZylodExtra.current.success
    }
    Surface(
        color = color.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(
                if (notice.isError) Icons.Outlined.ErrorOutline else Icons.Outlined.CheckCircle,
                null,
                tint = color,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                notice.text,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** Offline banner over SAVED tasks — theme warning pair, Wallet banner style. */
@Composable
private fun EarnOfflineBanner() {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        border = BorderStroke(1.dp, warning.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "You're offline — showing your last saved reward tasks",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** First launch with no connection and NO saved tasks — never a white screen. */
@Composable
private fun EarnOfflineEmpty(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.CloudOff,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            message,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(top = 16.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 16.dp)
                .height(40.dp),
        ) {
            Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Signed out: rewards are per-buyer — soft CTA, never a redirect. */
@Composable
private fun EarnAuthRequired(onSignIn: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(80.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(36.dp),
            )
        }
        Text(
            "Sign in to earn rewards",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Reward vouchers are personal — the server checks each task against YOUR orders, reviews and check-ins",
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 6.dp),
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 16.dp)
                .height(40.dp),
        ) {
            Text("Sign in", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** The web page's TASK_ICONS mapping, in Material icon language. */
private fun iconForType(type: String): ImageVector = when (type.trim().lowercase()) {
    "first_order" -> Icons.Outlined.ShoppingCart
    "review" -> Icons.Outlined.Star
    "wishlist" -> Icons.Outlined.FavoriteBorder
    "bulk" -> Icons.Outlined.Inventory2
    "milestone" -> Icons.Outlined.Flag
    "spin" -> Icons.Outlined.CardGiftcard
    "checkin" -> Icons.Outlined.LocalFireDepartment
    else -> Icons.Outlined.CardGiftcard
}

/** The task's own hex color, parsed safely; brand primary on any drift. */
private fun parseTaskColor(raw: String?): androidx.compose.ui.graphics.Color {
    val hex = raw?.takeIf(String::isNotBlank) ?: return DefaultTaskTint
    return runCatching {
        val parsed = AndroidColor.parseColor(hex.trim())
        androidx.compose.ui.graphics.Color(parsed)
    }.getOrDefault(DefaultTaskTint)
}

private val DefaultTaskTint = androidx.compose.ui.graphics.Color(0xFFC8102E)
