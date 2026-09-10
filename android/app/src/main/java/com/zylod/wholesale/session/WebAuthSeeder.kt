package com.zylod.wholesale.session

import android.content.Context
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.session.SessionManager
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * Seeds the WebView's `b2b-auth-storage` zustand-persist store so Tier 3
 * (WebView) pages inherit the native session (Phase 1 gate: "token parity",
 * spec §3.0). The JSON envelope matches zustand-persist v4:
 *
 *   {"state":{"isAuthenticated":true,"user":{...UserProfile...},"token":"…"},"version":0}
 *
 * user object = the web UserProfile shape (auth-store.ts:6-21).
 *
 * Safety rule from the Phase 1 brief: never clobber a web-originated session
 * with an empty native one.
 *  - token + cached profile present  → seed (native login/registration won).
 *  - token present but NO cached profile (web logged in via the in-app WebView
 *    and only mirrored its token through the setAuthToken bridge) → do NOT
 *    seed: the WebView's own localStorage is the richer source of truth.
 *  - token absent + we seeded before → inject a removal script (logout parity:
 *    the WebView must not stay authenticated after native logout).
 *  - token absent and never seeded   → no-op (keep web-originated session).
 *
 * Injection uses androidx.webkit WebViewCompat.addDocumentStartJavaScript so
 * the store is written BEFORE the SPA's first script runs. If the WebView
 * provider doesn't support it, WebScreen's onPageStarted fallback injects the
 * same script (legacy pattern) — slightly racy but functional.
 *
 * `b2b-cart-storage` is deliberately NOT seeded: the native CartStore owns the
 * cart in Phase 1 (server sync happens through /api/cart with the token).
 */
object WebAuthSeeder {

    private const val PREFS = "zylod_web_seed"
    private const val KEY_SEEDED = "b2b_auth_seeded"

    @Volatile
    var lastScript: String? = null
        private set

    @Volatile
    var primaryApiAvailable: Boolean = false
        private set

    /** Builds the document-start script for the current session state. */
    fun buildScript(context: Context): String {
        val token = SessionManager.token()
        val profileJson = SessionManager.userJson()
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        val seedJson: String? = if (token != null && !profileJson.isNullOrBlank()) {
            val profile = runCatching {
                ApiClient.json.decodeFromString(UserProfileSeed.serializer(), profileJson)
            }.getOrNull() ?: UserProfileSeed(id = "")
            ApiClient.json.encodeToString(
                SeedState.serializer(),
                SeedState(state = SeedUserData(isAuthenticated = true, user = profile, token = token)),
            )
        } else {
            null
        }

        return when {
            seedJson != null -> {
                prefs.edit().putBoolean(KEY_SEEDED, true).apply()
                script("localStorage.setItem('b2b-auth-storage', ${jsString(seedJson)});")
            }
            token == null && prefs.getBoolean(KEY_SEEDED, false) -> {
                prefs.edit().putBoolean(KEY_SEEDED, false).apply()
                script("localStorage.removeItem('b2b-auth-storage');")
            }
            else -> script("") // no-op — preserve web-originated session
        }
    }

    /**
     * Installs the document-start script for [webView]. Idempotent per
     * (webView, script) pair; falls back to onPageStarted injection when the
     * webkit API is unavailable. Called right before loadUrl so the resolved
     * base origin is known.
     */
    fun install(webView: WebView, baseUrl: String, context: Context) {
        val script = buildScript(context)
        lastScript = script
        val origin = originRule(baseUrl) ?: return
        primaryApiAvailable = try {
            WebViewCompat.addDocumentStartJavaScript(webView, arrayOf(script), setOf(origin))
            true
        } catch (_: Throwable) {
            false
        }
    }

    /** Fallback used from WebViewClient.onPageStarted when install() failed. */
    fun injectFallback(view: WebView?) {
        if (primaryApiAvailable) return
        val script = lastScript ?: return
        view?.evaluateJavascript(script, null)
    }

    /** Match-origin rule ("scheme://host[:port]") for addDocumentStartJavaScript. */
    private fun originRule(baseUrl: String): String? {
        val url = baseUrl.toHttpUrlOrNull() ?: return null
        val defaultPort = if (url.isHttps) 443 else 80
        return if (url.port == defaultPort) "${url.scheme}://${url.host}" else "${url.scheme}://${url.host}:${url.port}"
    }

    private fun script(body: String): String =
        "(function(){try{$body}catch(e){}})();"

    private fun jsString(value: String): String =
        "'" + value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"

    // Wire shapes — @Serializable purely for deterministic JSON generation.
    @kotlinx.serialization.Serializable
    private data class SeedUserData(
        val isAuthenticated: Boolean,
        val user: UserProfileSeed,
        val token: String,
    )

    @kotlinx.serialization.Serializable
    private data class SeedState(
        val state: SeedUserData,
        val version: Int = 0,
    )
}
