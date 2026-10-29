package com.zylod.wholesale.ui.profile

import androidx.lifecycle.ViewModel
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * t233 — native Profile VM (SPA pageId "profile"; guests never reach this
 * screen — RouteOwnership resolves an unauthenticated profile request to the
 * native login, matching the web bar's own behavior).
 *
 * Identity source: SessionManager's paired user-profile JSON (the SAME
 * UserProfileSeed the WebView bridge seeds) — readable offline, honest about
 * verification state and profile completion. No extra network call: the
 * session cache IS the profile the rest of the shell already trusts.
 */
data class ProfileUiState(
    val signedIn: Boolean = false,
    val profile: UserProfileSeed? = null,
)

class ProfileViewModel : ViewModel() {

    private val _state = MutableStateFlow(load())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    /** Re-read the session (token rotations / profile hydration invalidate the cache). */
    fun refresh() {
        _state.value = load()
    }

    fun signOut() {
        SessionManager.clear()
        _state.value = load()
    }

    private fun load(): ProfileUiState {
        val token = SessionManager.token()
        if (token == null) return ProfileUiState(signedIn = false)
        val profile = SessionManager.userJson()?.let { raw ->
            runCatching {
                ApiClient.json.decodeFromString(UserProfileSeed.serializer(), raw)
            }.getOrNull()
        }
        return ProfileUiState(signedIn = true, profile = profile)
    }
}
