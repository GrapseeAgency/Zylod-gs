package com.zylod.wholesale.ui.coupons

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
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.graphics.BorderStroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
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
 * Native Coupon Promo screen — the web's coupon-promo page
 * (src/components/pages/coupon-promo-page.tsx), behavior-exact:
 *
 *  - the "Have a code? Collect it to your vault" box: typing a code POSTs
 *    api/coupons/claim { code }; 201 → "Collected" + the list refreshes
 *    (the code may have been personal to this buyer), 401 → the sign-in
 *    state, anything else surfaces the server's own refusal verbatim
 *    (expired, exhausted, foreign, unknown),
 *  - the campaign rail: GET api/coupons?limit=30 public rows (personal
 *    earned vouchers filtered out — they already live in the vault), each
 *    with copy-to-box and a per-row Claim,
 *  - the honesty line from the web page ("The server checks the code
 *    against the live database…") kept verbatim in intent,
 *  - guests: the LIST stays public; only a claim attempt flips to the soft
 *    sign-in CTA (never a hard redirect — Wallet/Coupons precedent),
 *  - offline: saved campaigns render under the warning banner; first
 *    launch with neither network nor cache: the honest Retry state.
 *
 * Visual language = My Coupons (16dp surfaces on surfaceContainer, 0.5
 * alpha outline border, brand-red primary actions, M3-only loading).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponPromoScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CouponPromoViewModel = viewModel { CouponPromoViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()

    // t208 parity with Wallet/Orders/Coupons: re-pull on EVERY entry —
    // codes claimed elsewhere show up at once.
    LaunchedEffect(Unit) { vm.refresh() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Coupons & Promo Codes",
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
                // A claim attempt (or the expired-tick) hit a dead session —
                // soft CTA with the vault rationale, never a redirect.
                state.needsAuth -> PromoAuthRequired(onSignIn = { openPage("login", "") })
                state.error != null -> PromoOfflineEmpty(message = state.error!!, onRetry = vm::retry)
                else -> PromoContent(state = state, vm = vm)
            }
        }
    }
}

@Composable
private fun PromoContent(state: CouponPromoUiState, vm: CouponPromoViewModel) {
    var promoInput by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (state.offline) {
            item(key = "offline-banner", contentType = "banner") { PromoOfflineBanner() }
        }
        state.notice?.let { notice ->
            item(key = "notice", contentType = "banner") { PromoNoticeBanner(notice) }
        }
        item(key = "subtitle", contentType = "meta") {
            Text(
                "Collect vouchers to your vault — codes are applied at checkout.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item(key = "code-box", contentType = "code-box") {
            CodeEntryCard(
                value = promoInput,
                onValueChange = { promoInput = it },
                claiming = state.claimingKey == CouponPromoViewModel.CODE_CLAIM_KEY,
                enabled = !state.anyClaimInFlight,
                onCollect = { vm.claimByCode(promoInput) },
            )
        }
        item(key = "campaigns-header", contentType = "header") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.LocalOffer,
                    null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Live campaigns",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "${state.campaigns.size}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        items(items = state.campaigns, key = { it.stableKey }, contentType = { "campaign" }) { coupon ->
            PromoCampaignCard(
                coupon = coupon,
                claimingThis = state.claimingKey == coupon.stableKey,
                anyClaimInFlight = state.anyClaimInFlight,
                onClaim = vm::claim,
                onCopy = {
                    promoInput = coupon.code
                },
            )
        }
        if (state.campaigns.isEmpty()) {
            item(key = "empty", contentType = "empty") {
                Text(
                    if (state.offline) {
                        "No saved campaigns on this device yet."
                    } else {
                        "No live campaigns right now — check back soon."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        item(key = "honesty", contentType = "meta") {
            Text(
                "The server checks every code against the live database — expired, exhausted, foreign or unknown codes are refused with the real reason. Application to an order happens at checkout from your vault.",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

/**
 * The typed-code box — the web page's "Have a code? Collect it to your
 * vault" card: uppercase input (the server matches codes case-insensitively
 * but codes display uppercase), Collect posts api/coupons/claim { code }.
 */
@Composable
private fun CodeEntryCard(
    value: String,
    onValueChange: (String) -> Unit,
    claiming: Boolean,
    enabled: Boolean,
    onCollect: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(
                "Have a code? Collect it to your vault",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 10.dp),
            ) {
                OutlinedTextField(
                    value = value,
                    onValueChange = { onValueChange(it.uppercase(Locale.US)) },
                    singleLine = true,
                    enabled = enabled,
                    placeholder = {
                        Text("E.G. BULK2024", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    },
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Characters,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { onCollect() }),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = onCollect,
                    enabled = enabled && value.isNotBlank(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    modifier = Modifier.height(52.dp),
                ) {
                    if (claiming) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("Checking", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    } else {
                        Text("Collect", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * One campaign card — discount label (the server's own builder mirrored in
 * [defaultDiscountLabel]), the code, validity/min-order meta, copy-to-box
 * and the per-row Claim. Same card anatomy as My Coupons' claim rail.
 */
@Composable
private fun PromoCampaignCard(
    coupon: PlatformCoupon,
    claimingThis: Boolean,
    anyClaimInFlight: Boolean,
    onClaim: (PlatformCoupon) -> Unit,
    onCopy: () -> Unit,
) {
    val validityLine = remember(coupon) {
        val expiry = formatPromoExpiry(coupon.validUntil)?.let { "Valid until $it" }
        val minOrder = if (coupon.minOrder > 0.0) "Min order ৳${formatBdtValue(coupon.minOrder)}" else null
        val uses = coupon.remainingUses?.let { "$it uses left" }
        listOfNotNull(expiry, minOrder, uses).joinToString("  •  ").ifBlank { null }
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
                IconButton(onClick = onCopy, modifier = Modifier.size(34.dp)) {
                    Icon(
                        Icons.Outlined.ContentCopy,
                        contentDescription = "Copy ${coupon.code} to the code box",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(16.dp),
                    )
                }
                PromoClaimButton(
                    coupon = coupon,
                    claimingThis = claimingThis,
                    anyClaimInFlight = anyClaimInFlight,
                    onClaim = onClaim,
                )
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
private fun PromoClaimButton(
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

@Composable
private fun PromoNoticeBanner(notice: CouponPromoUiState.Notice) {
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

/** Offline banner over SAVED campaigns — theme warning pair, Wallet style. */
@Composable
private fun PromoOfflineBanner() {
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
                "You're offline — showing your last saved campaigns",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

/** First launch with no connection and NO saved campaigns — never white. */
@Composable
private fun PromoOfflineEmpty(message: String, onRetry: () -> Unit) {
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

/** Signed out after a claim attempt: soft CTA — vouchers are per-buyer. */
@Composable
private fun PromoAuthRequired(onSignIn: () -> Unit) {
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
            "Sign in to collect vouchers",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your vault is tied to your account — collected codes are applied at checkout",
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

/** ISO date → "d MMM yyyy" (My Coupons' formatExpiry, same contract). */
private fun formatPromoExpiry(iso: String?): String? {
    val raw = iso?.takeIf(String::isNotBlank) ?: return null
    val parsed = runCatching {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(raw.take(10))
    }.getOrNull() ?: return null
    return SimpleDateFormat("d MMM yyyy", Locale.US).format(parsed)
}
