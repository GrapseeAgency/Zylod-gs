package com.zylod.wholesale.ui.finance

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.CreditScoreDto
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
 * Credit-score VM — GET api/credits/score (FinanceApi.creditScore, the
 * computed commercial rating behind the native credit-score pageId) as the
 * payload of record.
 *
 *  - AUTH: no token → no call at all, the honest sign-in gate. A 401 on
 *    the fetch (after the shared OkHttp authenticator's one refresh) →
 *    needsAuth.
 *  - OFFLINE: the last saved rating (SharedPreferences "zylod_config",
 *    "native_credit_score_cache") renders with the offline banner
 *    otherwise (FinanceCacheStore degrade convention).
 *
 * Each registry entry keyed by [pageId] keeps its OWN VM instance
 * (BankAccountsViewModel convention) while sharing the one cache key.
 */
data class CreditScoreUiState(
    /** Resolving / fetching the rating (skeleton while empty). */
    val loading: Boolean = true,
    val score: CreditScoreDto? = null,
    /** Load failure text (with Retry) — null on success. */
    val error: String? = null,
    /** Signed out (no token, or a 401 after the refresh attempt) — the gate. */
    val needsAuth: Boolean = false,
    /** The visible rating came from the saved disk cache (loaded offline). */
    val offlineFromCache: Boolean = false,
)

class CreditScoreViewModel(
    private val appContext: Context,
    val pageId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(CreditScoreUiState())
    val state: StateFlow<CreditScoreUiState> = _state.asStateFlow()

    private var baseUrl: String? = null
    private var initJob: Job? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in gate (BankAccountsViewModel convention).
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = _state.value.copy(loading = false, needsAuth = true)
                }
            }
        }
    }

    /** Entry resolve (called on EVERY entry; guarded against double-runs). */
    fun load() {
        if (initJob?.isActive == true) return
        if (SessionManager.token() == null) {
            _state.value = CreditScoreUiState(loading = false, needsAuth = true)
            return
        }
        initJob?.cancel()
        _state.update {
            it.copy(
                loading = it.score == null,
                error = null,
                needsAuth = false,
                offlineFromCache = false,
            )
        }
        initJob = viewModelScope.launch { fetchScore() }
    }

    /** Error-card Retry — full re-fetch. */
    fun retry() = load()

    private suspend fun fetchScore() {
        try {
            Log.i(TAG, "fetch credit score")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.financeApi(base).creditScore()
            if (gateOn401(response.code())) return
            val payload = response.body()
            val score = payload?.data
            if (!response.isSuccessful || payload?.success != true || score == null) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load your trade credit score (HTTP ${response.code()})."
                Log.w(TAG, "credit score error: $message")
                degrade(message)
                return
            }
            Log.i(TAG, "credit score loaded score=${score.score}")
            _state.value = CreditScoreUiState(loading = false, score = score)
            persistCache(score)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "credit score fetch failed: ${e.message}")
            degrade("Network error while loading your trade credit score. Check your connection and retry.")
        }
    }

    private fun gateOn401(code: Int): Boolean {
        if (code != 401) return false
        Log.i(TAG, "not permitted (http=401) — session ended")
        _state.value = _state.value.copy(loading = false, needsAuth = true)
        return true
    }

    /** Failure path: saved rating cache; with none, the honest error card. */
    private suspend fun degrade(message: String) {
        val cached = withContext(Dispatchers.IO) {
            FinanceCacheStore.read(appContext, CreditCacheKeys.CREDIT_SCORE, CachedCreditScoreCard.serializer())
        }
        val score = cached?.score
        if (score != null) {
            Log.i(TAG, "degrade → cached credit score")
            _state.value = CreditScoreUiState(loading = false, score = score, offlineFromCache = true)
        } else {
            _state.update { it.copy(loading = false, error = message) }
        }
    }

    /** Persist the wire DTO — the offline render matches the live one. */
    private fun persistCache(score: CreditScoreDto) {
        viewModelScope.launch(Dispatchers.IO) {
            FinanceCacheStore.write(
                appContext,
                CreditCacheKeys.CREDIT_SCORE,
                CachedCreditScoreCard.serializer(),
                CachedCreditScoreCard(score = score),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodFinance"
    }
}
