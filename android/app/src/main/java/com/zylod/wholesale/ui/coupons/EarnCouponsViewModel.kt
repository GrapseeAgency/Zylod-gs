package com.zylod.wholesale.ui.coupons

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.EarnClaimRequest
import com.zylod.wholesale.data.api.ServerConfig
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
 * Native Earn Coupons VM — the Task 111 reward-tasks rail against the REAL
 * src/app/api/coupons/earn routes:
 *
 *  - GET  api/coupons/earn  — the active tasks; signed-in rows carry the
 *    server's OWN claimed flag and proof progress (never a local guess).
 *  - POST api/coupons/earn  — claim one task; 201 returns the created
 *    voucher row, 403/409 arrive with the server's own wording, and the
 *    one-claim-per-buyer-per-task guard is the server's, forever.
 *
 * Doctrine (identical to CouponsViewModel):
 *  - AUTH: an absent token short-circuits to `needsAuth` without a network
 *    call — the web page wraps this rail in its AccountGate, so the native
 *    screen shows the same soft sign-in CTA, never a hard redirect. A 401
 *    (the shared OkHttp authenticator already tried one refresh) also lands
 *    there with rendered data CLEARED — a stale reward rail must never
 *    survive a dead session.
 *  - OFFLINE (DealsViewModel degrade convention): on failure, renderable
 *    tasks survive — in-memory first, then the device-saved cache
 *    (SharedPreferences "zylod_config"/"native_earn_tasks_cache", written
 *    after every successful pull) — and the state flips to `offline` so the
 *    screen shows its saved-data banner. With nothing renderable at all:
 *    the honest first-launch error state, never a blank screen.
 *  - CLAIM SAFETY: one claim in flight at a time; every settled claim
 *    updates the rail from the SERVER's answer (the created voucher or the
 *    server's refusal wording) — the UI never invents a success.
 */
data class EarnUiState(
    val loading: Boolean = true,
    /** The active reward tasks, server order (sortOrder asc). */
    val tasks: List<EarnTask> = emptyList(),
    /** stableKey of the task whose claim POST is in flight. */
    val claimingKey: String? = null,
    /** One-shot inline feedback for claim attempts (success or failure). */
    val notice: Notice? = null,
    /** The visible rows are SAVED data (in-memory or disk cache). */
    val offline: Boolean = false,
    /** Signed out (no token / dead session after the refresh retry). */
    val needsAuth: Boolean = false,
    /** Set only when nothing is renderable (no network AND no saved cache). */
    val error: String? = null,
) {
    val hasContent: Boolean
        get() = tasks.isNotEmpty()

    /** Inline claim feedback, styled differently for failure vs success. */
    data class Notice(val text: String, val isError: Boolean)
}

class EarnCouponsViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(EarnUiState())
    val state: StateFlow<EarnUiState> = _state.asStateFlow()

    private var baseUrl: String? = null

    init {
        // 401→refresh→logout chain: a dropped session moves the screen to
        // the sign-in state instead of a stale (possibly someone else's)
        // reward rail.
        viewModelScope.launch {
            SessionManager.expiredTick.collect {
                if (SessionManager.token() == null) {
                    _state.value = EarnUiState(loading = false, needsAuth = true)
                }
            }
        }
    }

    /**
     * Entry pull / retry (called on EVERY entry — the VM survives on the
     * saved back stack, so rewards claimed elsewhere show up at once). Same
     * guard doctrine as CouponsViewModel.refresh(): only a pull already in
     * flight WITH content on screen is a no-op (t216 silent-refresh
     * convention — never blank visible data behind a spinner).
     */
    fun refresh() {
        if (SessionManager.token() == null) {
            _state.value = EarnUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return // a claim is mutating the rail — let it settle
        if (s.loading && s.hasContent) return // a refresh already in flight with content on screen
        _state.value = s.copy(
            loading = !s.hasContent,
            offline = false,
            error = null,
            needsAuth = false,
            notice = null,
        )
        viewModelScope.launch { fetch() }
    }

    /** Same hook as WalletViewModel.retry() — screens bind either name. */
    fun retry() = refresh()

    private suspend fun fetch() {
        try {
            Log.i(TAG, "fetch")
            val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
            val response = ApiClient.couponsApi(base).earnTasks()

            // 401: the shared authenticator has already attempted one token
            // refresh by the time a 401 reaches this layer → real end of
            // session → sign-in state, data cleared.
            if (response.code() == 401) {
                Log.w(TAG, "earn 401 — session ended")
                _state.value = EarnUiState(loading = false, needsAuth = true)
                return
            }
            if (!response.isSuccessful) {
                val message = parseErrorBody(response.errorBody()).error
                    ?.takeIf(String::isNotBlank)
                    ?: "Could not load reward tasks (HTTP ${response.code()})"
                Log.w(TAG, "earn error: $message")
                degrade(message)
                return
            }
            val body = response.body()?.takeIf { it.success }
            if (body == null) {
                degrade("Could not load reward tasks")
                return
            }
            val tasks = body.earnTasks()
            Log.i(TAG, "earn http=${response.code()} tasks=${tasks.size}")

            _state.value = EarnUiState(loading = false, tasks = tasks, offline = false)
            persistCache(tasks)
        } catch (ce: CancellationException) {
            throw ce
        } catch (e: Exception) {
            Log.w(TAG, "fetch failed: ${e.message}")
            degrade("Network error while loading reward tasks. Check your connection and retry.")
        }
    }

    /**
     * Claim one task's voucher. Success moves the card to Claimed FROM THE
     * SERVER's created row; a refusal (403 shortfall / 409 already claimed)
     * surfaces the server's OWN wording — the same honesty contract as the
     * web page's toasts.
     */
    fun claim(task: EarnTask) {
        if (SessionManager.token() == null) {
            _state.value = EarnUiState(loading = false, needsAuth = true)
            return
        }
        val s = _state.value
        if (s.claimingKey != null) return // one claim in flight at a time
        if (task.claimed) return // the button is disabled anyway — belt and braces
        _state.value = s.copy(claimingKey = task.stableKey, notice = null)
        viewModelScope.launch {
            try {
                val base = baseUrl ?: ServerConfig.resolve(appContext).also { baseUrl = it }
                val response = ApiClient.couponsApi(base)
                    .claimEarnTask(EarnClaimRequest(taskId = task.id))
                if (response.code() == 401) {
                    Log.w(TAG, "claim 401 — session ended")
                    _state.value = EarnUiState(loading = false, needsAuth = true)
                    return@launch
                }
                val created = response.body()?.takeIf { it.success }?.data
                if (!response.isSuccessful || created == null) {
                    val message = parseErrorBody(response.errorBody()).error
                        ?.takeIf(String::isNotBlank)
                        ?: "Could not claim this reward right now."
                    Log.w(TAG, "claim error: $message")
                    // 409 = the server says the voucher is ALREADY in the
                    // vault — reflect that on the rail instead of a dead
                    // retry button.
                    val claimedNow = response.code() == 409
                    _state.value = _state.value.copy(
                        claimingKey = null,
                        notice = EarnUiState.Notice(message, isError = true),
                        tasks = if (claimedNow) _state.value.tasks.map {
                            if (it.stableKey == task.stableKey) it.copy(claimed = true) else it
                        } else _state.value.tasks,
                    )
                    if (claimedNow) persistCache(_state.value.tasks)
                    return@launch
                }
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = EarnUiState.Notice(
                        "Reward unlocked: ${task.rewardLabel} — the voucher is in your vault",
                        isError = false,
                    ),
                    tasks = _state.value.tasks.map {
                        if (it.stableKey == task.stableKey) it.copy(claimed = true) else it
                    },
                )
                persistCache(_state.value.tasks)
            } catch (ce: CancellationException) {
                throw ce
            } catch (e: Exception) {
                Log.w(TAG, "claim failed: ${e.message}")
                _state.value = _state.value.copy(
                    claimingKey = null,
                    notice = EarnUiState.Notice(
                        "Network error while claiming. Check your connection and retry.",
                        isError = true,
                    ),
                )
            }
        }
    }

    /**
     * Failure path: keep renderable rows (banner state) — in-memory first,
     * then the saved cache; with neither, the first-launch offline state.
     */
    private suspend fun degrade(message: String) {
        if (_state.value.hasContent) {
            _state.value = _state.value.copy(
                loading = false,
                claimingKey = null,
                offline = true,
            )
            return
        }
        val cached = withContext(Dispatchers.IO) { EarnTasksCacheStore.read(appContext) }
        if (cached != null && cached.tasks.isNotEmpty()) {
            _state.value = EarnUiState(
                loading = false,
                tasks = cached.tasks,
                offline = true,
            )
        } else {
            _state.value = EarnUiState(loading = false, error = message)
        }
    }

    private fun persistCache(tasks: List<EarnTask>) {
        viewModelScope.launch(Dispatchers.IO) {
            EarnTasksCacheStore.write(
                appContext,
                EarnCacheEnvelope(savedAt = System.currentTimeMillis(), tasks = tasks),
            )
        }
    }

    private companion object {
        const val TAG = "ZylodEarnCoupons"
    }
}

/**
 * On-device saved reward tasks — the SAME prefs file the rest of the native
 * shell uses (zylod_config), under the key "native_earn_tasks_cache"
 * (house naming, "native_coupons_cache" precedent). Payload = the last
 * successful rail so the offline render is consistent with the online one.
 */
object EarnTasksCacheStore {
    private const val TAG = "ZylodEarnCoupons"
    private const val PREFS = "zylod_config"
    const val KEY = "native_earn_tasks_cache"

    fun read(context: Context): EarnCacheEnvelope? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return null
        ApiClient.json.decodeFromString(EarnCacheEnvelope.serializer(), raw)
    }.onFailure { Log.w(TAG, "earn cache read failed: ${it.message}") }.getOrNull()

    fun write(context: Context, envelope: EarnCacheEnvelope) {
        runCatching {
            val raw = ApiClient.json.encodeToString(EarnCacheEnvelope.serializer(), envelope)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY, raw)
                .apply()
        }.onFailure { Log.w(TAG, "earn cache write failed: ${it.message}") }
    }
}
