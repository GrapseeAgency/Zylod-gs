package com.zylod.wholesale.ui.notifications

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.Pagination
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Query

/**
 * t233 — native Notifications (SPA pageIds "notifications" (the web rail's
 * pageId), "notifications-page" and "notification-center" all land here).
 * t278 — the feed grew up to the web page's full contract:
 *
 * Wire contract (src/app/api/notifications/route.ts): GET api/notifications
 * — AUTHENTICATED — returns
 *   { success, data: [{id,type,title,message,timestamp,isRead,
 *     relatedId,relatedShipmentId,relatedPaymentId,…}],
 *     unreadCount, pagination { page, limit, total, totalPages } }
 * plus `types` (order|payment|promotion|system|chat|review|delivery) and
 * `unreadOnly` filters, which the in-screen filter chips drive.
 *
 *  - PAGINATION: page/limit=20 with keyed-dedup append (RfqListViewModel
 *    loadMore convention) — the old client fetched page 1 forever and
 *    silently dropped the pagination block, so a user with >20
 *    notifications could never see the older ones.
 *  - MARK-READ (web notifications-page.tsx:191-207 parity): a row tap
 *    fire-and-forgets PATCH {id} with the OPTIMISTIC isRead flip +
 *    unreadCount decrement; "Mark all read" does PATCH {markAll:true}.
 *    The web never reverts on a failed PATCH (read-state is best-effort,
 *    navigation must never block) — same here.
 *  - DEEP LINKS (web targetFor :156-189 parity): a notification carrying a
 *    real relatedId opens its TARGET (order / product / delivery / ticket)
 *    instead of the generic detail card — see [openTarget].
 */
@Serializable
data class NativeNotificationDto(
    val id: String,
    val type: String? = null,
    val title: String? = null,
    val message: String? = null,
    val timestamp: String? = null,
    val isRead: Boolean = false,
    val relatedId: String? = null,
    val relatedShipmentId: String? = null,
    val relatedPaymentId: String? = null,
)

@Serializable
data class NotificationsEnvelope(
    val success: Boolean = false,
    val data: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val pagination: Pagination? = null,
    val error: String? = null,
)

/** PATCH api/notifications body — { id } | { markAll: true }. */
@Serializable
data class MarkReadBody(
    val id: String? = null,
    val markAll: Boolean? = null,
)

@Serializable
data class MarkReadResponse(
    val success: Boolean = false,
    val error: String? = null,
)

interface NotificationsApi {
    @GET("api/notifications")
    suspend fun notifications(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("unreadOnly") unreadOnly: Boolean = false,
        @Query("types") types: String? = null,
    ): Response<NotificationsEnvelope>

    @PATCH("api/notifications")
    suspend fun markRead(@Body body: MarkReadBody): Response<MarkReadResponse>
}

data class NotificationsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val notifications: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val unreadOnly: Boolean = false,
    /** Server pagination — drives the Load-more affordance + honest meta line. */
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
    val loadingMore: Boolean = false,
    val offline: Boolean = false,
    val error: String? = null,
) {
    val canLoadMore: Boolean get() = page < totalPages && !loadingMore
}

@Serializable
private data class NotificationsSnapshot(
    val notifications: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val page: Int = 1,
    val totalPages: Int = 1,
    val total: Int = 0,
)

class NotificationsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    private var api: NotificationsApi? = null
    private var fetchJob: Job? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = NotificationsUiState(loading = false, needsAuth = true)
            return
        }
        fetchJob?.cancel()
        val hasData = _state.value.notifications.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        fetchJob = viewModelScope.launch { fetch(page = 1, replace = true) }
    }

    fun toggleUnreadOnly() {
        _state.update { it.copy(unreadOnly = !it.unreadOnly) }
        fetchJob?.cancel()
        viewModelScope.launch { fetch(page = 1, replace = true) }
    }

    /** Append the next page (keyed dedup — server-side createdAt ordering can reshuffle rows). */
    fun loadMore() {
        val s = _state.value
        if (s.loading || s.loadingMore || s.needsAuth || s.offline) return
        if (s.page >= s.totalPages) return
        _state.update { it.copy(loadingMore = true) }
        fetchJob = viewModelScope.launch { fetch(page = s.page + 1, replace = false) }
    }

    /**
     * Row tap — web openNotification parity: optimistic read flip +
     * unreadCount decrement, fire-and-forget PATCH {id} (a failed PATCH
     * never blocks navigation and never reverts — the server row heals on
     * the next feed pull).
     */
    fun markRead(id: String) {
        val current = _state.value.notifications.firstOrNull { it.id == id } ?: return
        if (current.isRead) return
        _state.update { s ->
            s.copy(
                notifications = s.notifications.map { if (it.id == id) it.copy(isRead = true) else it },
                unreadCount = (s.unreadCount - 1).coerceAtLeast(0),
            )
        }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.retrofit(baseUrl).create(NotificationsApi::class.java).also { api = it }
                client.markRead(MarkReadBody(id = id))
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "mark-read failed (best-effort): ${e.message}")
            }
        }
    }

    /** "Mark all read" — PATCH {markAll:true}, optimistic all-flip (web parity). */
    fun markAllRead() {
        if (_state.value.unreadCount <= 0) return
        _state.update { s ->
            s.copy(
                notifications = s.notifications.map { it.copy(isRead = true) },
                unreadCount = 0,
            )
        }
        viewModelScope.launch {
            try {
                val baseUrl = ServerConfig.resolve(appContext)
                val client = api ?: ApiClient.retrofit(baseUrl).create(NotificationsApi::class.java).also { api = it }
                client.markRead(MarkReadBody(markAll = true))
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "mark-all-read failed (best-effort): ${e.message}")
            }
        }
    }

    /**
     * Deep-link target for a row tap (web notifications-page.tsx targetFor
     * :156-189 parity): a notification that carries a real relatedId opens
     * its TARGET directly (order / product / shipment / ticket) instead of
     * the generic detail card.
     */
    fun openTarget(n: NativeNotificationDto): Pair<String, String> {
        val relatedId = n.relatedId?.takeIf(String::isNotBlank)
        if (relatedId == null) return "notification-detail" to "notificationId=${n.id}"
        return when (n.type?.trim()?.lowercase()) {
            // Task 68-c: a payment notification carrying the exact payments
            // row lands on the order view (the native OrderDetail has no
            // payment-chip highlight yet — the id travels anyway).
            "order", "payment" -> "order-detail" to "orderId=$relatedId"
            // Task 66: a per-shipment delivery notification lands on the
            // ORDER view where that shipment's tracking lives; the generic
            // delivery hub stays the fallback for legacy rows.
            "delivery" -> if (n.relatedShipmentId != null) {
                "order-detail" to "orderId=$relatedId"
            } else {
                "delivery-updates" to ""
            }
            "price_drop", "back_in_stock", "promotion" -> "product-detail" to "productId=$relatedId"
            // The messages route sends type 'chat' with relatedEntityId = the
            // CONVERSATION id (verified live) — the native chat-detail reads
            // conversationId= directly, so the tap lands on the real thread.
            // (The web's targetFor has no 'chat' case and falls to its generic
            // detail card — this is a deliberate native improvement.)
            "chat" -> "chat-detail" to "conversationId=$relatedId"
            // Task 75/76: a support reply carries the thread id — land on the
            // filer's OWN registry (buyers open the buyer ticket thread,
            // sellers the seller thread).
            "system" -> if (isSupplier()) "seller-ticket-detail" to "id=$relatedId"
            else "ticket-detail" to "id=$relatedId"
            else -> "notification-detail" to "notificationId=${n.id}"
        }
    }

    private fun isSupplier(): Boolean = SessionManager.userJson()?.let { raw ->
        runCatching {
            ApiClient.json.decodeFromString(
                com.zylod.wholesale.data.api.UserProfileSeed.serializer(),
                raw,
            )
        }.getOrNull()?.userType?.equals("supplier", ignoreCase = true) == true
    } ?: false

    private suspend fun fetch(page: Int, replace: Boolean) {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.retrofit(baseUrl).create(NotificationsApi::class.java).also { api = it }
            val response = client.notifications(page = page, unreadOnly = _state.value.unreadOnly)
            if (response.code() == 401) {
                // Session died between tabs — the honest state, not an error.
                _state.value = NotificationsUiState(loading = false, needsAuth = true)
                return
            }
            val envelope = response.body()
            val rows = envelope?.takeIf { it.success }?.data.orEmpty()
            if (envelope == null || (!envelope.success && rows.isEmpty())) {
                degrade("Server error — notifications are temporarily unavailable.")
                return
            }
            val merged = if (replace) rows else {
                val seen = _state.value.notifications.mapTo(HashSet()) { it.id }
                _state.value.notifications + rows.filter { seen.add(it.id) }
            }
            _state.value = NotificationsUiState(
                loading = false,
                notifications = merged,
                unreadCount = envelope.unreadCount,
                unreadOnly = _state.value.unreadOnly,
                page = envelope.pagination?.page ?: page,
                totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
                total = envelope.pagination?.total ?: merged.size,
                loadingMore = false,
                offline = false,
            )
            withContext(Dispatchers.IO) {
                runCatching {
                    val snapshot = NotificationsSnapshot(
                        notifications = merged,
                        unreadCount = envelope.unreadCount,
                        page = envelope.pagination?.page ?: page,
                        totalPages = envelope.pagination?.totalPages?.takeIf { it > 0 } ?: 1,
                        total = envelope.pagination?.total ?: merged.size,
                    )
                    val raw = ApiClient.json.encodeToString(NotificationsSnapshot.serializer(), snapshot)
                    appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
                }.onFailure { Log.w(TAG, "notifications cache write failed: ${it.message}") }
            }
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "notifications refresh failed: ${e.message}")
            degrade("Network error — check your connection and retry.")
        }
    }

    private suspend fun degrade(message: String) {
        val inMemory = _state.value.notifications
        if (inMemory.isNotEmpty()) {
            _state.update { it.copy(loading = false, loadingMore = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.notifications.isNotEmpty()) {
            _state.value = NotificationsUiState(
                loading = false,
                notifications = saved.notifications,
                unreadCount = saved.unreadCount,
                unreadOnly = _state.value.unreadOnly,
                page = saved.page,
                totalPages = saved.totalPages,
                total = saved.total,
                offline = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, loadingMore = false, error = message)
        }
    }

    private fun readSnapshot(): NotificationsSnapshot? = runCatching {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
            ?: return null
        ApiClient.json.decodeFromString(NotificationsSnapshot.serializer(), raw)
    }.onFailure { Log.w(TAG, "notifications cache read failed: ${it.message}") }.getOrNull()

    private companion object {
        const val TAG = "ZylodNotifications"
        const val PREFS = "zylod_config"
        const val KEY = "native_notifications_cache"
    }
}
