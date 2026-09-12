package com.zylod.wholesale.session

import android.util.Log
import com.zylod.wholesale.BuildConfig
import org.json.JSONObject

/**
 * F1/F5 — RUNTIME PROVENANCE.
 *
 * The owner's binding remediation order:
 *
 *  F1  "The installed APK must be able to answer: exact build → exact web
 *       source → exact web bundle commit. A wrong/stale/unknown bundle must
 *       never be silently accepted."
 *  F5  "Add the bundle commit/version marker and make it visible in
 *       diagnostics/logging so a future owner audit can immediately prove
 *       which web bundle the device is executing."
 *
 * Mechanism (smallest reliable one — the SPA is NOT bundled into the APK):
 * every web bundle build bakes its identity (commit/version/builtAt) into
 * `window.__ZylodBundleIdentity` (scripts/generate-bundle-identity.mjs, the
 * inline <head> script, and GET /api/app/version). After every document load
 * the shell reads that identity, compares it with the commit THIS native
 * build was produced from (versionName suffix, stamped by CI) and applies the
 * acceptance policy below. Everything is logged under one tag so an owner
 * audit is a single command:
 *
 *     adb logcat -s ZylodProvenance
 *
 * Acceptance policy (F1: no silent acceptance):
 *  - identity MISSING  → blocking on EVERY build type: an unknown bundle
 *    (foreign server, redirect stub, stale pre-provenance bundle) is never
 *    rendered as if it were the app.
 *  - identity MISMATCH → blocking in RELEASE; in DEBUG the exact served
 *    identity stays visible in diagnostics (the owner's order: debug builds
 *    may use development endpoints, but the selected endpoint and the exact
 *    served bundle identity must be visible) — a dev server legitimately
 *    serves an arbitrary working-tree commit, so there it is surfaced, not
 *    silently accepted and not made unusable.
 */
object WebProvenance {

    /** The ONE log tag for every provenance line (F5: permanent visibility). */
    const val LOG_TAG = "ZylodProvenance"

    /** Identity reported by the served web bundle. */
    data class BundleIdentity(
        val commit: String,
        val shortCommit: String,
        val version: String,
        val builtAt: String,
    )

    sealed class Verdict {
        /** Served bundle is the expected bundle (or expected is undeclared). */
        data class Ok(val identity: BundleIdentity) : Verdict()

        /** A known bundle, but not the one this native build was made from. */
        data class Mismatch(val identity: BundleIdentity, val expectedCommit: String) : Verdict()

        /** No identity at all — stub/foreign/stale bundle. Never accepted. */
        data object Missing : Verdict()
    }

    /** The commit this native build was produced from (CI-stamped versionName suffix). */
    fun expectedCommit(): String? {
        val name = BuildConfig.VERSION_NAME
        val suffix = name.substringAfter('-', "")
        return suffix.takeIf { it.isNotEmpty() && it != name }
    }

    fun logAppIdentity() {
        Log.i(
            LOG_TAG,
            "app=${BuildConfig.VERSION_NAME} buildType=${if (BuildConfig.DEBUG) "debug" else "release"} " +
                "expectedCommit=${expectedCommit() ?: "undeclared"} endpoints=${BuildConfig.SERVER_ENDPOINTS.joinToString(",")}",
        )
    }

    /**
     * Parses the shell's document-verify probe result (identity object or
     * JSON string form — see WebShellScripts.documentVerifyScript). Returns
     * null when the bundle exposes no usable identity.
     */
    fun parseIdentity(raw: Any?): BundleIdentity? {
        val obj: JSONObject = when (raw) {
            is JSONObject -> raw
            is String -> runCatching { JSONObject(raw) }.getOrNull() ?: return null
            else -> return null
        }
        val commit = obj.optString("commit", "").trim()
        if (commit.isEmpty() || commit == "null") return null
        return BundleIdentity(
            commit = commit,
            shortCommit = obj.optString("shortCommit", commit.take(7)).trim().ifEmpty { commit.take(7) },
            version = obj.optString("version", "").trim(),
            builtAt = obj.optString("builtAt", "").trim(),
        )
    }

    /**
     * THE acceptance policy. [debugBuild] selects the debug rule (mismatch is
     * visible, not blocking); release enforces the exact bundle.
     */
    fun evaluate(identity: BundleIdentity?, debugBuild: Boolean): Verdict {
        val expected = expectedCommit()
        val id = identity ?: return Verdict.Missing
        return if (expected != null && !id.commit.startsWith(expected) && expected != id.shortCommit) {
            Verdict.Mismatch(id, expected)
        } else {
            Verdict.Ok(id)
        }
    }

    fun blocking(verdict: Verdict, debugBuild: Boolean): Boolean = when (verdict) {
        is Verdict.Ok -> false
        is Verdict.Mismatch -> !debugBuild
        Verdict.Missing -> true
    }

    fun logServed(endpoint: String, verdict: Verdict, debugBuild: Boolean) {
        when (verdict) {
            is Verdict.Ok ->
                Log.i(LOG_TAG, "served endpoint=$endpoint bundle=${verdict.identity.shortCommit} " +
                    "version=${verdict.identity.version} builtAt=${verdict.identity.builtAt} verdict=OK")
            is Verdict.Mismatch -> {
                val level = if (debugBuild) Log.WARN else Log.ERROR
                val action = if (debugBuild) "VISIBLE-IN-DIAGNOSTICS(non-blocking)" else "BLOCKED"
                Log.println(level, LOG_TAG, "served endpoint=$endpoint bundle=${verdict.identity.shortCommit} " +
                    "expected=${verdict.expectedCommit} verdict=MISMATCH action=$action")
            }
            Verdict.Missing ->
                Log.e(LOG_TAG, "served endpoint=$endpoint bundle=NONE verdict=UNKNOWN action=BLOCKED " +
                    "(a wrong/stale/unknown bundle is never silently accepted)")
        }
    }
}
