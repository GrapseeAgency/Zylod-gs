package com.zylod.wholesale.data.session

import com.zylod.wholesale.ZylodApp

/**
 * Session token access for native screens. Reads the same encrypted store the
 * WebView bridge mirrors the web session into (ZylodApp.securePrefs,
 * key "auth_token") so native and web stay logged in as the same user.
 */
object SessionManager {
    fun token(): String? = try {
        ZylodApp.instance.securePrefs.getString("auth_token", null)?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }
}
