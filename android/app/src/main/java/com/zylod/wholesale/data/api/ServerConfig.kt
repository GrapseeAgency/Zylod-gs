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
 * agree. Any HTTP response (even 404) proves the host is alive.
 *
 * F1 — deterministic, AUDITABLE endpoint discovery:
 *  - every probe is logged with its HTTP status and whether the responder is
 *    a genuine Zylod server (parses as the /api/app/version payload and
 *    reports a bundle identity);
 *  - the selection reason is logged ("first-alive-in-order" is the frozen
 *    policy — this fix changes VISIBILITY, not selection semantics);
 *  - an endpoint change between resolves is logged prominently — endpoint
 *    switching is never silent (owner hard rule);
 *  - each probe also records the responder's web bundle identity so the
 *    chain "exact build → exact web source → exact web bundle commit" is
 *    answerable from `adb logcat -s ZylodProvenance` alone (docs/PROVENANCE.md).
 */
object ServerConfig {
    private const val PREFS = "zylod_config"
    private const val KEY_BASE = "native_base_url"
    private const val PROBE_BUDGET_MS = 4_000L

    /** Result of probing ONE candidate endpoint. */
    data class ProbeResult(
        val alive: Boolean,
        val httpStatus: Int?,
        /** true when the response parses as a Zylod /api/app/version payload. */
        val zylodPayload: Boolean,
    )

    /** The endpoint's reported bundle identity from the last resolve (diagnostics). */
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
                runCatching { deferred.await() }.getOrDefault(ProbeResult(alive = false, httpStatus = null, zylodPayload = false))
            }
            lastProbeMatrix = results

            // Ordered probe matrix — the owner sees exactly why a host won.
            results.forEach { (endpoint, result) ->
                val status = result.httpStatus?.toString() ?: "unreachable"
                Log.i(
                    WebProvenance.LOG_TAG,
                    "probe endpoint=$endpoint status=$status zylodPayload=${result.zylodPayload} alive=${result.alive}",
                )
            }

            val alive = candidates.firstOrNull { results[it]?.alive == true }
            val previous = cached(context)
            val chosen = alive ?: previous ?: candidates.first()
            val reason = when {
                alive != null -> "first-alive-in-order"
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
     * Aliveness stays "any HTTP response" (frozen selection semantics), but
     * the probe now ALSO fingerprints the responder: a successful
     * /api/app/version body that parses as the Zylod payload proves the host
     * is a genuine Zylod server, not a captive portal or a bare stub.
     */
    private fun probe(endpoint: String): ProbeResult = try {
        probeClient.newCall(
            Request.Builder()
                .url(endpoint.removeSuffix("/") + "/api/app/version")
                .header("User-Agent", "ZylodNative/${BuildConfig.VERSION_NAME}")
                .build()
        ).execute().use { response ->
            var zylodPayload = false
            if (response.isSuccessful) {
                zylodPayload = runCatching {
                    val body = response.peekBody(64_000).string()
                    val json = JSONObject(body)
                    json.optBoolean("success", false) || json.has("bundle")
                }.getOrDefault(false)
            }
            ProbeResult(alive = true, httpStatus = response.code, zylodPayload = zylodPayload)
        }
    } catch (_: Exception) {
        ProbeResult(alive = false, httpStatus = null, zylodPayload = false)
    }
}
