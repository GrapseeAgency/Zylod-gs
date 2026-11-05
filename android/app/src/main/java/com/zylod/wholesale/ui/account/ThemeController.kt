package com.zylod.wholesale.ui.account

import android.content.Context
import com.zylod.wholesale.ZylodApp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * t280 — in-app theme override (the /api/profile/theme port).
 *
 * The app previously followed ONLY the system setting — ZylodTheme's
 * darkTheme parameter was never passed anything, so the server-side theme
 * preference the web persists (GET/PATCH api/profile/theme) had no native
 * counterpart at all. This controller gives the preference a live, process
 * -wide home:
 *
 *  - [mode] is a StateFlow the activity root collects (recomposition applies
 *    the new scheme instantly, no restart);
 *  - persistence is the plain "theme_mode" key in zylod_config — DELIBERATELY
 *    not "native_*"-prefixed, so the t279 account-scoped logout purge (which
 *    clears every native_* key) does not wipe a DEVICE-level appearance
 *    choice;
 *  - the account-settings Appearance section sets it locally AND PATCHes the
 *    server (cross-device sync); "system" restores the follow-system default.
 */
object ThemeController {

    enum class Mode { SYSTEM, LIGHT, DARK }

    private const val PREFS = "zylod_config"
    private const val KEY = "theme_mode"

    private val _mode = MutableStateFlow(Mode.SYSTEM)
    val mode: StateFlow<Mode> = _mode.asStateFlow()

    /** True when the persisted override differs from SYSTEM. */
    val isCustomized: Boolean get() = _mode.value != Mode.SYSTEM

    /** Call once at process start (Activity onCreate, before setContent). */
    fun hydrate() {
        val raw = runCatching {
            ZylodApp.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
        }.getOrNull()
        _mode.value = when (raw?.trim()?.lowercase()) {
            "light" -> Mode.LIGHT
            "dark" -> Mode.DARK
            else -> Mode.SYSTEM
        }
    }

    /** The darkTheme argument for ZylodTheme (mode from the collected flow). */
    fun resolveDarkTheme(mode: Mode, systemInDark: Boolean): Boolean = when (mode) {
        Mode.SYSTEM -> systemInDark
        Mode.LIGHT -> false
        Mode.DARK -> true
    }

    /** Persist + publish the new mode (the server PATCH is the caller's job). */
    fun apply(mode: Mode) {
        _mode.value = mode
        runCatching {
            ZylodApp.instance.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY, mode.name.lowercase()).apply()
        }
    }

    /** Wire value → Mode ("system" | "light" | "dark", unknown → SYSTEM). */
    fun fromWire(value: String?): Mode = when (value?.trim()?.lowercase()) {
        "light" -> Mode.LIGHT
        "dark" -> Mode.DARK
        else -> Mode.SYSTEM
    }

    /** Mode → the server's wire string. */
    fun toWire(mode: Mode): String = when (mode) {
        Mode.SYSTEM -> "system"
        Mode.LIGHT -> "light"
        Mode.DARK -> "dark"
    }
}
