package com.zylod.wholesale.data.api

import android.content.Context
import com.zylod.wholesale.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Resolves the active backend from BuildConfig.SERVER_ENDPOINTS (same list the
 * WebView shell probes) and caches it under the same prefs file so both shells
 * agree. Any HTTP response (even 404) proves the host is alive.
 */
object ServerConfig {
    private const val PREFS = "zylod_config"
    private const val KEY_BASE = "native_base_url"
    private const val PROBE_BUDGET_MS = 4_000L

    fun cached(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_BASE, null)

    suspend fun resolve(context: Context): String = withContext(Dispatchers.IO) {
        val candidates = BuildConfig.SERVER_ENDPOINTS.toList()
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        coroutineScope {
            val probes = candidates.associateWith { async { probe(it) } }
            val alive = probes.entries
                .sortedBy { candidates.indexOf(it.key) }
                .firstOrNull { runCatching { it.value.await() }.getOrDefault(false) }?.key
            val chosen = alive ?: cached(context) ?: candidates.first()
            prefs.edit().putString(KEY_BASE, chosen).apply()
            chosen
        }
    }

    private val probeClient = OkHttpClient.Builder()
        .connectTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .readTimeout(PROBE_BUDGET_MS, TimeUnit.MILLISECONDS)
        .build()

    private fun probe(endpoint: String): Boolean = try {
        probeClient.newCall(
            Request.Builder()
                .url(endpoint.removeSuffix("/") + "/api/app/version")
                .header("User-Agent", "ZylodNative/2.5.0")
                .build()
        ).execute().use { true } // any response counts
    } catch (_: Exception) {
        false
    }
}
