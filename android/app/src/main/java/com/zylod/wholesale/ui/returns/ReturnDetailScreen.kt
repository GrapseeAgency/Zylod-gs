package com.zylod.wholesale.ui.returns

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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.zylod.wholesale.data.api.ReturnRequestRow
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.nav.RouteOwnership.queryParam
import com.zylod.wholesale.ui.wallet.formatBdt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t305 — Return Details (return-detail-page.tsx port, real wire):
 * GET api/returns?orderId=<orderId> — the order's REAL return requests with
 * their items/reasons; an optional returnId/returnNumber query narrows to
 * one (the web page's filter). Honest states: no order reference (the page
 * is per-order), no returns yet, 401 gate, 404 walls — never invented rows.
 */
enum class ReturnDetailPhase { LOADING, NEEDS_AUTH, NO_ORDER, EMPTY, ERROR, READY }

data class ReturnDetailUiState(
    val phase: ReturnDetailPhase = ReturnDetailPhase.LOADING,
    val errorMsg: String? = null,
    val orderId: String? = null,
    val returns: List<ReturnRequestRow> = emptyList(),
)

class ReturnDetailViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(ReturnDetailUiState())
    val state: StateFlow<ReturnDetailUiState> = _state.asStateFlow()

    fun start(query: String) {
        val orderId = queryParam(query, "orderId").ifBlank { queryParam(query, "id") }
        if (orderId.isBlank()) {
            _state.update { it.copy(phase = ReturnDetailPhase.NO_ORDER) }
            return
        }
        val returnId = queryParam(query, "returnId")
        _state.update { it.copy(phase = ReturnDetailPhase.LOADING, errorMsg = null, orderId = orderId) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.returnsApi(base).returnsByOrder(orderId)
                when {
                    response.code() == 401 || response.code() == 403 -> {
                        _state.update { it.copy(phase = ReturnDetailPhase.NEEDS_AUTH) }
                    }
                    response.code() == 404 -> {
                        _state.update { it.copy(phase = ReturnDetailPhase.EMPTY) }
                    }
                    !response.isSuccessful -> {
                        _state.update {
                            it.copy(phase = ReturnDetailPhase.ERROR, errorMsg = "Failed to load returns (HTTP ${response.code()}).")
                        }
                    }
                    else -> {
                        val list = response.body()?.data.orEmpty()
                        val filtered = if (returnId.isBlank()) list else list.filter { it.id == returnId || it.returnNumber == returnId }
                        _state.update {
                            if (filtered.isEmpty()) it.copy(phase = ReturnDetailPhase.EMPTY)
                            else it.copy(phase = ReturnDetailPhase.READY, returns = filtered)
                        }
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(phase = ReturnDetailPhase.ERROR, errorMsg = "Network error while loading the return") }
            }
        }
    }
}

// Loading flag lives on the state to keep the screen's when() single-source.
private val ReturnDetailUiState.loading: Boolean get() = phase == ReturnDetailPhase.LOADING

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReturnDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: ReturnDetailViewModel = viewModel(key = "native-return-detail") {
        ReturnDetailViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Return Details", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when (state.phase) {
            ReturnDetailPhase.LOADING -> Wall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the return…", fontSize = 12.sp)
            }
            ReturnDetailPhase.NEEDS_AUTH -> Wall(padding) {
                Text("Sign in to view return details", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Returns are visible to the buyer who filed them.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            ReturnDetailPhase.NO_ORDER -> Wall(padding) {
                Text("No return selected", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Return details are shown per order. Submit a return request from one of your orders first.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            ReturnDetailPhase.EMPTY -> Wall(padding) {
                Text("No returns on this order", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("When you file a return request from the order, its details render here.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            ReturnDetailPhase.ERROR -> Wall(padding) {
                Text(state.errorMsg ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            ReturnDetailPhase.READY -> Column(
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                state.orderId?.let {
                    Text(
                        "Order #${it.takeLast(8).uppercase()}",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                for (ret in state.returns) {
                    ReturnCard(ret, openPage)
                }
            }
        }
    }
}

@Composable
private fun ReturnCard(ret: ReturnRequestRow, openPage: (pageId: String, query: String) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shape = RoundedCornerShape(16.dp),
        onClick = { openPage("refund-status", "refundId=${ret.id}") },
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(ret.returnNumber ?: "Return request", fontSize = 13.sp, fontWeight = FontWeight.Black)
                    ret.createdAt?.let {
                        Text("Filed ${it.take(19).replace('T', ' ')}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                ReturnStatusBadge(ret.status)
            }
            Spacer(Modifier.height(8.dp))
            for (item in ret.items) {
                Text(
                    "${item.reason ?: "Item"} ×${item.quantity.toString().trimEnd('0').trimEnd('.')}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 2.dp),
                )
                item.comments?.takeIf { it.isNotBlank() }?.let {
                    Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            ret.estimatedRefund?.takeIf { it > 0.0 }?.let {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(vertical = 8.dp))
                Text("Estimated refund ${formatBdt(it)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            }
            if (ret.refunds.isNotEmpty()) {
                Text(
                    "Refunded ${formatBdt(ret.refunds.filter { it.status == "success" }.sumOf { it.amount })}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun ReturnStatusBadge(status: String?) {
    val (label, container, content) = when (status) {
        "pending" -> Triple("Pending review", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
        "approved" -> Triple("Approved", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
        "rejected" -> Triple("Rejected", MaterialTheme.colorScheme.errorContainer, MaterialTheme.colorScheme.onErrorContainer)
        "refunded" -> Triple("Refunded", MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
        else -> Triple(status?.replace('_', ' ')?.replaceFirstChar { c -> c.uppercase() } ?: "Unknown", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
    }
    Surface(shape = RoundedCornerShape(10.dp), color = container) {
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = content, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

@Composable
private fun Wall(padding: androidx.compose.foundation.layout.PaddingValues, content: @Composable () -> Unit) {
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
