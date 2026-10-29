package com.zylod.wholesale.ui.notifications

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * t233 — native Notifications (SPA pageIds "notifications" (the web rail's
 * pageId), "notifications-page" and "notification-center" all land here).
 *
 * Wire contract (src/app/api/notifications/route.ts): GET api/notifications
 * — AUTHENTICATED — returns
 *   { success, data: [{id,type,title,message,timestamp,isRead,…}],
 *     unreadCount, pagination { page, limit, total, totalPages } }
 * plus `types` (order|payment|promotion|system|chat|review|delivery) and
 * `unreadOnly` filters, which the in-screen filter chips drive.
 */
@Serializable
data class NativeNotificationDto(
    val id: String,
    val type: String? = null,
    val title: String? = null,
    val message: String? = null,
    val timestamp: String? = null,
    val isRead: Boolean = false,
)

@Serializable
data class NotificationsEnvelope(
    val success: Boolean = false,
    val data: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
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
}

data class NotificationsUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val notifications: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
    val unreadOnly: Boolean = false,
    val offline: Boolean = false,
    val error: String? = null,
)

@Serializable
private data class NotificationsSnapshot(
    val notifications: List<NativeNotificationDto> = emptyList(),
    val unreadCount: Int = 0,
)

class NotificationsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    private var api: NotificationsApi? = null

    /** Entry pull / retry (t208 parity: called on EVERY entry). */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = NotificationsUiState(loading = false, needsAuth = true)
            return
        }
        val hasData = _state.value.notifications.isNotEmpty()
        _state.update { it.copy(loading = !hasData, error = null, needsAuth = false) }
        viewModelScope.launch { fetch() }
    }

    fun toggleUnreadOnly() {
        _state.update { it.copy(unreadOnly = !it.unreadOnly) }
        viewModelScope.launch { fetch() }
    }

    private suspend fun fetch() {
        try {
            val baseUrl = ServerConfig.resolve(appContext)
            val client = api ?: ApiClient.retrofit(baseUrl).create(NotificationsApi::class.java).also { api = it }
            val response = client.notifications(unreadOnly = _state.value.unreadOnly)
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
            _state.value = NotificationsUiState(
                loading = false,
                notifications = rows,
                unreadCount = envelope.unreadCount,
                unreadOnly = _state.value.unreadOnly,
                offline = false,
            )
            withContext(Dispatchers.IO) {
                runCatching {
                    val snapshot = NotificationsSnapshot(rows, envelope.unreadCount)
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
            _state.update { it.copy(loading = false, offline = true, error = null) }
            return
        }
        val saved = withContext(Dispatchers.IO) { readSnapshot() }
        if (saved != null && saved.notifications.isNotEmpty()) {
            _state.value = NotificationsUiState(
                loading = false,
                notifications = saved.notifications,
                unreadCount = saved.unreadCount,
                unreadOnly = _state.value.unreadOnly,
                offline = true,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
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
