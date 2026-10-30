package com.zylod.wholesale.data.api

import android.content.Context
import android.util.Log
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.session.WebProvenance
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/**
 * Resolves the active backend from BuildConfig.SERVER_ENDPOINTS (same list the
 * WebView shell probes) and caches it under the same prefs file so both shells
 * agree.
 *
 * F1 — deterministic, AUDITABLE endpoint discovery (owner deployment order:
 * discovery is "acceptable only when the selected server actually serves the
 * matching web bundle"):
 *  - every candidate is probed on /api/app/version; the probe result records
 *    the HTTP status, whether the responder is a GENUINE Zylod server (a 2xx
 *    body that reports a bundle identity — docs/PROVENANCE.md §3) and WHICH
 *    bundle commit it serves;
 *  - t241 — SELECTION IS PREFER-BUNDLE-MATCH (two passes over the frozen
 *    order). PASS 1: the first GENUINE host that serves the web bundle THIS
 *    APK was built from (expected = versionName commit suffix, stamped by
 *    CI) wins — for that check the probe ALSO reads the identity the server
 *    serves in its HTML shell (window.__ZylodBundleIdentity, injected inline
 *    in <head> by web/src/app/layout.tsx), because /api/app/version alone
 *    can describe a server that actually serves a STALE web bundle — the
 *    exact emulator-run failure t241 fixes: the app bound to the stale
 *    preview host (f22b88a) instead of the CI-local server serving c69704a.
 *    PASS 2 (fallback): the first GENUINE host in order — the pre-t241
 *    policy — so production can never regress when no candidate serves the
 *    exact bundle yet (local builds declare no suffix and every genuine
 *    host qualifies in PASS 1). A host that answers but serves no Zylod
 *    bundle identity (redirect stub, captive portal, 404) is skipped and
 *    logged — it can never beat a genuine server further down the list.
 *    Only when NO candidate is genuine does discovery fall back
 *    (first-alive → cache → first), with the reason logged and the
 *    divergence recorded by the provenance gate (t208: the gate is LOG-ONLY
 *    for navigation — the page still renders, no dead end);
 *  - an endpoint change between resolves is logged prominently — endpoint
 *    switching is never silent (owner hard rule);
 *  - the full probe matrix (endpoint → status → served bundle) is logged so
 *    `adb logcat -s ZylodProvenance` alone answers "exact build → exact web
 *    source → exact web bundle commit".
 */
object ServerConfig {
    private const val PREFS = "zylod_config"
    private const val KEY_BASE = "native_base_url"

    /** t241: diagnostics-only companion of [KEY_BASE] — why that host won. */
    private const val KEY_REASON = "native_base_url_reason"
    private const val PROBE_BUDGET_MS = 4_000L
    private const val HTML_SHELL_BUDGET_MS = 3_000L
    private const val HTML_SHELL_PEEK_BYTES = 512_000L

    /** Result of probing ONE candidate endpoint. */
    data class ProbeResult(
        val alive: Boolean,
        val httpStatus: Int?,
        /** true when the responder is a genuine Zylod server: 2xx /api/app/version body reporting a bundle identity. */
        val zylodPayload: Boolean,
        /** The bundle commit the endpoint reports (diagnostics; "" when absent). */
        val servedCommit: String,
        /**
         * t241 — the bundle identity served in the endpoint's HTML shell
         * (window.__ZylodBundleIdentity: the bundle the server ACTUALLY
         * serves its web clients). null when the host is not genuine or the
         * identity could not be extracted — a null bundle can never win the
         * PASS 1 bundle-match; such a host only ever wins via the PASS 2
         * first-genuine fallback.
         */
        val servedBundle: String? = null,
    )

    /** The endpoints' last probe matrix (diagnostics). */
    @Volatile
    var lastProbeMatrix: Map<String, ProbeResult> = emptyMap()
        private set

    fun cached(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_BASE, null)

