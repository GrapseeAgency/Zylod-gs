package com.zylod.wholesale.debug

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.AuthUserDto
import com.zylod.wholesale.data.api.UserProfileSeed
import com.zylod.wholesale.data.api.toUserProfileSeed

/**
 * t249-g — DEBUG-ONLY session establishment for CI screenshot runs.
 *
 * WHY: the android-screenshots workflow's authed captures (18-orders-authed,
 * 25-admin-dashboard-authed, 26-admin-users-authed, 27-admin-orders-authed)
 * never established a session — twice in a row. UI typing does not land in
 * the Compose text fields on the CI emulator and the previous CDP
 * WebView-bridge path found no `webview_devtools_remote_*` socket in
 * /proc/net/unix, so the API-obtained token (96 hex chars, proven valid by
 * the login call itself) never reached the app. The session store is
 * EncryptedSharedPreferences ("zylod_secure", ZylodApp.kt:35-58) — a
 * host-side plaintext write is impossible against it (and would only cause
 * AEADBadTagException + a store reset).
 *
 * WHAT: scripts/qa/emu-capture.sh fires
 *   adb shell am broadcast -a com.zylod.wholesale.DEBUG_SET_SESSION
 *     --es token <opaque> --es user_json <login-response user JSON>
 *     --es user_type <buyer|admin>
 * and this receiver persists the session with an editor write that MIRRORS
 * the app's OWN SessionManager.setSession `(token: String, userJson: String?)`
 * (data/session/SessionManager.kt:80-88) key-for-key — auth_token /
 * user_json / user_json_token into ZylodApp.instance.securePrefs, the same
 * store every real login writes (LoginScreen.kt:289-291) — so the store stays
 * self-consistent: the app produces its own ciphertext, atomically paired
 * with the `user_json_token` stamp (t206 B2). t249-j: the mirror is inlined
 * here (instead of calling setSession) ONLY to make the write a synchronous
 * commit() — see THREADING.
 *
 * PROFILE SHAPE: parsed with the app's OWN Json config (ApiClient.json) into
 * the same UserProfileSeed a real login caches. Preferred path: the login
 * response's `user` object (src/app/api/auth/login/route.ts:171-181 — id,
 * userType, email, phone, authProvider, accountStatus, isEmailVerified,
 * isPhoneVerified, requires2FA) is decoded as AuthUserDto and mapped with
 * AuthUserDto.toUserProfileSeed() — verbatim the LoginScreen path. A
 * user_json that already carries the stored UserProfileSeed shape is accepted
 * as-is. When user_json is absent but user_type is present, a minimal
 * UserProfileSeed is built from user_type (the model permits it — `id` is its
 * only required field; nothing else can be derived from an opaque session
 * token) with a non-blank placeholder id, and ProfileHydrator re-hydrates the
 * REAL profile from /profile/me on the next authenticated refresh. With
 * neither extra, the write degrades to token-only (setSession(token, null)),
 * the app's own legitimate token-rotation state.
 *
 * SAFETY: this class lives in the src/debug source set — it is compiled ONLY
 * into the debug variant and NEVER into release (the screenshots workflow
 * builds :app:assembleDebug; android-build.yml's assembleRelease excludes
 * src/debug by standard Gradle behavior). BuildConfig.DEBUG is additionally
 * checked at runtime as a hard guard. The receiver is manifest-registered
 * (src/debug/AndroidManifest.xml) and exported — acceptable precisely because
 * it is debug-variant-only.
 *
 * THREADING: onReceive runs on the main thread of the app process (the
 * broadcast itself starts the process when it is warm; emu-capture.sh only
 * fires it AFTER the app has been launched once, because a STOPPED app does
 * not receive manifest broadcasts). The write is a SharedPreferences commit()
 * — SYNCHRONOUS ON PURPOSE (t249-j): this is a debug-QA receiver and
 * emu-capture.sh force-stops the process immediately after the broadcast;
 * the old async flush was queued on QueuedWork and the force-stop killed it
 * before it landed, silently losing the buyer session (CI artifact
 * 13008487170). commit() blocks until the disk write returns; no goAsync()
 * required — the main-thread cost is debug-only and irrelevant here.
 *
 * Never logs the token (length only: "token_len=N").
 */
class DebugSessionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        // Hard guard — belt-and-braces: this class is only compiled into the
        // debug variant anyway (src/debug source set).
        if (!BuildConfig.DEBUG) return
        if (intent?.action != ACTION) return

        val token = intent.getStringExtra(EXTRA_TOKEN)?.trim().orEmpty()
        if (token.isBlank()) {
            Log.w(TAG, "session injection refused: '$EXTRA_TOKEN' extra missing or blank")
            return
        }
        val userJsonRaw = intent.getStringExtra(EXTRA_USER_JSON)?.trim().orEmpty()
        val userType = intent.getStringExtra(EXTRA_USER_TYPE)?.trim().orEmpty()

        try {
            val (seed, source) = parseProfile(userJsonRaw)
                ?: minimalSeed(userType)?.let { it to ProfileSource.MINIMAL_FALLBACK }
                ?: (null to ProfileSource.NONE)
            val storedJson = seed?.let {
                ApiClient.json.encodeToString(UserProfileSeed.serializer(), it)
            }
            // t249-j — key-for-key mirror of SessionManager.setSession
            // (auth_token / user_json / user_json_token into
            // ZylodApp.instance.securePrefs) with a SYNCHRONOUS commit():
            // setSession's write is an async flush queued on QueuedWork and
            // the capture script force-stops the process right after this
            // broadcast, which raced the flush away and lost the session
            // (CI artifact 13008487170).
            val editor = ZylodApp.instance.securePrefs.edit()
            editor.putString("auth_token", token)
            if (storedJson.isNullOrBlank()) editor.remove("user_json") else editor.putString("user_json", storedJson)
            editor.putString("user_json_token", token)
            if (editor.commit()) {
                Log.i(
                    TAG,
                    "session injected user_type=${seed?.userType ?: userType.ifEmpty { "unknown" }} " +
                        "token_len=${token.length} profile=${source.label} committed=true",
                )
            } else {
                Log.e(TAG, "session injection failed: securePrefs commit() returned false committed=false")
            }
        } catch (e: Exception) {
            Log.e(TAG, "session injection failed: ${e.javaClass.simpleName}: ${e.message} committed=false")
        }
    }

    /** user_json -> (profile, source). Preferred: the login response's user
     *  object decoded as AuthUserDto and mapped exactly like LoginScreen does
     *  (AuthUserDto.toUserProfileSeed()). Fallback: a user_json that already
     *  carries the stored UserProfileSeed shape. null when absent/unparsable. */
    private fun parseProfile(userJsonRaw: String): Pair<UserProfileSeed, ProfileSource>? {
        if (userJsonRaw.isEmpty()) return null
        runCatching {
            return ApiClient.json
                .decodeFromString(AuthUserDto.serializer(), userJsonRaw)
                .toUserProfileSeed()
                .let { it to ProfileSource.LOGIN_RESPONSE }
        }
        return runCatching {
            ApiClient.json
                .decodeFromString(UserProfileSeed.serializer(), userJsonRaw)
                .let { it to ProfileSource.STORED_SEED }
        }.getOrNull()
    }

    /** Minimal fallback when user_json was not supplied: UserProfileSeed
     *  permits it (only `id` is required; nothing else is derivable from an
     *  opaque token). ProfileHydrator re-hydrates the real profile from
     *  /profile/me on the next authenticated refresh. null when user_type is
     *  absent (caller degrades to a token-only write). */
    private fun minimalSeed(userType: String): UserProfileSeed? =
        userType.takeIf { it.isNotEmpty() }?.let {
            UserProfileSeed(id = PLACEHOLDER_ID, userType = it)
        }

    private enum class ProfileSource(val label: String) {
        LOGIN_RESPONSE("login-response"),
        STORED_SEED("stored-seed"),
        MINIMAL_FALLBACK("minimal"),
        NONE("none(token-only)"),
    }

    private companion object {
        const val TAG = "ZylodDebugSession"
        const val ACTION = "com.zylod.wholesale.DEBUG_SET_SESSION"
        const val EXTRA_TOKEN = "token"
        const val EXTRA_USER_JSON = "user_json"
        const val EXTRA_USER_TYPE = "user_type"
        const val PLACEHOLDER_ID = "debug-broadcast"
    }
}
