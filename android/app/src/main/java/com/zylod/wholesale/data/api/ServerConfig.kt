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
 *  - SELECTION: the first candidate IN THE FROZEN ORDER that is genuine wins.
 *    A host that answers but serves no Zylod bundle identity (redirect stub,
 *    captive portal, 404) is skipped and logged — it can no longer beat a
 *    genuine server further down the list. Only when NO candidate is genuine
 *    does discovery fall back (first-alive → cache → first), with the reason
 *    logged and the provenance gate expected to refuse the non-Zylod responder;
 *  - an endpoint change between resolves is logged prominently — endpoint
 *    switching is never silent (owner hard rule);
 *  - the full probe matrix (endpoint → status → served bundle) is logged so
 *    `adb logcat -s ZylodProvenance` alone answers "exact build → exact web
 *    source → exact web bundle commit".
 */
object ServerConfig {
    private const val PREFS = "zylod_config"
    private const val KEY_BASE = "native_base_url"
    private const val PROBE_BUDGET_MS = 4_000L

    /** Result of probing ONE candidate endpoint. */
    data class ProbeResult(
        val alive: Boolean,
        val httpStatus: Int?,
        /** true when the responder is a genuine Zylod server: 2xx /api/app/version body reporting a bundle identity. */
        val zylodPayload: Boolean,
        /** The bundle commit the endpoint reports (diagnostics; "" when absent). */
        val servedCommit: String,
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
                Log.i(
                    WebProvenance.LOG_TAG,
                    "probe endpoint=$endpoint status=$status zylodPayload=${result.zylodPayload} " +
                        "servedBundle=$served alive=${result.alive}",
                )
            }

            // SELECTION (owner deployment order): the first GENUINE Zylod
            // server in the frozen candidate order wins. A responder without
            // a bundle identity can never beat a genuine server further down
            // the list.
            val genuine = candidates.firstOrNull { results[it]?.zylodPayload == true }
            val firstAlive = candidates.firstOrNull { results[it]?.alive == true }
            val previous = cached(context)
            val chosen = genuine ?: firstAlive ?: previous ?: candidates.first()
            val reason = when {
                genuine != null -> "first-genuine-zylod-in-order"
                firstAlive != null -> "no-genuine-endpoint-first-alive(gate-will-refuse)"
                previous != null -> "all-dead-cache-fallback"
                else -> "all-dead-default-first"
            }
            if (previous != null && previous != chosen) {
                Log.w(WebProvenance.LOG_TAG, "ENDPOINT CHANGED $previous -> $chosen (reason=$reason)")
            }
            Log.i(WebProvenance.LOG_TAG, "selected endpoint=$chosen reason=$reason")
            prefs.edit().putString(KEY_BASE, chosen).apply()
            chosen
        }
    }

    private val probeClient = OkHttpClient.Builder()
        .connectTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .readTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .build()

    /**
     * A candidate is GENUINE when /api/app/version answers 2xx with a JSON
     * body that reports a non-empty bundle commit (PROVENANCE.md §3 — a
     * genuine Zylod server always identifies the web bundle it serves).
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
            ProbeResult(
                alive = true,
                httpStatus = response.code,
                zylodPayload = servedCommit.isNotEmpty(),
                servedCommit = servedCommit,
            )
        }
    } catch (_: Exception) {
        ProbeResult(alive = false, httpStatus = null, zylodPayload = false, servedCommit = "")
    }
}