    suspend fun resolve(context: Context): String = withContext(Dispatchers.IO) {
        val candidates = BuildConfig.SERVER_ENDPOINTS.toList()
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        coroutineScope {
            val probes = candidates.associateWith { async { probe(it) } }
            val results = probes.mapValues { (_, deferred) ->
                runCatching { deferred.await() }.getOrDefault(
                    ProbeResult(alive = false, httpStatus = null, zylodPayload = false, servedCommit = ""),
                )
            }
            lastProbeMatrix = results

            // Ordered probe matrix — the owner sees exactly why a host won.
            results.forEach { (endpoint, result) ->
                val status = result.httpStatus?.toString() ?: "unreachable"
                val served = if (result.servedCommit.isEmpty()) "none" else result.servedCommit.take(7)
                val shell = result.servedBundle?.take(7) ?: "none"
                Log.i(
                    WebProvenance.LOG_TAG,
                    "probe endpoint=$endpoint status=$status zylodPayload=${result.zylodPayload} " +
                        "servedBundle=$served shellBundle=$shell alive=${result.alive}",
                )
            }

            // t241 SELECTION — PREFER-BUNDLE-MATCH, two passes over the
            // FROZEN candidate order:
            //   PASS 1: first GENUINE host whose served HTML-shell bundle
            //     matches the bundle THIS APK was built from (expected =
            //     versionName commit suffix; empty on local builds without
            //     a suffix, where every genuine host qualifies).
            //   PASS 2 (fallback): first GENUINE host in order — the
            //     pre-t241 policy — so production never regresses when no
            //     candidate serves the exact bundle yet.
            val expectedBundle = BuildConfig.VERSION_NAME.substringAfterLast('-', "")
            val bundleMatch = candidates.firstOrNull { candidate ->
                val r = results[candidate]
                r?.zylodPayload == true &&
                    (expectedBundle.isEmpty() || bundleMatches(r.servedBundle, expectedBundle))
            }
            val genuine = candidates.firstOrNull { results[it]?.zylodPayload == true }
            val firstAlive = candidates.firstOrNull { results[it]?.alive == true }
            val previous = cached(context)
            val chosen = bundleMatch ?: genuine ?: firstAlive ?: previous ?: candidates.first()
            val reason = when {
                bundleMatch != null -> "bundle-match"
                genuine != null ->
                    if (results[genuine]?.servedBundle.isNullOrEmpty()) "no-bundle-header"
                    else "fallback-first-genuine"
                firstAlive != null -> "no-genuine-endpoint-first-alive(t208-fail-open-render-anyway)"
                previous != null -> "all-dead-cache-fallback"
                else -> "all-dead-default-first"
            }
            if (previous != null && previous != chosen) {
                Log.w(WebProvenance.LOG_TAG, "ENDPOINT CHANGED $previous -> $chosen (reason=$reason)")
            }
            val chosenShell = results[chosen]?.servedBundle
            Log.i(
                WebProvenance.LOG_TAG,
                "selected endpoint=$chosen servedBundle=${chosenShell?.take(7) ?: "none"} " +
                    "expected=${expectedBundle.ifEmpty { "none" }} reason=$reason",
            )
            // Cache stays caller-compatible: KEY_BASE still holds ONLY the
            // chosen host; the decision reason is recorded alongside it.
            prefs.edit()
                .putString(KEY_BASE, chosen)
                .putString(KEY_REASON, reason)
                .apply()
            chosen
        }
    }

    private val probeClient = OkHttpClient.Builder()
        .connectTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .readTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .build()

    /** t241: short-timeout client for the HTML-shell identity GET. */
    private val identityClient = OkHttpClient.Builder()
        .connectTimeout(HTML_SHELL_BUDGET_MS, TimeUnit.MILLISECONDS)
        .readTimeout(HTML_SHELL_BUDGET_MS, TimeUnit.MILLISECONDS)
        .build()

