package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CreateSupportTicketRequest
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.SupportTicketDto
import com.zylod.wholesale.data.api.SupportTicketsEnvelope
import com.zylod.wholesale.data.api.parseErrorBody
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Native Support Center VM — GET/POST api/support/tickets
 * (src/app/api/support/tickets/route.ts; ownership row: the pageId
 * "support-center" renders natively through SupportCenterScreen).
 *
 *  - AUTH (OrdersViewModel convention): no token → no call at all, the
 *    screen shows its soft sign-in CTA; a 401 after the shared OkHttp
 *    refresh-retry means a real end of session → needsAuth.
 *  - OFFLINE (DealsViewModel degrade convention): on failure renderable
 *    data survives — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_support_cache", written
 *    after EVERY successful list fetch as the wire envelope JSON) — and
 *    the state flips to `offline` so the screen shows its saved-tickets
 *    banner. With nothing renderable at all: the honest first-launch
 *    offline state (error != null), never a blank screen.
 *  - CREATE: createTicket() posts the real endpoint with the route's exact
 *    body contract (category/subject/description — subject ≥ 5 chars,
 *    description ≥ 20 chars, mirrored client-side). The submitting flag
 *    drives the inline form's progress state; the SERVER-CONFIRMED 201 row
 *    is prepended (never a fabricated optimistic row), errors surface the
 *    server's own `{ error }` string.
 */
data class SupportCenterUiState(
    val loading: Boolean = true,
    val tickets: List<SupportTicket> = emptyList(),
    /** The visible rows are SAVED data (in-memory or disk cache), not a live fetch. */
    val offline: Boolean = false,
    /** No token / session ended — the screen shows its sign-in CTA. */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved tickets). */
    val error: String? = null,
    // ── "Open a Ticket" form ──
    val submitting: Boolean = false,
    /** Server/validation error of the LAST create attempt — surfaced inline. */
    val submitError: String? = null,
    /** id of the last SERVER-confirmed ticket — drives the success banner. */
    val lastCreatedId: String? = null,
)

class SupportCenterViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(SupportCenterUiState())
    val state: StateFlow<SupportCenterUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    /** Last list payload on the wire — kept so a create can update the cache. */
    private var lastDtos: List<SupportTicketDto> = emptyList()

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to the
        // sign-in state instead of a stale list (OrdersViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry pull / retry (t208 parity: called on EVERY entry). A refresh
     * already in flight WITH data on screen is a no-op (t216 silent-refresh
     * convention: never blank visible data behind a spinner — the fetch
     * replaces it in place). A fresh entry clears the stale "just submitted"
     * banner; the ticket itself stays in the list.
     */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = _state.value.copy(loading = false, needsAuth = true, error = null)
            return
        }
        val s = _state.value
        val hasData = s.tickets.isNotEmpty()
        if (s.loading && hasData) return // a refresh already in flight with data on screen
        _state.value = s.copy(
            loading = !hasData,
            offline = false,
            error = null,
            needsAuth = false,
            lastCreatedId = null,
        )
        viewModelScope.launch { fetch() }
    }

    fun retry() = refresh()

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch tickets")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.supportApi(base).tickets()
            if (response.code() == 401) {
                _state.value = _state.value.copy(loading = false, needsAuth = true, tickets = emptyList())
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load tickets (HTTP ${response.code()})"
                Log.w(TAG, "tickets error: $message")
                degrade(message)
                return
            }
            val body = response.body()
            val dtos = body?.takeIf { it.success }?.data
            Log.i(TAG, "tickets http=${response.code()} rows=${dtos?.size ?: -1}")
            if (dtos == null) {
                degrade("Could not load tickets")
                return
            }
            lastDtos = dtos
            _state.value = _state.value.copy(
                loading = false,
                tickets = dtos.map { it.toDomain() },
                offline = false,
                error = null,
            )
            persistCache(dtos)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading your tickets. Check your connection and retry.")
        }
    }

    /**
     * Failure path (DealsViewModel convention): keep renderable rows (banner
     * state) — in-memory first, then the saved cache; with neither, the
     * first-launch offline state.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.tickets.isNotEmpty()) {
            _state.value = _state.value.copy(loading = false, offline = true, error = null)
            return
        }
        val cached = withContext(Dispatchers.IO) { SupportCacheStore.read(appContext) }
        val cachedDtos = cached?.data.orEmpty()
        val cachedTickets = cachedDtos.map { it.toDomain() }
        if (cachedTickets.isNotEmpty()) {
            lastDtos = cachedDtos
            _state.value = _state.value.copy(
                loading = false,
                tickets = cachedTickets,
                offline = true,
                error = null,
            )
        } else {
            _state.value = _state.value.copy(loading = false, error = message)
        }
    }

    /**
     * POST api/support/tickets — the real endpoint, the route's exact body.
     * The client-side gates mirror the server's own validation strings so
     * the inline form gives instant honest feedback; anything the SERVER
     * rejects (400/401/403/429/500) surfaces its `{ error }` text verbatim.
     *
     * [onResult] fires exactly once: (true, null) after the server-confirmed
     * row is prepended + cached, or (false, message) with the honest reason.
     * The native form has no category picker, so it files under the route's
     * own "general" category with the schema's default "medium" priority.
     */
    fun createTicket(subject: String, message: String, onResult: (success: Boolean, error: String?) -> Unit) {
        val s = _state.value
        if (s.submitting) return
        if (SessionManager.token() == null) {
            val authError = "Sign in to open a ticket."
            _state.value = s.copy(needsAuth = true, submitError = authError)
            onResult(false, authError)
            return
        }
        val trimmedSubject = subject.trim()
        val trimmedDescription = message.trim()
        val validationError = when {
            trimmedSubject.length < MIN_SUBJECT_LENGTH -> "Subject must be at least $MIN_SUBJECT_LENGTH characters"
            trimmedDescription.length < MIN_DESCRIPTION_LENGTH ->
                "Please describe the issue in at least $MIN_DESCRIPTION_LENGTH characters"
            else -> null
        }
        if (validationError != null) {
            _state.value = s.copy(submitting = false, submitError = validationError)
            onResult(false, validationError)
            return
        }

        _state.value = s.copy(submitting = true, submitError = null)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.supportApi(base).createTicket(
                    CreateSupportTicketRequest(
                        category = CATEGORY_GENERAL,
                        subject = trimmedSubject,
                        description = trimmedDescription,
                        priority = PRIORITY_MEDIUM,
                    ),
                )
                if (response.code() == 401) {
                    val authError = "Your session ended — sign in and try again."
                    _state.value = _state.value.copy(submitting = false, submitError = authError, needsAuth = true)
                    onResult(false, authError)
                    return@launch
                }
                val created = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || created == null) {
                    val serverError = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not submit your ticket (HTTP ${response.code()})"
                    _state.value = _state.value.copy(submitting = false, submitError = serverError)
                    onResult(false, serverError)
                    return@launch
                }

                // Server-confirmed row → prepend (server orders createdAt desc,
                // a fresh ticket IS the newest), then refresh the saved cache.
                val domain = created.toDomain()
                val updated = if (_state.value.tickets.none { it.id == domain.id }) {
                    listOf(domain) + _state.value.tickets
                } else {
                    _state.value.tickets
                }
                lastDtos = listOf(created) + lastDtos.filterNot { it.id == created.id }
                _state.value = _state.value.copy(
                    submitting = false,
                    submitError = null,
                    lastCreatedId = domain.id,
                    tickets = updated,
                )
                persistCache(lastDtos)
                onResult(true, null)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "createTicket failed: ${e.message}")
                val networkError = "Network error while submitting your ticket. Check your connection and retry."
                _state.value = _state.value.copy(submitting = false, submitError = networkError)
                onResult(false, networkError)
            }
        }
    }

    /** Dismiss the "ticket submitted" confirmation banner. */
    fun dismissConfirmation() {
        _state.value = _state.value.copy(lastCreatedId = null)
    }

    /** Persist the ACCUMULATED wire envelope — offline render == online render. */
    private fun persistCache(dtos: List<SupportTicketDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            SupportCacheStore.write(appContext, SupportTicketsEnvelope(success = true, data = dtos))
        }
    }

    private companion object {
        const val TAG = "ZylodSupport"
        const val MIN_SUBJECT_LENGTH = 5
        const val MIN_DESCRIPTION_LENGTH = 20
        const val CATEGORY_GENERAL = "general"
        const val PRIORITY_MEDIUM = "medium"
    }
}

/**
 * On-device saved tickets — the SAME prefs file the rest of the native shell
 * uses (zylod_config), under the owner brief's key "native_support_cache".
 * Payload = the last GET /api/support/tickets envelope, so the offline render
 * is byte-consistent with the online one.
 */
object SupportCacheStore {
    private const val TAG = "ZylodSupport"
    private const val PREFS = "zylod_config"
    const val KEY = "native_support_cache"

    fun read(context: Context): SupportTicketsEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(SupportTicketsEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "support cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: SupportTicketsEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(SupportTicketsEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "support cache write failed: ${it.message}") }
    }
}
