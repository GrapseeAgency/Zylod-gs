package com.zylod.wholesale.ui.logistics

import androidx.compose.foundation.border
import com.zylod.wholesale.data.api.QuoteOptionDto
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed freight-calculator screen (pageId shipping-calculator — the
 * ui/screens delegate calls THIS, ported from shipping-calculator-page.tsx).
 *
 * Data truth: GET api/shipping/quote via [ShippingCalculatorViewModel] —
 * the LIVE zone book the admins actually configure. Structure mirrors the
 * web: the Shipment Details card (destination district, chargeable weight
 * + KG unit box, the volumetric helper row, the optional order subtotal
 * that unlocks free-above thresholds, the Get Live Quote action), then the
 * zone book's real answer — option cards with methodName, zoneName, the ৳
 * price (FREE in green with the honest "৳basePrice waived above ৳freeAbove"
 * note), methodDescription, the real estimatedDays, and the Cheapest
 * accent on the first option. A 400 is the server's real text; an
 * uncovered district is the honest empty state. NO fake default quote.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShippingCalculatorScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    @Suppress("UNUSED_PARAMETER") query: String,
) {
    val context = LocalContext.current
    val vm: ShippingCalculatorViewModel = viewModel(key = "native-shipping-calculator-$pageId") {
        ShippingCalculatorViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Quote once on mount so the page never sits on an invented number
    // (web useEffect parity — the Dhaka / 10kg defaults go on the wire).
    LaunchedEffect(Unit) { vm.quote() }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Freight Calculator",
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
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item(key = "calc-title", contentType = "header") {
                Column {
                    Text(
                        "Freight Calculator",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        "Live quotes from the operators' zone book — the same rates checkout charges.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            item(key = "calc-form", contentType = "form") {
                ShipmentDetailsCard(state = state, vm = vm)
            }
            when {
                state.loading -> item(key = "calc-loading", contentType = "notice") {
                    LoadingCard("Asking the live zone book…")
                }
                state.error != null -> item(key = "calc-error", contentType = "notice") {
                    CalcErrorCard(state.error.orEmpty(), onRetry = vm::quote)
                }
                state.loaded && state.options.isEmpty() -> item(key = "calc-empty", contentType = "notice") {
                    EmptyQuoteCard(state.quotedDistrict)
                }
                state.options.isNotEmpty() -> item(key = "calc-options", contentType = "options") {
                    QuoteOptions(state = state)
                }
            }
        }
    }
}

/* ─── shipment details form ──────────────────────────────────────────────── */

@Composable
private fun ShipmentDetailsCard(state: ShippingCalculatorUiState, vm: ShippingCalculatorViewModel) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(
                "SHIPMENT DETAILS",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            // Destination district
            Column {
                Text(
                    "Destination District",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                OutlinedTextField(
                    value = state.district,
                    onValueChange = vm::setDistrict,
                    placeholder = {
                        Text("e.g. Dhaka, Chittagong, Khulna", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    },
                    leadingIcon = {
                        Icon(
                            Icons.Outlined.LocationOn,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    shape = RoundedCornerShape(16.dp),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
            // Chargeable weight + the KG unit box (web parity)
            Column {
                Text(
                    "Chargeable Weight",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                    OutlinedTextField(
                        value = state.weight,
                        onValueChange = vm::setWeight,
                        placeholder = { Text("0.00", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        shape = RoundedCornerShape(16.dp),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.height(56.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 16.dp)) {
                            Text(
                                "KG",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
            // Volumetric helper (real math, clearly labeled)
            Column {
                Text(
                    "Volumetric helper (L × W × H cm ÷ 5000)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 6.dp),
                ) {
                    DimField(value = state.dimL, onValueChange = vm::setDimL, placeholder = "L", modifier = Modifier.weight(1f))
                    Text("×", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    DimField(value = state.dimW, onValueChange = vm::setDimW, placeholder = "W", modifier = Modifier.weight(1f))
                    Text("×", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    DimField(value = state.dimH, onValueChange = vm::setDimH, placeholder = "H", modifier = Modifier.weight(1f))
                    Text(
                        "Apply",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .clickable { vm.applyVolumetric() }
                            .padding(horizontal = 8.dp, vertical = 12.dp),
                    )
                }
            }
            // Order subtotal (for freeAbove crossings)
            Column {
                Text(
                    "Order subtotal",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Optional — unlocks free-above thresholds",
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = state.subtotal,
                    onValueChange = vm::setSubtotal,
                    placeholder = { Text("e.g. 50000", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                    leadingIcon = {
                        Icon(
                            Icons.Outlined.Storefront,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    shape = RoundedCornerShape(16.dp),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
            // Validation / network error — the honest inline line (web quoteError).
            state.error?.let {
                Text(it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
            }
            // Informational helper (the applied volumetric weight).
            state.hint?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = LocalZylodExtra.current.success,
                    modifier = Modifier.clickable { vm.consumeHint() },
                )
            }
            Button(
                onClick = vm::quote,
                enabled = !state.loading,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
            ) {
                Text(
                    if (state.loading) "Quoting…" else "Get Live Quote",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun DimField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        shape = RoundedCornerShape(16.dp),
        singleLine = true,
        modifier = modifier,
    )
}

/* ─── results ────────────────────────────────────────────────────────────── */

@Composable
private fun QuoteOptions(state: ShippingCalculatorUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.offlineFromCache) {
            OfflineQuoteBanner("Offline — showing the last saved quote")
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "LIVE OPTIONS",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            val count = state.options.size
            Text(
                "$count option" + (if (count == 1) "" else "s") + " · " + state.quotedDistrict,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        state.options.forEachIndexed { index, option ->
            QuoteOptionCard(option = option, cheapest = index == 0)
        }
        Text(
            "These are the operators' configured rates for this lane — the same book checkout charges against. " +
                "Freight is booked by placing an order; there is no separate freight booking on this platform.",
            fontSize = 10.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * One zone-book option (web parity): the Cheapest accent is the 4dp
 * primary border on the first (price-asc) option.
 */
@Composable
private fun QuoteOptionCard(option: QuoteOptionDto, cheapest: Boolean) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (cheapest) {
                    Modifier.border(4.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(24.dp))
                } else {
                    Modifier.border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(24.dp))
                },
            ),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            option.methodName.orEmpty().ifBlank { "--" },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        if (cheapest) {
                            Spacer(Modifier.width(8.dp))
                            Surface(color = MaterialTheme.colorScheme.primary, shape = RoundedCornerShape(6.dp)) {
                                Text(
                                    "CHEAPEST",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                )
                            }
                        }
                    }
                    Text(
                        option.zoneName.orEmpty(),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    val extra = LocalZylodExtra.current
                    if (option.freeShipping) {
                        Text(
                            "FREE",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black,
                            color = extra.success,
                        )
                        option.freeAbove?.let {
                            Text(
                                "(" + formatTaka(option.basePrice) + " waived above " + formatTaka(it) + ")",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = extra.success,
                            )
                        }
                    } else {
                        Text(
                            formatTaka(option.price),
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
            option.methodDescription?.let {
                Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .padding(top = 4.dp)
                    .fillMaxWidth(),
            ) {
                Text(
                    "Estimated transit: ",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    option.estimatedDays ?: "Not stated by the operator",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

/** Loading card (web PageLoader "Asking the live zone book…" parity). */
@Composable
private fun LoadingCard(label: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.size(width = 220.dp, height = 12.dp),
            ) {}
            Text(
                label,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

/** Honest failure card: the error text + Retry. */
@Composable
private fun CalcErrorCard(message: String, onRetry: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
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
                Icons.Outlined.ErrorOutline,
                null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(28.dp),
            )
            Text(
                message,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "Retry",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .clickable { onRetry() },
            )
        }
    }
}

/** The zone book's honest empty answer (web parity copy, real district). */
@Composable
private fun EmptyQuoteCard(quotedDistrict: String) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
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
                Icons.Outlined.LocalShipping,
                null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(28.dp),
            )
            Text(
                "No shipping option covers that yet",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "No active zone in the operators' book reaches \u201C$quotedDistrict\u201D at this weight. " +
                    "Try a nearby district — or contact support to request the lane.",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

/** Amber banner over the cached quote — the LiveChatScreen banner style. */
@Composable
private fun OfflineQuoteBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Icon(Icons.Outlined.CloudOff, null, tint = warning, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text(text, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}
