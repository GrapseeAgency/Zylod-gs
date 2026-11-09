package com.zylod.wholesale.ui.rewards

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.pages.NativePageKind
import com.zylod.wholesale.ui.pages.NativePageLink
import com.zylod.wholesale.ui.pages.NativePageMeta
import com.zylod.wholesale.ui.theme.LocalZylodExtra
import java.util.Locale

/**
 * t282 page metadata — the "redeem-points" pageId (the free-amount points
 * redemption). t281 forwarded it to the WebView with "typed ui/rewards port
 * noted for later"; this typed screen is that port: the real balance from
 * GET api/rewards/loyalty, the web's five fixed options + the custom
 * voucher field, POST api/rewards/redeem, success routes to my-coupons.
 */
data object RedeemPointsTypedPageMeta : NativePageMeta() {
    override val pageId = "redeem-points"
    override val title = "Redeem Points"
    override val category = "Rewards & Engagement"
    override val kind = NativePageKind.CONTENT
    override val endpoint = "api/rewards/redeem" // POST; balance via GET api/rewards/loyalty
    override val summary =
        "Exchange loyalty points for REAL vouchers or wallet credit — 10 points = ৳1. Vouchers " +
            "are single-use coupons with a 3× minimum order; credits land in your wallet with a ledger row."
    override val tabHint = "profile"
    override val bullets = listOf(
        "Requires sign-in — the balance is YOUR account's real balance (GET api/rewards/loyalty), never a fabricated 0 Pts.",
        "POST api/rewards/redeem — errors surface verbatim (insufficient balance, the concurrent-redemption 409).",
        "Voucher success carries the REAL spendable code and routes to your coupon vault (my-coupons).",
    )
    override val related = listOf(
        NativePageLink("points-history", "Points Transaction Ledger"),
        NativePageLink("my-coupons", "My Coupons"),
        NativePageLink("reward-points", "Reward Points"),
    )
}

