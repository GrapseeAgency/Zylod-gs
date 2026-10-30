package com.zylod.wholesale.ui.coupons

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ConfirmationNumber
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * NATIVE My Coupons (pageId "my-coupons" — RouteOwnership buyer-rewards
 * surface). Real data only, from GET /api/coupons/my (the status-filtered
 * voucher vault), GET /api/coupons (public campaign codes with a working
 * Claim action) and GET /api/rewards (loyalty points, with the
 * redeem-points quick action) — honest loading / sign-in / offline / empty
 * states, sp+FontWeight type styles, theme colors only (brand red comes from
 * MaterialTheme.colorScheme.primary, never a hardcoded hex).
 *
 * Structure mirrors WalletScreen: Scaffold + TopAppBar + one keyed
 * LazyColumn with sectioned rows (Available to claim, Your Vouchers, Used),
 * stable row keys (coupon row ids, VM-side dedup) and one-shot claim
 * feedback as an inline banner.
 *
 * Signature parity: byte-compatible with the generated
 * ui/screens/MyCouponsScreen.kt composable so the integrator can swap the
 * NativePageRegistry "my-coupons" row to this screen unchanged. `query` is
 * accepted for that contract; the my-coupons page has no deep-link
 * parameters.
 *
 * BACK CONTRACT: installs NO BackHandler — like Wallet/Deals, onBack == null
 * renders as a tab-like destination and system Back pops the NavHost entry.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CouponsViewModel = viewModel { CouponsViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Wallet/Orders/Deals: re-pull on EVERY entry — vouchers
    // claimed or spent anywhere else in the app show up the moment the user
    // lands back here. The VM's silent refresh keeps visible data mounted.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "My Coupons",
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
                // THE one page-level loading animation (M3 rule — no shimmer,
                // no custom loaders; WalletScreen parity).
                state.loading -> Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    CircularProgressIndicator()
                }
                // Signed out: coupons are per-buyer money promises — a soft
                // sign-in CTA, never a hard redirect (WalletScreen
                // precedent).
                state.needsAuth -> CouponsAuthRequired(onSignIn = { openPage("login", "") })
                // First launch offline: nothing fetched AND nothing saved —
                // a themed empty state with Retry, never a white screen.
                state.error != null -> CouponsOfflineEmpty(onRetry = vm::retry)
                else -> CouponsContent(state = state, onClaim = vm::claim, openPage = openPage)
            }
        }
    }
}

