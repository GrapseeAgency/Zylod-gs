package com.zylod.wholesale.data.session

import com.zylod.wholesale.ZylodApp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Session state for native screens — single source of truth.
 *
 * Stores:
 *  - the opaque session token (`auth_token`) in the SAME encrypted store the
 *    WebView bridge mirrors the web session into (ZylodApp.securePrefs), so
 *    native login ⇄ WebView stay the same user;
 *  - a cached user-profile JSON (UserProfileSeed shape) used to seed
 *    b2b-auth-storage in the WebView and to render greeting surfaces.
 *
 * `expiredTick` increments whenever the 401→refresh→retry chain in ApiClient
 * fails and the session is destroyed. Screens collect it to surface a
 * "session expired" state instead of crashing.
 */
object SessionManager {

    private val _expiredTick = MutableStateFlow(0)

    /** Increments on forced logout (refresh failure). Observe with collectAsState. */
    val expiredTick: StateFlow<Int> = _expiredTick

    fun token(): String? = try {
        ZylodApp.instance.securePrefs.getString("auth_token", null)?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }

    fun userJson(): String? = try {
        ZylodApp.instance.securePrefs.getString("user_json", null)?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }

    /** Token-only update (used by the refresh rotation). */
    fun setToken(token: String) {
        runCatching {
            ZylodApp.instance.securePrefs.edit().putString("auth_token", token).apply()
        }
    }

    /** Full session write after login / registration / OTP login / 2FA login. */
    fun setSession(token: String, userJson: String?) {
        runCatching {
            val editor = ZylodApp.instance.securePrefs.edit()
            editor.putString("auth_token", token)
            if (userJson.isNullOrBlank()) editor.remove("user_json") else editor.putString("user_json", userJson)
            editor.apply()
        }
    }

    /** Updates only the cached profile (post-login /profile/me hydration). */
    fun setUserJson(userJson: String?) {
        runCatching {
            val editor = ZylodApp.instance.securePrefs.edit()
            if (userJson.isNullOrBlank()) editor.remove("user_json") else editor.putString("user_json", userJson)
            editor.apply()
        }
    }

    /** Clears token + cached profile. Never clears web-originated sessions silently —
     *  WebAuthSeeder handles the WebView localStorage side. */
    fun clear() {
        runCatching {
            ZylodApp.instance.securePrefs.edit()
                .remove("auth_token")
                .remove("user_json")
                .apply()
        }
    }

    /** Called by the ApiClient authenticator when refresh fails. */
    fun onSessionExpired() {
        clear()
        _expiredTick.value = _expiredTick.value + 1
    }
}
