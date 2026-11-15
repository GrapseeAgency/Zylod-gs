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
import androidx.compose.runtime.LaunchedEffect
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
import com.zylod.wholesale.data.api.OrderDetailReceipt
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.logistics.orderIdFromQuery
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t304 — Order Receipt (order-receipt-page.tsx port, real wire):
 * GET api/orders/{orderId}/receipt — the purpose-built money-moved snapshot
 * (Task 128-c): real items, subtotal/shipping/tax/total, payment method +
 * status and the shipping address. No hardcoded rows, no fabricated totals.
 */
data class OrderReceiptUiState(
    val loading: Boolean = true,
    val hasOrderId: Boolean = false,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val receipt: OrderDetailReceipt? = null,
)

class OrderReceiptViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(OrderReceiptUiState())
    val state: StateFlow<OrderReceiptUiState> = _state.asStateFlow()

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
                val response = ApiClient.orderDetailApi(base).receipt(orderId)
                if (response.code() == 401 || response.code() == 403) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                if (!response.isSuccessful) {
                    _state.update {
                        it.copy(loading = false, error = "Could not load this order's receipt (HTTP ${response.code()}).")
                    }
                    return@launch
                }
                val data = response.body()?.takeIf { it.success }?.data
                if (data == null) {
                    _state.update { it.copy(loading = false, error = "No receipt is available for this order yet.") }
                    return@launch
                }
                _state.update { it.copy(loading = false, receipt = data) }
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
fun OrderReceiptScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: OrderReceiptViewModel = viewModel(key = "native-order-receipt") {
        OrderReceiptViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Order Receipt", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when {
            !state.hasOrderId -> ReceiptWall(padding) {
                Text("No order selected", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Receipts are shown per order. Open one of your orders first.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            state.needsAuth -> ReceiptWall(padding) {
                Text("Sign in to view this receipt", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            state.loading -> ReceiptWall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the receipt…", fontSize = 12.sp)
            }
            state.error != null -> ReceiptWall(padding) {
                Text(state.error ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            else -> {
                val r = state.receipt ?: return@Scaffold
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Column {
                        Text("Zylod", fontSize = 18.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                        Text(r.orderNumber?.let { "Receipt — Order $it" } ?: "Receipt", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        r.orderDate?.let { Text(it.take(19).replace('T', ' '), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    ReceiptSection("Items") {
                        for (item in r.items) {
                            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(item.productName ?: "Item", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    val qty = item.quantity.toString().trimEnd('0').trimEnd('.')
                                    Text(
                                        listOfNotNull("×$qty", item.sku?.takeIf { it.isNotBlank() }).joinToString(" · "),
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                Text(formatBdt(item.total), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    ReceiptSection("Payment") {
                        Text(r.paymentMethod?.replace('_', ' ')?.replaceFirstChar { it.uppercase() } ?: "—", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "Status: ${r.paymentStatus?.replace('_', ' ') ?: "—"}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    val addr = r.shippingAddress
                    if (addr != null) {
                        ReceiptSection("Shipping Address") {
                            Text(
                                listOfNotNull(addr.address, addr.city, addr.district, addr.country).joinToString(", "),
                                fontSize = 12.sp,
                            )
                            r.buyer?.businessName?.takeIf { it.isNotBlank() }?.let {
                                Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    ReceiptSection("Totals") {
                        ReceiptLine("Subtotal", formatBdt(r.subtotal))
                        ReceiptLine("Shipping", formatBdt(r.shipping))
                        if (r.tax > 0.0) ReceiptLine("Tax", formatBdt(r.tax))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(vertical = 6.dp))
                        Row(Modifier.fillMaxWidth()) {
                            Text("Total", fontSize = 13.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                            Text(formatBdt(r.total), fontSize = 13.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary)
                        }
                    }
                    Text(
                        "This receipt is generated from the real payments rows of the order — amounts move only when the seller verifies the payment.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ReceiptSection(title: String, content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
            content()
        }
    }
}

@Composable
private fun ReceiptLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(label, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ReceiptWall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
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
