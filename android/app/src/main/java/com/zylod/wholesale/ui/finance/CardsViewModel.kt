package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CardDto
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.api.parseErrorBody
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

/**
 * Cards VM — GET api/cards (FinanceApi.cards, cards/route.ts:7) as the
 * payload of record for the native credit-debit-cards pageId. The handler
 * projects the user's type-in(card,debit,credit) paymentMethods rows with
 * the tokenized last4 (the raw PAN is never persisted server-side).
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch means a real end of session (the shared OkHttp authenticator
 *    has already attempted one token refresh by then) → needsAuth.
 *  - FAILURE: honest error card + Retry when nothing renderable; the last
 *    saved snapshot (SharedPreferences "zylod_config", "native_cards_cache")
 *    renders with the offline banner otherwise (BankAccountsViewModel
 *    degrade convention).
 *  - DELETE: DELETE api/cards/{id} (cards/[id]/route.ts, 404 for a foreign
 *    id) — on success the row drops locally AND the full list re-fetches;
 *    the failure text surfaces honestly in a snackbar. Double-delete is
 *    guarded (one in-flight delete at a time).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (TrackOrderViewModel convention) while sharing the one cache key.
 */
data class CardsUiState(
    /** Resolving / fetching the book (skeleton cards while empty). */
    val loading: Boolean = true,
    val cards: List<CardDto> = emptyList(),
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible book came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
    /** The delete in flight (its row shows progress; further deletes blocked). */
    val deletingId: String? = null,
    /** A failed delete/refresh action — surfaced as a snackbar, non-fatal. */
    val actionError: String? = null,
)

class CardsViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CardsUiState())
    val state: StateFlow<CardsUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (BankAccountsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(
                        loading = false,
                        needsAuth = true,
                    )
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = CardsUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.cards.isEmpty(),
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchCards() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    /**
     * DELETE api/cards/{id} — the [id] route's real removal method. Success
     * drops the row locally and re-fetches the fresh list; failure surfaces
     * the route's honest error text in the snackbar line.
     */
    fun delete(cardId: String) {
        val s = _state.value
        if (cardId.isBlank() || s.deletingId != null) return
        if (SessionManager.token() == null) {
            _state.value = s.copy(deletingId = null, needsAuth = true)
            return
        }
        _state.update { it.copy(deletingId = cardId, actionError = null) }
        viewModelScope.launch {
            try {
                Log.i(TAG, "delete card …${cardId.takeLast(6)}")
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.financeApi(base).deleteCard(cardId)
                if (response.code() == 401) {
                    Log.i(TAG, "delete rejected (http=401) — session ended")
                    _state.update { it.copy(deletingId = null, needsAuth = true) }
                    return@launch
                }
                val payload = response.body()
                if (response.isSuccessful && payload?.success == true) {
                    Log.i(TAG, "card removed")
                    _state.update {
                        it.copy(
                            deletingId = null,
                            cards = it.cards.filter { row -> row.id != cardId },
                        )
                    }
                    // Re-fetch the server's authoritative list.
                    load()
                    return@launch
                }
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not remove the card (HTTP ${response.code()})."
                Log.w(TAG, "delete failed: $message")
                _state.update { it.copy(deletingId = null, actionError = message) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "delete failed: ${e.message}")
                _state.update {
                    it.copy(
                        deletingId = null,
                        actionError = "Network error while removing the card. Check your connection and retry.",
                    )
                }
            }
        }
    }

    /** The snackbar consumed its action error. */
    fun consumeActionError() {
        _state.update { it.copy(actionError = null) }
    }

    private suspend fun fetchCards() {
        try {
            Log.i(TAG, "fetch cards")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).cards()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val rows = payload?.data
                ?.takeIf { response.isSuccessful && payload?.success == true }
                .orEmpty()
            if (!response.isSuccessful || payload?.success != true) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your cards (HTTP ${response.code()})."
                Log.w(TAG, "cards error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "cards loaded rows=${rows.size}")
            _state.value = CardsUiState(loading = false, cards = rows)
            persistCache(rows)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "cards fetch failed: ${e.message}")
            degrade("Network error while loading your cards. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /**
     * Failure path: keep renderable data (banner state) — the saved list
     * cache; with none, the honest error card. Mapped on the MAIN thread
     * after the IO cache read (AddressBookViewModel convention).
     */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(
                appContext,
                FinanceCacheKeys.CARDS,
                CachedCards.serializer(),
            )
        }
        val rows = cached?.rows.orEmpty()
        if (rows.isNotEmpty()) {
            Log.i(TAG, "degrade → cache rows=${rows.size}")
            _state.value = CardsUiState(
                loading = false,
                cards = rows,
                offlineFromCache = true,
            )
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTOs — the offline render matches the live one. */
    private fun persistCache(rows: List<CardDto>) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                FinanceCacheKeys.CARDS,
                CachedCards.serializer(),
                CachedCards(rows = rows),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