@Composable
private fun CouponsContent(
    state: CouponsUiState,
    onClaim: (PlatformCoupon) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { OfflineBanner() }
        }
        state.notice?.let { notice ->
            item(key = "notice", contentType = "banner") { NoticeBanner(notice) }
        }
        state.rewards?.let { rewards ->
            item(key = "rewards-card", contentType = "rewards") { RewardsCard(rewards, openPage) }
        }
        couponSection(
            headerKey = "avail-header",
            emptyKey = "avail-empty",
            itemKeyPrefix = "avail",
            title = "Available Coupons",
            icon = Icons.Outlined.LocalOffer,
            countLabel = if (state.available.size == 1) "1 to claim" else "${state.available.size} to claim",
            emptyText = "No coupons to claim right now — new campaigns drop regularly.",
            rows = state.available,
            keyOf = { it.stableKey },
        ) { coupon ->
            PlatformCouponCard(
                coupon = coupon,
                claimingThis = state.claimingKey == coupon.stableKey,
                anyClaimInFlight = state.claimingKey != null,
                onClaim = onClaim,
            )
        }
        couponSection(
            headerKey = "vault-header",
            emptyKey = "vault-empty",
            itemKeyPrefix = "vault",
            title = "Your Vouchers",
            icon = Icons.Outlined.ConfirmationNumber,
            countLabel = if (state.active.size == 1) "1 ready" else "${state.active.size} ready",
            emptyText = "No active vouchers yet — claim one above or redeem points for one.",
            rows = state.active,
            keyOf = { it.stableKey },
        ) { item ->
            VaultCouponCard(item)
        }
        couponSection(
            headerKey = "used-header",
            emptyKey = "used-empty",
            itemKeyPrefix = "used",
            title = "Used",
            icon = Icons.Outlined.CheckCircle,
            countLabel = if (state.used.size == 1) "1 spent" else "${state.used.size} spent",
            emptyText = "No used vouchers yet — spend an active one at checkout.",
            rows = state.used,
            keyOf = { it.stableKey },
        ) { item ->
            VaultCouponCard(item)
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * One keyed section: themed header, then the rows (or an honest empty line).
 * Keys are section-prefixed coupon row ids — unique across the whole list
 * even when the same campaign id shows up in two sections.
 */
private fun <T> LazyListScope.couponSection(
    headerKey: String,
    emptyKey: String,
    itemKeyPrefix: String,
    title: String,
    icon: ImageVector,
    countLabel: String,
    emptyText: String,
    rows: List<T>,
    keyOf: (T) -> String,
    row: @Composable (T) -> Unit,
) {
    item(key = headerKey, contentType = "header") {
        SectionHeader(title, icon, countLabel)
    }
    if (rows.isEmpty()) {
        item(key = emptyKey, contentType = "empty") {
            Text(
                emptyText,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    } else {
        items(
            rows,
            key = { "$itemKeyPrefix-${keyOf(it)}" },
            contentType = { "coupon" },
        ) { row(it) }
    }
}

@Composable
private fun SectionHeader(title: String, icon: ImageVector, countLabel: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(top = 6.dp),
    ) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            title,
            fontSize = 13.sp,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.weight(1f))
        Text(
            countLabel,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * Loyalty points card — the big number is the brand red via
 * MaterialTheme.colorScheme.primary, and the button routes into the existing
 * redeem-points page.
 */
@Composable
private fun RewardsCard(
    rewards: RewardsSummary,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val pointsLabel = remember(rewards) { formatPoints(rewards.points) }
    val meta = remember(rewards) {
        val tierPart = rewards.tier?.let { tier -> "$tier member" }
        val nextPart = rewards.nextTier?.let { next ->
            rewards.pointsToNext?.let { needed -> "$needed pts to $next" }
        }
        listOfNotNull(tierPart, nextPart).joinToString("  •  ").ifBlank { null }
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Star,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Loyalty Points",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.weight(1f))
                rewards.tier?.let {
                    Text(
                        "$it member",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier.padding(top = 4.dp),
            ) {
                Text(
                    pointsLabel,
                    fontSize = 30.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "pts",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
            meta?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Button(
                onClick = { openPage("redeem-points", "") },
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .padding(top = 12.dp)
                    .height(40.dp),
            ) {
                Text("Redeem Points", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * One claimable campaign card — the Claim button posts api/coupons/claim
 * through the VM and shows an honest spinner only while THAT row is in
 * flight (other rows stay enabled-off until it settles).
 */
@Composable
private fun PlatformCouponCard(
    coupon: PlatformCoupon,
    claimingThis: Boolean,
    anyClaimInFlight: Boolean,
    onClaim: (PlatformCoupon) -> Unit,
) {
    val validityLine = remember(coupon) {
        val expiry = formatExpiry(coupon.validUntil)?.let { "Valid until $it" }
        val minOrder = if (coupon.minOrder > 0.0) "Min order ৳${formatBdtValue(coupon.minOrder)}" else null
        listOfNotNull(expiry, minOrder).joinToString("  •  ").ifBlank { null }
    }

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        coupon.discountLabel,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "Code ${coupon.code}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Spacer(Modifier.width(8.dp))
                ClaimButton(coupon, claimingThis, anyClaimInFlight, onClaim)
            }
            validityLine?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ClaimButton(
    coupon: PlatformCoupon,
    claimingThis: Boolean,
    anyClaimInFlight: Boolean,
    onClaim: (PlatformCoupon) -> Unit,
) {
    when {
        // Defensive: the VM filters personal rows out of the claim rail.
        coupon.personal -> Text(
            "In your vault",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        !coupon.claimable -> Text(
            "Fully claimed",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        else -> Button(
            onClick = { onClaim(coupon) },
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
                Text("Claim", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/**
 * One vault card — discount value in brand red, the code in a chip, expiry
 * and minimum order underneath, status chip on the right. Used rows render
 * desaturated so active vouchers dominate the scan.
 */
@Composable
private fun VaultCouponCard(item: CouponVaultItem) {
    val expiryLabel = remember(item) { formatExpiry(item.validUntil) }
    val minOrderLabel = remember(item) {
        if (item.minOrder > 0.0) "Min order ৳${formatBdtValue(item.minOrder)}" else null
    }
    val active = item.spendable

    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    item.discountLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = if (active) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                StatusChip(item.status)
            }
            Text(
                item.title,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 8.dp),
            ) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {
                    Text(
                        item.code,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column {
                    expiryLabel?.let {
                        Text(
                            "Valid until $it",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    minOrderLabel?.let {
                        Text(
                            it,
                            fontSize = 10.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

/** Status chip: ACTIVE in the theme success pair, USED neutral, EXPIRED warning. */
@Composable
private fun StatusChip(status: CouponStatus) {
    val (label, container, content) = when (status) {
        CouponStatus.ACTIVE -> Triple(
            "Active",
            LocalZylodExtra.current.success.copy(alpha = 0.14f),
            LocalZylodExtra.current.success,
        )
        CouponStatus.USED -> Triple(
            "Used",
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.onSurfaceVariant,
        )
        CouponStatus.EXPIRED -> Triple(
            "Expired",
            LocalZylodExtra.current.warning.copy(alpha = 0.14f),
            LocalZylodExtra.current.warning,
        )
        CouponStatus.UNKNOWN -> Triple(
            "—",
            MaterialTheme.colorScheme.surfaceVariant,
            MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    Surface(shape = RoundedCornerShape(6.dp), color = container) {
        Text(
            label,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 0.8.sp,
            color = content,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
        )
    }
}

/** One-shot claim feedback: theme success pair on success, error pair on failure. */
@Composable
private fun NoticeBanner(notice: CouponsUiState.Notice) {
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

/** Offline banner over SAVED coupons — theme warning pair, Wallet banner style. */
@Composable
private fun OfflineBanner() {
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
                "You're offline — showing your last saved coupons",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/**
 * First launch with no connection and NO saved coupons: themed empty state
 * with Retry — never a white screen.
 */
@Composable
private fun CouponsOfflineEmpty(onRetry: () -> Unit) {
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
            "You're offline",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "No coupons saved yet — connect once to save them",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * Signed out: the vault belongs to the account — soft sign-in CTA (the
 * login pageId is the RouteOwnership guest-policy path, no hard redirect).
 */
@Composable
private fun CouponsAuthRequired(onSignIn: () -> Unit) {
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
            "Sign in to view your coupons",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your vouchers, claimable campaigns and loyalty points live with your account",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onSignIn,
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign In", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** "2025-01-15T…" → "15 Jan 2025"; unparseable input hides the expiry line, never crashes. */
private fun formatExpiry(iso: String?): String? {
    val raw = iso?.takeIf(String::isNotBlank) ?: return null
    val parsed = runCatching {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(raw.take(10))
    }.getOrNull() ?: return null
    return SimpleDateFormat("d MMM yyyy", Locale.US).format(parsed)
}

private fun formatPoints(points: Int): String =
    java.text.NumberFormat.getIntegerInstance().format(points.toLong())