    /**
     * web/src/app/layout.tsx injects the served bundle's identity inline in
     * <head> as a JSON object literal:
     *   window.__ZylodBundleIdentity={"commit":"<sha>","shortCommit":"<sha7>",...};
     * Object form first (the plain <head> script always precedes Next's
     * escaped RSC copies, which this regex cannot false-match because the
     * escaped form has no bare "commit" key). A bare-string identity is
     * accepted as a defensive fallback.
     */
    private val SHELL_BUNDLE_OBJECT = Regex(
        "__ZylodBundleIdentity\\s*=\\s*\\{[^{}]*?\"commit\"\\s*:\\s*\"([^\"]+)\"",
    )
    private val SHELL_BUNDLE_STRING = Regex("__ZylodBundleIdentity\\s*=\\s*\"([^\"]+)\"")

    /**
     * A served bundle MATCHES the expected one when either is a prefix of
     * the other: the expected suffix is the short CI sha while a server may
     * report the full 40-char commit (and vice versa). Null/empty served
     * bundle never matches.
     */
    private fun bundleMatches(served: String?, expected: String): Boolean {
        if (served.isNullOrEmpty() || expected.isEmpty()) return false
        return served.startsWith(expected) || expected.startsWith(served)
    }

    /**
     * A candidate is GENUINE when /api/app/version answers 2xx with a JSON
     * body that reports a non-empty bundle commit (PROVENANCE.md §3 — a
     * genuine Zylod server always identifies the web bundle it serves).
     *
     * t241: for genuine hosts the probe ALSO reads the bundle identity the
     * server serves in its HTML shell (GET "/", short timeout — see
     * [fetchServedBundleIdentity] and [ProbeResult.servedBundle]). Any
     * failure there degrades to null and can never throw out of [probe].
     */
    private fun probe(endpoint: String): ProbeResult = try {
        probeClient.newCall(
            Request.Builder()
                .url(endpoint.removeSuffix("/") + "/api/app/version")
                .header("User-Agent", "ZylodNative/${BuildConfig.VERSION_NAME}")
                .build()
        ).execute().use { response ->
            var servedCommit = ""
            if (response.isSuccessful) {
                servedCommit = runCatching {
                    val json = JSONObject(response.peekBody(64_000).string())
                    val bundle = json.optJSONObject("bundle")
                    bundle?.optString("commit", "")?.trim() ?: ""
                }.getOrDefault("")
            }
            val servedBundle = if (servedCommit.isEmpty()) {
                null
            } else {
                runCatching { fetchServedBundleIdentity(endpoint) }.getOrNull()
            }
            ProbeResult(
                alive = true,
                httpStatus = response.code,
                zylodPayload = servedCommit.isNotEmpty(),
                servedCommit = servedCommit,
                servedBundle = servedBundle,
            )
        }
    } catch (_: Exception) {
        ProbeResult(alive = false, httpStatus = null, zylodPayload = false, servedCommit = "")
    }

    /**
     * t241 — GET "<base>/" and extract the window.__ZylodBundleIdentity the
     * server actually serves (inline <head> script, web/src/app/layout.tsx).
     * Returns null when the identity cannot be read; never throws (callers
     * wrap it in runCatching anyway).
     */
    private fun fetchServedBundleIdentity(endpoint: String): String? {
        identityClient.newCall(
            Request.Builder()
                .url(endpoint.removeSuffix("/") + "/")
                .header("User-Agent", "ZylodNative/${BuildConfig.VERSION_NAME}")
                .build()
        ).execute().use { response ->
            if (!response.isSuccessful) return null
            val html = response.peekBody(HTML_SHELL_PEEK_BYTES).string()
            val commit = SHELL_BUNDLE_OBJECT.find(html)?.groupValues?.get(1)?.trim()
                ?: SHELL_BUNDLE_STRING.find(html)?.groupValues?.get(1)?.trim()
            return commit?.takeIf { it.isNotEmpty() }
        }
    }
}
