package com.zylod.wholesale.ui.orderdetail

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.OrderDetailCancelPayload
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t304 — Cancel Order (cancel-order-page.tsx port, real wire):
 * GET api/orders/{orderId} fills the REAL items (never hardcoded rows), and
 * submission POSTs api/orders/{orderId}/cancel with the selected real
 * sub-order ids (the route's contract: no ids = whole order). Honest
 * outcomes: the cancelled counts surface verbatim; a 409 (too late to
 * cancel) renders the server's error, never a fake success.
 */
data class CancelOrderUiState(
    val loading: Boolean = true,
    val hasOrderId: Boolean = false,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val orderNumber: String? = null,
    val orderStatus: String? = null,
    /** (subOrderId, supplier, itemsLine) choices — real rows only. */
    val choices: List<Triple<String, String, String>> = emptyList(),
    val cancellable: Boolean = true,
    val submitting: Boolean = false,
    val submitError: String? = null,
    val cancelledLine: String? = null,
)

class CancelOrderViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(CancelOrderUiState())
    val state: StateFlow<CancelOrderUiState> = _state.asStateFlow()

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
                    _state.update { it.copy(loading = false, error = "Could not load this order (HTTP ${response.code()}).") }
                    return@launch
                }
                val order = response.body()?.data
                if (order == null) {
                    _state.update { it.copy(loading = false, error = "Order not found.") }
                    return@launch
                }
                val choices = order.subOrders.map { sub ->
                    val supplier = sub.supplier?.companyName ?: "Shipment"
                    val items = sub.items.joinToString(", ") { it ->
                        "${it.product?.name ?: "Item"} ×${it.quantity.toString().trimEnd('0').trimEnd('.')}"
                    }
                    Triple(sub.id, supplier, items)
                }
                val status = order.subOrders.mapNotNull { it.status }.distinct()
                    .joinToString(" / ").takeIf { it.isNotBlank() }
                val stillOpen = order.subOrders.any { it.status == "pending" || it.status == "confirmed" || it.status == "processing" }
                _state.update {
                    it.copy(
                        loading = false,
                        orderNumber = order.orderNumber,
                        orderStatus = status,
                        choices = choices,
                        cancellable = stillOpen || order.subOrders.isEmpty(),
                    )
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = "Network error — check your connection and retry.") }
            }
        }
    }

    /** @return null on success, else the verbatim error for the screen. */
    fun submit(orderId: String, subOrderIds: List<String>, onDone: (String?) -> Unit) {
        if (_state.value.submitting) return
        _state.update { it.copy(submitting = true, submitError = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.orderDetailApi(base).cancel(
                    orderId,
                    OrderDetailCancelPayload(subOrderIds = subOrderIds.ifEmpty { null }),
                )
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(submitting = false, needsAuth = true) }
                    onDone("Your session ended — sign in to cancel orders.")
                    return@launch
                }
                if (!response.isSuccessful) {
                    val message = response.body()?.error
                        ?: "Cancelling this order failed (HTTP ${response.code()}) — it may already be beyond the cancellation window."
                    _state.update { it.copy(submitting = false, submitError = message) }
                    onDone(message)
                    return@launch
                }
                val data = response.body()?.data
                val line = data?.let { d ->
                    val parts = mutableListOf<String>()
                    if (d.subOrdersCancelled > 0) parts.add("${d.subOrdersCancelled} shipment${if (d.subOrdersCancelled == 1) "" else "s"} cancelled")
                    if (d.paymentsVoided > 0) parts.add("${d.paymentsVoided} payment${if (d.paymentsVoided == 1) "" else "s"} voided")
                    if (d.remainingActive > 0) parts.add("${d.remainingActive} shipment${if (d.remainingActive == 1) " stays" else "s stay"} active")
                    if (parts.isEmpty()) "Cancellation recorded."
                    else parts.joinToString(" · ")
                } ?: "Cancellation recorded."
                _state.update { it.copy(submitting = false, cancelledLine = line) }
                onDone(null)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(submitting = false, submitError = "Network error — check your connection and retry.") }
                onDone("Network error — check your connection and retry.")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CancelOrderScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: CancelOrderViewModel = viewModel(key = "native-cancel-order") {
        CancelOrderViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(query) { vm.start(query) }

    val orderId = remember(query) { orderIdFromQuery(query) ?: "" }
    var selected by remember { mutableStateOf(setOf<String>()) }
    var reason by remember { mutableStateOf("") }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Cancel Order", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when {
            !state.hasOrderId -> CancelWall(padding) {
                Text("No order selected", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Cancellation is shown per order. Open one of your orders first.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            state.needsAuth -> CancelWall(padding) {
                Text("Sign in to cancel an order", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            state.loading -> CancelWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading your order…", fontSize = 12.sp)
            }
            state.error != null -> CancelWall(padding) {
                Text(state.error ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            state.cancelledLine != null -> CancelWall(padding) {
                Text("Order cancelled", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text(state.cancelledLine ?: "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            else -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(state.orderNumber?.let { "Order $it" } ?: "Order", fontSize = 13.sp, fontWeight = FontWeight.Black)
                        if (state.orderStatus != null) {
                            Text("Status: ${state.orderStatus}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                if (!state.cancellable) {
                    Text(
                        "This order has already shipped — self-service cancellation is closed. Raise a return or a complaint instead.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.error,
                    )
                } else {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text("What should be cancelled?", fontSize = 11.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.height(8.dp))
                            for ((id, supplier, items) in state.choices) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                    RadioButton(
                                        selected = id in selected,
                                        onClick = {
                                            selected = if (id in selected) selected - id else selected + id
                                        },
                                    )
                                    Column(Modifier.padding(start = 6.dp)) {
                                        Text(supplier, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                        Text(items, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Reason (optional)") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (state.submitError != null) {
                        Text(state.submitError ?: "", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                    }
                    Button(
                        onClick = {
                            vm.submit(orderId, selected.toList()) { }
                        },
                        enabled = !state.submitting && selected.isNotEmpty(),
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (state.submitting) {
                            CircularProgressIndicator(Modifier.height(16.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onError)
                            Text("  Cancelling…", fontSize = 12.sp)
                        } else {
                            Text("Cancel selected shipments", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Text(
                    "Cancellations are instant only while the order is still with the supplier. Once shipped, use Track Order or raise a return from the order.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun CancelWall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
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
