package com.zylod.wholesale.ui.logistics

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.ui.theme.LocalZylodExtra

/**
 * SHARED typed order-tracking screen (pageIds order-tracking, track-package,
 * track-consignment — the ui/screens delegates call THIS with their pageId,
 * so every page keeps its own TrackOrderViewModel instance through the
 * pageId-keyed factory below).
 *
 * Data truth: GET api/orders/{orderId} via [TrackOrderViewModel] — the REAL
 * subOrders/trackingHistory of the buyer's order. Structure mirrors
 * track-order-page.tsx: the honest "No order selected" state, the sign-in
 * gate, the honest "Order not found" card, the error card with Retry, and
 * the status card (order number + derived badge, real ETA, the 4-step
 * progress rail, per-shipment rows with tracking numbers) plus the
 * Tracking History timeline. Nothing is fabricated: no fake carriers, no
 * invented events, no fake live map.
 *
 * Theme colors only (the brand red arrives as MaterialTheme.colorScheme;
 * success/warning from LocalZylodExtra), stable fully-prefixed LazyColumn
 * keys are precomputed in LogisticsModels ("ship-…", "event-…").
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackOrderScreen(
    pageId: String,
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: TrackOrderViewModel = viewModel(key = "native-track-order-$pageId") {
        TrackOrderViewModel(context.applicationContext, pageId)
    }
    val state by vm.state.collectAsStateWithLifecycle()

    // Re-resolve on EVERY entry (LiveChatScreen parity) — the VM survives
    // on the saved back stack, so a fresh query re-tracks the new order.
    LaunchedEffect(Unit) { vm.load(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TrackTopBar(title = trackTitleFor(pageId), onBack = onBack)
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState()),
        ) {
            when {
                // Honest gate for signed-out buyers (no token, or a 401 after
                // the shared authenticator's refresh attempt) — no fake data.
                state.needsAuth -> TrackAuthGate(openPage = openPage, onRetry = { vm.load() })
                // Web parity: no order id in the entry query.
                !state.hasOrderId -> NoOrderState(openPage = openPage)
                // Definitive 404 — the honest "Order not found" card.
                state.notFound -> NotFoundCard(openPage = openPage)
                // First-launch failure with nothing renderable: error card.
                state.error != null -> {
                    val errorMessage = state.error
                    TrackErrorCard(message = errorMessage.orEmpty(), onRetry = vm::retry)
                }
                // Resolving the order: skeleton placeholders.
                state.loading -> TrackSkeleton()
                else -> TrackContent(state = state, openPage = openPage)
            }
        }
    }
}

private fun trackTitleFor(pageId: String): String = when (pageId) {
    "track-package" -> "Track Package"
    "track-consignment" -> "Track Consignment"
    else -> "Track Order"
}

/* ─── top bar ────────────────────────────────────────────────────────────── */

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrackTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = {
            Text(
                title,
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

/* ─── content ────────────────────────────────────────────────────────────── */

@Composable
private fun TrackContent(state: TrackOrderUiState, openPage: (pageId: String, query: String) -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        if (state.offlineFromCache) {
            OfflineBanner("Offline — showing the last saved tracking snapshot")
        }
        StatusCard(state = state, openPage = openPage)
        Spacer(Modifier.height(16.dp))
        TrackingHistoryCard(state = state, openPage = openPage)
    }
}

@Composable
private fun StatusCard(state: TrackOrderUiState, openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp)) {
            // Header: order number + derived overall badge.
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "ORDER NUMBER",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 1.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "#${state.orderNumber.ifBlank { "--" }}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                BadgeChip(state.overallBadge)
            }
            if (state.placedLabel.isNotBlank()) {
                Text(
                    "Placed ${state.placedLabel}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }

            Spacer(Modifier.height(16.dp))
            // Estimated Delivery — only a real supplier-set date (web parity).
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Estimated Delivery",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                val eta = state.etaLabel
                if (eta != null) {
                    Text(
                        eta,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                } else {
                    Text(
                        "To be scheduled by the supplier",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            // 4-step progress rail — derived only from real subOrder statuses.
            ProgressRail(stage = state.stage, allDelivered = state.allDelivered)

            Spacer(Modifier.height(16.dp))
            // Per-shipment tracking — real numbers only.
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (state.shipments.isEmpty()) {
                    Text(
                        "No shipments recorded for this order.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                state.shipments.forEach { shipment ->
                    ShipmentCard(shipment = shipment, openPage = openPage)
                }
            }
        }
    }
}

@Composable
private fun BadgeChip(badge: String) {
    val extra = LocalZylodExtra.current
    val (container, content) = when (badge) {
        "DELIVERED" -> extra.success to extra.onSuccess
        "CANCELLED" -> MaterialTheme.colorScheme.error to MaterialTheme.colorScheme.onError
        "IN TRANSIT" -> MaterialTheme.colorScheme.primary to MaterialTheme.colorScheme.onPrimary
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    val icon = when (badge) {
        "DELIVERED" -> Icons.Outlined.CheckCircle
        "IN TRANSIT" -> Icons.Outlined.LocalShipping
        "CANCELLED" -> Icons.Outlined.ErrorOutline
        else -> Icons.Outlined.Inventory
    }
    Surface(color = container, shape = RoundedCornerShape(50)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        ) {
            Icon(icon, null, tint = content, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(4.dp))
            Text(
                badge,
                color = content,
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

/** The web PROGRESS_STEPS rail: Confirmed → Packed → Transit → Delivered. */
@Composable
private fun ProgressRail(stage: Int, allDelivered: Boolean) {
    val steps = listOf("Confirmed", "Packed", "Transit", "Delivered")
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp),
    ) {
        steps.forEachIndexed { index, label ->
            val position = index + 1
            val completed = allDelivered || position < stage
            val active = !allDelivered && position == stage
            if (index > 0) {
                Box(
                    Modifier
                        .weight(1f)
                        .height(2.dp)
                        .background(
                            if (allDelivered || position <= stage) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant
                            },
                        ),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                val circleColor = when {
                    completed -> MaterialTheme.colorScheme.primary
                    active -> MaterialTheme.colorScheme.surface
                    else -> MaterialTheme.colorScheme.surfaceVariant
                }
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(30.dp)
                        .background(circleColor, RoundedCornerShape(50))
                        .border(
                            width = if (active) 2.dp else 0.dp,
                            color = if (active) MaterialTheme.colorScheme.primary else circleColor,
                            shape = RoundedCornerShape(50),
                        ),
                ) {
                    when {
                        completed -> Icon(
                            Icons.Outlined.Check,
                            null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(16.dp),
                        )
                        active -> Box(
                            Modifier
                                .size(12.dp)
                                .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                        )
                        else -> Icon(
                            Icons.Outlined.Inventory,
                            null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                }
                Text(
                    label,
                    fontSize = 10.sp,
                    fontWeight = if (completed || active) FontWeight.Black else FontWeight.Bold,
                    color = if (completed || active) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun ShipmentCard(shipment: ShipmentRow, openPage: (pageId: String, query: String) -> Unit) {
    val clipboard = LocalClipboardManager.current
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(38.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f), RoundedCornerShape(12.dp)),
                ) {
                    Icon(
                        Icons.Outlined.LocalShipping,
                        null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        shipment.supplierName,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                    )
                    Text(
                        "Shipment ${shipment.position} of ${shipment.count}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(6.dp)) {
                    Text(
                        shipment.statusLabel,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    )
                }
            }
            val trackingNumber = shipment.trackingNumber
            if (trackingNumber != null) {
                // The web row has a copy affordance; the native one copies to
                // the platform clipboard — same honest number, no invention.
                Surface(
                    color = MaterialTheme.colorScheme.surfaceContainer,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                        Text(
                            "Tracking: $trackingNumber",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                        )
                        IconButton(
                            onClick = { clipboard.setText(AnnotatedString(trackingNumber)) },
                            modifier = Modifier.size(28.dp),
                        ) {
                            Icon(
                                Icons.Outlined.ContentCopy,
                                "Copy tracking number",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }
            } else {
                Text(
                    "No tracking number assigned yet",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            shipment.etaLabel?.let {
                Text(
                    "ETA $it",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun TrackingHistoryCard(state: TrackOrderUiState, openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (state.events.isEmpty()) "Tracking History" else "Tracking History (${state.events.size})",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                if (state.orderId.isNotBlank()) {
                    // The web link to the full timeline — the real order-timeline page.
                    TextButton(onClick = { openPage("order-timeline", "orderId=${state.orderId}") }) {
                        Text(
                            "View Full Timeline →",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
            if (state.events.isEmpty()) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                ) {
                    Icon(
                        Icons.Outlined.LocalShipping,
                        null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(24.dp),
                    )
                    Text(
                        "No tracking updates yet",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Text(
                        "Updates appear here once the supplier ships your order.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            } else {
                state.events.forEach { event ->
                    TimelineRow(event = event)
                }
            }
        }
    }
}

@Composable
private fun TimelineRow(event: TrackingEventRow) {
    Row(verticalAlignment = Alignment.Top) {
        // Node — the newest event gets the highlighted ring (web isLatest).
        val extra = LocalZylodExtra.current
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .padding(top = 2.dp)
                .size(14.dp)
                .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(50))
                .border(
                    2.dp,
                    if (event.latest) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                    RoundedCornerShape(50),
                ),
        ) {
            if (event.latest) {
                Box(
                    Modifier
                        .size(6.dp)
                        .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(50)),
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                event.statusLabel,
                fontSize = 12.sp,
                fontWeight = if (event.latest) FontWeight.Black else FontWeight.SemiBold,
                color = if (event.latest) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
            val meta = listOfNotNull(
                event.location,
                event.trackedLabel.takeIf(String::isNotBlank),
            ).joinToString(" • ")
            if (meta.isNotBlank()) {
                Text(
                    meta,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            event.note?.let {
                Text(
                    it,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            event.supplierName?.let {
                Text(
                    it,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = extra.success,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/* ─── states ─────────────────────────────────────────────────────────────── */

/** Resolving the order — placeholder card (web PageLoader parity). */
@Composable
private fun TrackSkeleton() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBar(width = 220.dp)
        SkeletonBar(width = 320.dp)
        SkeletonBar(width = 280.dp)
        SkeletonBar(width = 300.dp)
        Text(
            "Loading tracking…",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun SkeletonBar(width: androidx.compose.ui.unit.Dp) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.size(width = width, height = 40.dp),
    ) {}
}

/**
 * Honest failure card (load errors): red-tinted, warning icon, the error
 * text, and a Retry that re-runs the full fetch.
 */
@Composable
private fun TrackErrorCard(message: String, onRetry: () -> Unit) {
    val error = MaterialTheme.colorScheme.error
    Surface(
        color = error.copy(alpha = 0.08f),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .border(1.dp, error.copy(alpha = 0.25f), RoundedCornerShape(14.dp)),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ErrorOutline, null, tint = error, modifier = Modifier.size(18.dp))
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
                    .height(36.dp),
            ) {
                Text("Retry", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Definitive 404 — the honest "Order not found" card (web parity). */
@Composable
private fun NotFoundCard(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 48.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(56.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Inventory,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp),
            )
        }
        Text(
            "Order not found",
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 12.dp),
        )
        Text(
            "This order doesn't exist or the link you followed is incorrect.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 6.dp),
        )
        Button(
            onClick = { openPage("my-orders", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 20.dp)
                .height(40.dp),
        ) {
            Text("Go to My Orders", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/** Web parity: no order id in the entry query — the centered no-order state. */
@Composable
private fun NoOrderState(openPage: (pageId: String, query: String) -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Inventory,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp),
            )
        }
        Text(
            "No order selected",
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Open one of your orders and choose the tracking action there — this screen tracks a specific order.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        Button(
            onClick = { openPage("my-orders", "") },
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier
                .padding(top = 24.dp)
                .fillMaxWidth()
                .height(48.dp),
        ) {
            Text("Go to My Orders", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * Honest gate for signed-out buyers: no token (or a 401 after the shared
 * authenticator's refresh attempt). No fabricated tracking data.
 */
@Composable
private fun TrackAuthGate(
    openPage: (pageId: String, query: String) -> Unit,
    onRetry: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 64.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50)),
        ) {
            Icon(
                Icons.Outlined.Lock,
                null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp),
            )
        }
        Text(
            "Sign in to track your order",
            fontSize = 16.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            "Your shipments, suppliers and tracking events appear here once you sign in as a buyer.",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 4.dp),
        )
        Button(
            onClick = { openPage("login", "") },
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
        TextButton(onClick = onRetry) {
            Text(
                "Retry",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

/** Amber banner over the cached snapshot — the LiveChatScreen banner style. */
@Composable
private fun OfflineBanner(text: String) {
    val warning = LocalZylodExtra.current.warning
    Surface(
        color = warning.copy(alpha = 0.08f),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp),
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
