package com.zylod.wholesale.ui.notifications

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
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.zylod.wholesale.data.api.MarkReadResponse
import com.zylod.wholesale.data.api.NativeNotificationDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ui.nav.RouteOwnership.queryParam
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path

/**
 * t306 — Notification Detail (notification-detail-page.tsx port, real wire):
 * GET api/notifications/[id] auto-marks the row read on open (the route's
 * own contract) and DELETE api/notifications/[id] removes it then pops back —
 * exactly the web page's two actions. The detail row carries the real
 * relatedId, so "View order/product/ticket" opens the REAL target through
 * RouteOwnership (the same targetFor contract the feed's taps use).
 */
@Serializable
data class NotificationDetailEnvelope(
    val success: Boolean = false,
    val data: NativeNotificationDto? = null,
    val error: String? = null,
)

/** GET/DELETE api/notifications/{id} — the detail rail (t306). */
interface NotificationDetailApi {
    @GET("api/notifications/{id}")
    suspend fun detail(@Path("id") id: String): Response<NotificationDetailEnvelope>

    @DELETE("api/notifications/{id}")
    suspend fun delete(@Path("id") id: String): Response<MarkReadResponse>
}

enum class NotificationDetailPhase { LOADING, NEEDS_AUTH, NOT_FOUND, ERROR, READY }

data class NotificationDetailUiState(
    val phase: NotificationDetailPhase = NotificationDetailPhase.LOADING,
    val errorMsg: String? = null,
    val notification: NativeNotificationDto? = null,
    val deleting: Boolean = false,
)

class NotificationDetailViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(NotificationDetailUiState())
    val state: StateFlow<NotificationDetailUiState> = _state.asStateFlow()

    fun start(query: String) {
        val id = queryParam(query, "id").ifBlank { queryParam(query, "notificationId") }
        if (id.isBlank()) {
            _state.update { it.copy(phase = NotificationDetailPhase.NOT_FOUND) }
            return
        }
        _state.update { it.copy(phase = NotificationDetailPhase.LOADING, errorMsg = null) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val api = ApiClient.retrofit(base).create(NotificationDetailApi::class.java)
                val response = api.detail(id)
                when {
                    response.code() == 401 || response.code() == 403 -> {
                        _state.update { it.copy(phase = NotificationDetailPhase.NEEDS_AUTH) }
                    }
                    response.code() == 404 -> {
                        _state.update { it.copy(phase = NotificationDetailPhase.NOT_FOUND) }
                    }
                    !response.isSuccessful -> {
                        _state.update {
                            it.copy(phase = NotificationDetailPhase.ERROR, errorMsg = "Could not load this notification (HTTP ${response.code()}).")
                        }
                    }
                    else -> {
                        val data = response.body()?.data
                        if (data == null) {
                            _state.update { it.copy(phase = NotificationDetailPhase.NOT_FOUND) }
                        } else {
                            _state.update { it.copy(phase = NotificationDetailPhase.READY, notification = data) }
                        }
                    }
                }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(phase = NotificationDetailPhase.ERROR, errorMsg = "Network error — check your connection and retry.") }
            }
        }
    }

    fun delete(id: String, onDeleted: () -> Unit) {
        if (_state.value.deleting) return
        _state.update { it.copy(deleting = true) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val api = ApiClient.retrofit(base).create(NotificationDetailApi::class.java)
                api.delete(id)
                _state.update { it.copy(deleting = false) }
                onDeleted()
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                _state.update { it.copy(deleting = false) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationDetailScreen(
    onBack: (() -> Unit)?,
    openPage: (pageId: String, query: String) -> Unit,
    query: String,
) {
    val context = LocalContext.current
    val vm: NotificationDetailViewModel = viewModel(key = "native-notification-detail") {
        NotificationDetailViewModel(context.applicationContext)
    }
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(query) { vm.start(query) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Notification", fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.primary) },
                navigationIcon = {
                    if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
                },
                actions = {
                    if (state.phase == NotificationDetailPhase.READY) {
                        IconButton(onClick = {
                            vm.delete(state.notification?.id ?: "") { onBack?.invoke() }
                        }) { Icon(Icons.Outlined.Delete, contentDescription = "Delete notification") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        when (state.phase) {
            NotificationDetailPhase.LOADING -> Wall(padding) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading the notification…", fontSize = 12.sp)
            }
            NotificationDetailPhase.NEEDS_AUTH -> Wall(padding) {
                Text("Sign in to view notifications", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("Notifications belong to the signed-in account.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("login", "") }) { Text("Sign in", fontWeight = FontWeight.Bold) }
            }
            NotificationDetailPhase.NOT_FOUND -> Wall(padding) {
                Text("Notification not found", fontSize = 14.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(6.dp))
                Text("It may have been deleted or belongs to another account.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(onClick = { openPage("notifications", "") }) { Text("Back to notifications", fontWeight = FontWeight.Bold) }
            }
            NotificationDetailPhase.ERROR -> Wall(padding) {
                Text(state.errorMsg ?: "", fontSize = 13.sp, color = MaterialTheme.colorScheme.error)
                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { vm.start(query) }) { Text("Retry", fontWeight = FontWeight.Bold) }
            }
            NotificationDetailPhase.READY -> {
                val n = state.notification ?: return@Scaffold
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
                        Column(Modifier.padding(16.dp)) {
                            n.type?.let {
                                Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)) {
                                    Text(
                                        it.replace('_', ' ').replaceFirstChar { c -> c.uppercase() },
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.primary,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    )
                                }
                                Spacer(Modifier.height(8.dp))
                            }
                            Text(n.title ?: "Notification", fontSize = 14.sp, fontWeight = FontWeight.Black)
                            Spacer(Modifier.height(6.dp))
                            Text(
                                n.message ?: "",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            n.timestamp?.let {
                                Spacer(Modifier.height(8.dp))
                                Text(it.take(19).replace('T', ' '), fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    // The real target — the same targetFor contract the feed uses.
                    val (targetPage, targetQuery) = when {
                        n.relatedShipmentId != null -> "track-order" to "orderId=${n.relatedShipmentId}"
                        n.relatedPaymentId != null -> "order-detail" to "orderId=${n.relatedPaymentId}"
                        n.relatedId != null -> when (n.type) {
                            "order" -> "order-detail" to "orderId=${n.relatedId}"
                            "product" -> "product-detail" to "productId=${n.relatedId}"
                            "ticket" -> "ticket-detail" to "ticketId=${n.relatedId}"
                            "rfq" -> "rfq-list" to ""
                            else -> "" to ""
                        }
                        else -> "" to ""
                    }
                    if (targetPage.isNotBlank()) {
                        Button(
                            onClick = { openPage(targetPage, targetQuery) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("View ${targetPage.replace('-', ' ')}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedButton(
                            onClick = {
                                vm.delete(n.id) { onBack?.invoke() }
                            },
                            enabled = !state.deleting,
                            modifier = Modifier.weight(1f),
                        ) {
                            if (state.deleting) {
                                CircularProgressIndicator(Modifier.height(16.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Delete", fontWeight = FontWeight.Bold)
                            }
                        }
                        OutlinedButton(
                            onClick = { openPage("notifications", "") },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("All notifications", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
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
