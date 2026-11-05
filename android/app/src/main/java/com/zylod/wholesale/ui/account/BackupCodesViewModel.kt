package com.zylod.wholesale.ui.account

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * t280 — backup recovery codes (backup-codes-page port).
 *
 * The pageId was a curated stub while the server exposes the real set: POST
 * api/auth/backup-codes generates TEN single-use codes (XXXXX-XXXXX, shown
 * ONCE — each generation invalidates every unused code from previous sets),
 * GET reports the remaining count. The screen regenerates on entry exactly
 * like the web page does (with the same high-security-zone warning).
 */
data class BackupCodesUiState(
    val loading: Boolean = true,
    val needsAuth: Boolean = false,
    val error: String? = null,
    val codes: List<String> = emptyList(),
    val copiedTick: Int = 0,
)

class BackupCodesViewModel(private val appContext: Context) : ViewModel() {

    private val _state = MutableStateFlow(BackupCodesUiState())
    val state: StateFlow<BackupCodesUiState> = _state.asStateFlow()

    init { generate() }

    /** POST — the web page auto-fires on mount; regeneration is the only
     *  refresh path (codes are write-only server-side, SHA-256 hashes). */
    fun generate() {
        if (SessionManager.token() == null) {
            _state.update { it.copy(loading = false, needsAuth = true) }
            return
        }
        _state.update { it.copy(loading = true, error = null, needsAuth = false) }
        viewModelScope.launch {
            try {
                val base = ServerConfig.resolve(appContext)
                val response = ApiClient.profileSettingsApi(base).generateBackupCodes()
                if (response.code() == 401) {
                    _state.update { it.copy(loading = false, needsAuth = true) }
                    return@launch
                }
                val data = response.body()
                if (!response.isSuccessful || data?.success != true) {
                    val err = if (!response.isSuccessful) {
                        com.zylod.wholesale.data.api.parseErrorBody(response.errorBody())
                    } else {
                        null
                    }
                    _state.update { it.copy(loading = false, error = err?.error ?: data?.error ?: "Could not generate codes (HTTP ${response.code()})") }
                    return@launch
                }
                _state.update { it.copy(loading = false, codes = data.codes) }
            } catch (ce: CancellationException) {
                throw ce
            } catch (_: Exception) {
                _state.update { it.copy(loading = false, error = "Network error — please check your connection and try again.") }
            }
        }
    }

    fun markCopied() = _state.update { it.copy(copiedTick = it.copiedTick + 1) }
}
