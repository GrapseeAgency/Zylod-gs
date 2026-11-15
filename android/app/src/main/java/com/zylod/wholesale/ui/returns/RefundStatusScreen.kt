package com.zylod.wholesale.ui.returns

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
import com.zylod.wholesale.ui.wallet.formatBdt
import com.zylod.wholesale.ui.nav.RouteOwnership.queryParam
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t305 — Refund Status (refund-status-page.tsx port, real wire):
 * GET api/returns/[id] (Task 47/49/60 rail — buyer or admin only). The page
 * renders the REAL return request (returnNumber, status, estimatedRefund,
 * resolutionNote, resolvedAt, createdAt), the real refunds[] ledger rows
 * (money that actually moved), the real receipts[] (seller confirmations of
 * the returned goods) and an honest timeline DERIVED from those real fields —
 * never a fabricated "Bank Processing" step. The web's refund-detail pageId
 * is an alias of this page; both land here (query: refundId|returnId|id).
 */
enum class ReturnPhase { LOADING, NEEDS_AUTH, NOT_FOUND, ERROR, READY }

data class RefundStatusUiState(
    val phase: ReturnPhase = ReturnPhase.LOADING,
    val errorMsg: String? = null,
    val ret: ReturnRequestRow? = null,
)

class RefundStatusViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(RefundStatusUiState())
    val state: StateFlow<RefundStatusUiState> = _state.asStateFlow()

    fun start(query: String) {
        // The web page accepts refundId / returnId / id (refund-status-page.tsx:75).
        val returnId = queryParam(query, "refundId")
            .ifBlank { queryParam(query, "returnId") }
            .ifBlank { queryParam(query, "id") }
        if (returnId.isBlank()) {
            _state.update { it.copy(phase = ReturnPhase.NOT_FOUND) }
            return
        }
        _state.update { it.copy(phase = ReturnPhase.LOADING, errorMsg = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.returnsApi(base).returnById(returnId)
                when {
                    response.code() == 401 || response.code() == 403 -> {
                        _state.update { it.copy(phase = ReturnPhase.NEEDS_AUTH) }
                    }
                    response.code() == 404 -> {
                        _state.update { it.copy(phase = ReturnPhase.NOT_FOUND) }
                    }
                    !response.isSuccessful -> {
                        _state.update {
                            it.copy(phase = ReturnPhase.ERROR, errorMsg = "Could not load this return request (HTTP ${response.code()}).")
                        }
                    }
                    else -> {
                        val data = response.body()?.data
                        if (data == null) {
                            _state.update { it.copy(phase = ReturnPhase.ERROR, errorMsg = "Unexpected response from the returns rail.") }
                        } else {
                            _state.update { it.copy(phase = ReturnPhase.READY, ret = data) }
                        }
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(phase = ReturnPhase.ERROR, errorMsg = "Network error — check your connection and retry.") }
            }
        }
    }
}

/** The honest 4-step timeline — DERIVED from real fields only (web parity). */
private fun derivedSteps(r: ReturnRequestRow): List<Pair<String, Boolean>> = listOf(
    "Request filed" to !r.createdAt.isNullOrBlank(),
    "Reviewed by the supplier" to (r.status in listOf("approved", "rejected", "refunded")),
    "Returned goods received" to r.receipts.isNotEmpty(),
    "Refund processed" to (r.status == "refunded" || r.refunds.any { it.status == "success" }),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RefundStatusScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: RefundStatusViewModel = viewModel(key = "native-refund-status") {
        RefundStatusViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Refund Status", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when (state.phase) {
            ReturnPhase.LOADING -> Wall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the refund status…", fontSize = 12.sp)
            }
            ReturnPhase.NEEDS_AUTH -> Wall(padding) {
                Text("Sign in to view refund status", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Refund requests are visible to the buyer who filed them.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            ReturnPhase.NOT_FOUND -> Wall(padding) {
                Text("Return request not found", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("The link did not carry a valid return reference.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("buyer-orders", "") }) { Text("View My Orders", fontWeight = FontWeight.Bold) }
            }
            ReturnPhase.ERROR -> Wall(padding) {
                Text(state.errorMsg ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            ReturnPhase.READY -> {
                val r = state.ret ?: return@Scaffold
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(r.returnNumber ?: "Return", fontSize = 14.sp, fontWeight = FontWeight.Black, modifier = Modifier.weight(1f))
                                StatusBadge(r.status)
                            }
                            r.orderNumber?.let { Text("Order $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            r.createdAt?.let { Text("Filed ${it.take(19).replace('T', ' ')}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            if (!r.resolutionNote.isNullOrBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text(r.resolutionNote, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            r.estimatedRefund?.takeIf { it > 0.0 }?.let {
                                Spacer(Modifier.height(8.dp))
                                Text("Estimated refund ${formatBdt(it)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                    Surface(
                        color = MaterialTheme.colorScheme.surface,
                        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(Modifier.padding(14.dp)) {
                            Text("PROGRESS", fontSize = 10.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
                            for ((label, done) in derivedSteps(r)) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                        modifier = Modifier.height(10.dp).padding(0.dp),
                                    ) {}
                                    Spacer(Modifier.height(0.dp))
                                    Text(
                                        (if (done) "✓ " else "• ") + label,
                                        fontSize = 12.sp,
                                        fontWeight = if (done) FontWeight.Bold else FontWeight.Normal,
                                        color = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(start = 8.dp),
                                    )
                                }
                            }
                        }
                    }
                    if (r.items.isNotEmpty()) {
                        SectionCard("RETURNED ITEMS") {
                            for (item in r.items) {
                                Text(
                                    "${item.reason ?: "Item"} ×${item.quantity.toString().trimEnd('0').trimEnd('.')}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 4.dp),
                                )
                                item.comments?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    if (r.refunds.isNotEmpty()) {
                        SectionCard("REFUNDS — money that actually moved") {
                            for (f in r.refunds) {
                                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            listOfNotNull(f.method?.replace('_', ' ')?.replaceFirstChar { c -> c.uppercase() }, f.reference).joinToString(" · "),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                        )
                                        Text(
                                            listOfNotNull(f.processedAt?.take(19)?.replace('T', ' '), f.note?.takeIf { it.isNotBlank() }).joinToString(" · "),
                                            fontSize = 10.sp,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Text(formatBdt(f.amount), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                                }
                                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(vertical = 4.dp))
                            }
                        }
                    }
                    if (r.receipts.isNotEmpty()) {
                        SectionCard("GOODS RECEIVED BY SUPPLIERS") {
                            for (rc in r.receipts) {
                                Text(
                                    "${rc.itemsRestored} item${if (rc.itemsRestored == 1) "" else "s"} restored · ${formatBdt(rc.restoredValue)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    listOfNotNull(rc.receivedAt?.take(19)?.replace('T', ' '), rc.note?.takeIf { it.isNotBlank() }).joinToString(" · "),
                                    fontSize = 10.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(bottom = 6.dp),
                                )
                            }
                        }
                    }
                    Text(
                        "Every number here comes from the returns rail — refunds appear only when money actually moved, receipts only when the supplier confirmed the goods.",
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String?) {
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
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(title, fontSize = 10.sp, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
            content()
        }
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
