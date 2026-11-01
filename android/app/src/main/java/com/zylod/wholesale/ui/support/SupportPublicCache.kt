package com.zylod.wholesale.ui.support

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.SupportArticleDto
import com.zylod.wholesale.data.api.SupportDiagnosticsEnvelope
import com.zylod.wholesale.data.api.SupportFaqDto
import com.zylod.wholesale.data.api.SupportStatusDto
import com.zylod.wholesale.data.api.SupportTocSectionDto
import kotlinx.serialization.KSerializer

/**
 * Offline snapshots for the t255 support surfaces — the SAME SharedPreferences
 * file the rest of the native shell uses ("zylod_config", the t253
 * AddressCacheStore / t254 ReviewsCacheStore idiom) under three keys:
 *
 *  - native_support_faq_cache  — the last successful GET api/support/faqs
 *    rows (the faq-page render offline, all categories: the saved snapshot
 *    is whatever the last fetch brought back).
 *  - native_support_docs_cache — the docs browser's sidebar TOC + the
 *    last successfully opened article (both halves of the screen).
 *  - native_support_status_cache — the helpdesk banner payload
 *    (api/support/status) + the service-status screen's live probes
 *    (api/app/diagnostics); both ids share the ONE status snapshot.
 *
 * Failures never throw — a corrupt entry reads as absent so every screen
 * falls through to its honest error state.
 */

/** The device-saved support payload keys — SharedPreferences "zylod_config". */
internal object SupportPublicCacheKeys {
    const val PREFS = "zylod_config"
    const val FAQ = "native_support_faq_cache"
    const val DOCS = "native_support_docs_cache"
    const val STATUS = "native_support_status_cache"
}

/** faq-page snapshot — the raw wire rows (offline render matches live). */
@kotlinx.serialization.Serializable
data class CachedSupportFaqs(val rows: List<SupportFaqDto> = emptyList())

/** docs-page snapshot — the sidebar TOC plus the last opened article. */
@kotlinx.serialization.Serializable
data class CachedSupportDocs(
    val toc: List<SupportTocSectionDto> = emptyList(),
    val article: SupportArticleDto? = null,
)

/** service-status / system-health snapshot — banner payload + live probes. */
@kotlinx.serialization.Serializable
data class CachedSupportStatus(
    val status: SupportStatusDto? = null,
    val diagnostics: SupportDiagnosticsEnvelope? = null,
)

/** Generic typed prefs store (ReviewsCacheStore clone, support keys). */
internal object SupportPublicCacheStore {
    private const val TAG = "ZylodSupport"

    fun <T> read(context: Context, key: String, serializer: KSerializer<T>): T? = runCatching {
        val raw = context.getSharedPreferences(SupportPublicCacheKeys.PREFS, Context.MODE_PRIVATE)
            .getString(key, null) ?: return null
        ApiClient.json.decodeFromString(serializer, raw)
    }.onFailure { Log.w(TAG, "support cache read failed: ${it.message}") }.getOrNull()

    fun <T> write(context: Context, key: String, serializer: KSerializer<T>, value: T) {
        runCatching {
            val raw = ApiClient.json.encodeToString(serializer, value)
            context.getSharedPreferences(SupportPublicCacheKeys.PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(key, raw)
                .apply()
        }.onFailure { Log.w(TAG, "support cache write failed: ${it.message}") }
    }
}