/**
 * NATIVE Redeem Points (t282) — the web page 1:1: amber hero banner, the
 * five fixed options (affordability-gated), the custom voucher field
 * (any ≥100 pts, ৳1 per 10), sonner-parity snackbar, my-coupons on success.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RedeemPointsScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val vm: RedeemPointsViewModel = viewModel { RedeemPointsViewModel(context.applicationContext) }
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    var customPoints by remember { mutableStateOf("") }

    LaunchedEffect(Unit) { vm.refresh() }
    // VM toasts: insufficient-balance / redeem outcomes (web sonner parity).
    LaunchedEffect(state.toast) {
        state.toast?.let {
            snackbar.showSnackbar(it)
            vm.consumeToast()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Redeem Points",
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
                actions = {
                    Surface(
                        shape = RoundedCornerShape(50),
                        color = LocalZylodExtra.current.warning.copy(alpha = 0.10f),
                        border = BorderStroke(1.dp, LocalZylodExtra.current.warning.copy(alpha = 0.35f)),
                        modifier = Modifier.padding(end = 12.dp),
                    ) {
                        Text(
                            "%,d Pts".format(Locale.US, state.balance),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Black,
                            color = LocalZylodExtra.current.warning,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                state.needsAuth -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    NeedsAuthState(openPage = openPage)
                }
                state.loadError != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    ErrorState(message = state.loadError!!, onRetry = vm::refresh)
                }
                else -> RedeemList(
                    state = state,
                    customPoints = customPoints,
                    onCustomPointsChange = { customPoints = it },
                    onRedeem = vm::redeem,
                    onRedeemCustom = { pts ->
                        vm.redeemCustom(pts)
                        customPoints = ""
                    },
                    openPage = openPage,
                )
            }
        }
    }
}

@Composable
private fun RedeemList(
    state: RedeemPointsUiState,
    customPoints: String,
    onCustomPointsChange: (String) -> Unit,
    onRedeem: (RedeemOption) -> Unit,
    onRedeemCustom: (Int) -> Unit,
    openPage: (pageId: String, query: String) -> Unit,
) {
    val warning = LocalZylodExtra.current.warning
    val customValue = (customPoints.toIntOrNull() ?: 0) / 10
    val customValid = (customPoints.toIntOrNull() ?: 0) >= 100 && (customPoints.toIntOrNull() ?: 0) <= state.balance
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "banner", contentType = "banner") {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = warning,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text(
                        "Exchange Points for Real Savings",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.surface,
                    )
                    Text(
                        "Convert your points into checkout discount vouchers.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        item(key = "options-header", contentType = "header") {
            Text(
                "REDEMPTION REWARDS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 4.dp),
            )
        }
        items(REDEEM_OPTIONS.size) { index ->
            val option = REDEEM_OPTIONS[index]
            RedeemOptionRow(
                option = option,
                canAfford = state.balance >= option.points,
                busy = state.redeemingPoints == option.points,
                anyBusy = state.redeemingPoints != null || state.customBusy,
                onRedeem = { onRedeem(option) },
            )
        }
        item(key = "custom", contentType = "custom") {
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surfaceContainer,
                border = BorderStroke(1.dp, warning.copy(alpha = 0.5f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(40.dp)
                                .background(warning.copy(alpha = 0.12f), RoundedCornerShape(14.dp)),
                        ) {
                            Icon(Icons.Outlined.Sell, null, tint = warning, modifier = Modifier.size(18.dp))
                        }
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                "Custom Voucher",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "Any amount from 100 points — ৳1 per 10 points, min order 3× the voucher value",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 12.dp),
                    ) {
                        OutlinedTextField(
                            value = customPoints,
                            onValueChange = { raw -> customPointsChange(raw, onCustomPointsChange) },
                            enabled = state.balance >= 100,
                            isError = customPoints.isNotEmpty() && !customValid,
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            placeholder = {
                                Text(
                                    if (state.balance >= 100) {
                                        "e.g. ${minOf(state.balance, 1000)} (you have %,d pts".format(Locale.US, state.balance) + ")"
                                    } else {
                                        "Earn more points first"
                                    },
                                    fontSize = 11.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            },
                            modifier = Modifier.weight(1f).height(56.dp),
                        )
                        Button(
                            onClick = { onRedeemCustom(customPoints.toInt()) },
                            enabled = customValid && !state.customBusy && !state.loading,
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = warning, contentColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.height(44.dp),
                        ) {
                            if (state.customBusy) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.surface,
                                )
                            } else {
                                Text(
                                    if (customValid && customValue > 0) "Get ৳$customValue voucher" else "Redeem",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Black,
                                )
                            }
                        }
                    }
                }
            }
        }
        item(key = "ledger-cta", contentType = "cta") {
            TextButton(onClick = { openPage("points-history", "") }, modifier = Modifier.fillMaxWidth()) {
                Text(
                    "View your full points ledger",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
        item(key = "spacer", contentType = "spacer") { Spacer(Modifier.height(4.dp)) }
    }
}

private fun customPointsChange(raw: String, setter: (String) -> Unit) {
    setter(raw.filter(Char::isDigit).take(7))
}

@Composable
private fun RedeemOptionRow(
    option: RedeemOption,
    canAfford: Boolean,
    busy: Boolean,
    anyBusy: Boolean,
    onRedeem: () -> Unit,
) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surfaceContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(14.dp),
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .background(
                        (if (option.minOrder == 0) MaterialTheme.colorScheme.primary else warning).copy(alpha = 0.10f),
                        RoundedCornerShape(14.dp),
                    ),
            ) {
                Icon(
                    if (option.minOrder == 0) Icons.Outlined.AccountBalanceWallet else Icons.Outlined.Sell,
                    null,
                    tint = if (option.minOrder == 0) MaterialTheme.colorScheme.primary else warning,
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    option.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    buildString {
                        append("Cost: %,d Points".format(Locale.US, option.points))
                        if (option.minOrder > 0) append(" · Min Order ৳%,d".format(Locale.US, option.minOrder))
                    },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(
                onClick = onRedeem,
                enabled = canAfford && !anyBusy,
                shape = RoundedCornerShape(14.dp),
                colors = if (canAfford) {
                    ButtonDefaults.buttonColors(containerColor = warning, contentColor = MaterialTheme.colorScheme.surface)
                } else {
                    ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                },
                modifier = Modifier.height(38.dp),
            ) {
                if (busy) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                } else {
                    Text(
                        when {
                            !canAfford -> "Need Pts"
                            else -> "Redeem"
                        },
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                    )
                }
            }
        }
    }
}

@Composable
private fun NeedsAuthState(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Text(
            "Sign in to redeem points",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            textAlign = TextAlign.Center,
        )
        Text(
            "Loyalty points are earned on wholesale purchase orders, reviews, and referrals. Sign in to see and redeem your real balance.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Sign in", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp),
    ) {
        Text(
            "Could not load your points",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
        )
        Text(
            message,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .padding(top = 24.dp)
                .height(48.dp),
        ) {
            Text("Try again", fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}
