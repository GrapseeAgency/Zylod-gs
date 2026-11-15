package com.zylod.wholesale.ui.orderdetail

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.OrderDetailTracking
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t304 — Order Timeline (order-timeline-page.tsx port, real wire):
 * GET api/orders/{orderId} — the SAME order the typed OrderDetailScreen
 * loads, rendered as the tracking TIMELINE: the real orderTracking rows
 * (seller transitions + driver-GPS milestones) newest-first, per sub-order,
 * with honest no-timeline and no-order walls (never fabricated events).
 */
data class OrderTimelineUiState(
    val loading: Boolean = true,
    val hasOrderId: Boolean = false,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val orderNumber: String? = null,
    /** (supplierName, rows) per sub-order — real orderTracking rows only. */
    val groups: List<Pair<String, List<OrderDetailTracking>>> = emptyList(),
)

class OrderTimelineViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(OrderTimelineUiState())
    val state: StateFlow<OrderTimelineUiState> = _state.asStateFlow()

    fun start(query: String) {
        val orderId = orderIdFromQuery(query)
        if (orderId == null) {
            _state.update { it.copy(loading = false, hasOrderId = false) }
            return
        }
        _state.update { it.copy(loading = true, hasOrderId = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.orderDetailApi(base).order(orderId)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, error = "Could not load this order's timeline (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val order = response.body()?.data
                if (order == null) {
                    _state.update { it.copy(loading = false, error = "Order not found.") }
                    return@launch
                }
                val groups = order.subOrders.map { sub ->
                    val supplier = sub.supplier?.companyName ?: "Shipment"
                    supplier to sub.tracking.sortedByDescending { it.trackedAt.orEmpty() }
                }
                _state.update {
                    it.copy(
                        loading = false,
                        orderNumber = order.orderNumber,
                        groups = groups,
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error — check your connection and retry.") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTimelineScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: OrderTimelineViewModel = viewModel(key = "native-order-timeline") {
        OrderTimelineViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Order Timeline", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when {
            !state.hasOrderId -> TimelineWall(padding) {
                Text("No order selected", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Timelines are shown per order. Open one of your orders first.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            state.needsAuth -> TimelineWall(padding) {
                Text("Sign in to view this order's timeline", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Timelines belong to the signed-in buyer's orders.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            state.loading -> TimelineWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the order timeline…", fontSize = 12.sp)
            }
            state.error != null -> TimelineWall(padding) {
                Text(state.error ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    state.orderNumber?.let { "Order $it" } ?: "Order",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                )
                if (state.groups.isEmpty() || state.groups.all { it.second.isEmpty() }) {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            "No tracking events yet — milestones appear here the moment the supplier confirms, packs or ships.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
                for ((supplier, rows) in state.groups) {
                    if (rows.isEmpty()) continue
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text(supplier, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(bottom = 10.dp))
                            for (row in rows) {
                                TimelineRow(row)
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(vertical = 6.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TimelineRow(row: OrderDetailTracking) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
            modifier = Modifier.size(10.dp),
        ) {}
        Spacer(Modifier.width(10.dp))
        Column {
            Text(
                (row.status ?: "update").replace('_', ' ').replaceFirstChar { it.uppercase() },
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
            )
            if (!row.location.isNullOrBlank()) {
                Text(row.location, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                listOfNotNull(row.trackedAt?.take(19)?.replace('T', ' '), row.note?.takeIf { it.isNotBlank() }).joinToString(" · "),
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun TimelineWall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
    Box(
        Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) { content() }
    }
}
