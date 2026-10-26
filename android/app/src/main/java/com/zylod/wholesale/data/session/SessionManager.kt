package com.zylod.wholesale.data.session

import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.ui.cart.CartStore
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
 *
 * t206 B2: the cached profile JSON is PAIRED to the token it was hydrated
 * with (`user_json_token`). When the mirrored web session signs in as a
 * DIFFERENT user inside the WebView (setAuthToken(B) while user_json still
 * holds A), the stale profile must never be readable — WebAuthSeeder would
 * otherwise seed B's token with A's profile into the web shell.
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

    /** t206 B2: the cached profile is only readable while it belongs to the
     *  CURRENT token. A token rotation without a matching profile re-hydration
     *  (web user switch inside the WebView) hides the foreign profile. */
    fun userJson(): String? = try {
        val raw = ZylodApp.instance.securePrefs.getString("user_json", null)?.takeIf { it.isNotBlank() } ?: return null
        val stamp = ZylodApp.instance.securePrefs.getString("user_json_token", null)
        val token = ZylodApp.instance.securePrefs.getString("auth_token", null)
        // Legacy rows written before the pairing stamp existed stay readable —
        // stamp==null means "hydrated by an older build", not "foreign".
        if (stamp == null || stamp == token) raw else null
    } catch (_: Exception) {
        null
    }

    /** Token-only update (used by the refresh rotation). t206 B2: re-stamps the
     *  pairing so the hydrated profile stays readable across opaque refresh
     *  rotations (same server session). A genuinely DIFFERENT user arriving
     *  through the WebView bridge never passes here — the bridge writes the
     *  raw pref, the old pairing stamp stays, and userJson() hides the stale
     *  profile until ProfileHydrator re-hydrates against the new token. */
    fun setToken(token: String) {
        runCatching {
            val prefs = ZylodApp.instance.securePrefs
            val old = prefs.getString("auth_token", null)
            prefs.edit().putString("auth_token", token).apply()
            if (old != null && old != token) {
                // Refresh rotations replace the opaque value; the PROFILE still
                // belongs to the same server session, so re-stamp instead of
                // dropping the pairing (dropping it would null userJson() for
                // every legitimate 401→refresh cycle).
                prefs.edit().putString("user_json_token", token).apply()
            }
        }
    }

    /** Full session write after login / registration / OTP login / 2FA login.
     *  t206 B2: writes the profile↔token pairing stamp atomically with both. */
    fun setSession(token: String, userJson: String?) {
        runCatching {
            val editor = ZylodApp.instance.securePrefs.edit()
            editor.putString("auth_token", token)
            if (userJson.isNullOrBlank()) editor.remove("user_json") else editor.putString("user_json", userJson)
            editor.putString("user_json_token", token)
            editor.apply()
        }
    }

    /** Updates only the cached profile (post-login /profile/me hydration).
     *  t206 B2: re-stamps the pairing to the current token. */
    fun setUserJson(userJson: String?) {
        runCatching {
            val editor = ZylodApp.instance.securePrefs.edit()
            if (userJson.isNullOrBlank()) editor.remove("user_json") else editor.putString("user_json", userJson)
            SessionManager.token()?.let { editor.putString("user_json_token", it) }
            editor.apply()
        }
    }

    /** Clears token + cached profile. Never clears web-originated sessions silently —
     *  WebAuthSeeder handles the WebView localStorage side.
     *  t202: ALSO clears the local cart — cart lines are account-scoped and
     *  must never survive a logout / session expiry / account switch into the
     *  next user's cart (CartStore.clear() previously had zero callers). */
    fun clear() {
        runCatching {
            ZylodApp.instance.securePrefs.edit()
                .remove("auth_token")
                .remove("user_json")
                .remove("user_json_token")
                .apply()
        }
        runCatching { CartStore.clear() }
    }

    /** Called by the ApiClient authenticator when refresh fails. */
    fun onSessionExpired() {
        clear()
        _expiredTick.value = _expiredTick.value + 1
    }
}
