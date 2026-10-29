package com.zylod.wholesale.ui.pages

import android.content.Context
import android.util.Log
import com.zylod.wholesale.data.api.ApiClient

/**
 * t233 — on-device saved native pages.
 *
 * The offline contract every generated screen inherits (owner order:
 * "offline shows last-saved content, never white"): after EVERY successful
 * live fetch the repository writes the rendered [NativePageData] here; on the
 * next failed/offline load the page renders exactly what the user last saw,
 * byte-consistent with the online render, with an honest "last saved" banner.
 *
 * Storage follows the DealsCacheStore convention: the shared `zylod_config`
 * prefs file, one namespaced key per pageId, payload = kotlinx-serialization
 * JSON through the app-wide [ApiClient.json] instance.
 */
object NativePageCache {

    private const val TAG = "ZylodNativePages"
    private const val PREFS = "zylod_config"
    private const val KEY_PREFIX = "native_page_cache_"

    private fun keyFor(pageId: String): String = KEY_PREFIX + pageId.replace(Regex("[^a-z0-9-]"), "_")

    fun read(context: Context, pageId: String): NativePageData? = runCatching {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(keyFor(pageId), null) ?: return null
        ApiClient.json.decodeFromString(NativePageData.serializer(), raw)
    }.onFailure { Log.w(TAG, "page cache read failed ($pageId): ${it.message}") }.getOrNull()

    fun write(context: Context, pageId: String, data: NativePageData) {
        runCatching {
            val raw = ApiClient.json.encodeToString(NativePageData.serializer(), data)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(keyFor(pageId), raw)
                .apply()
        }.onFailure { Log.w(TAG, "page cache write failed ($pageId): ${it.message}") }
    }

    /** Diagnostics/support helper: how many native pages have saved content. */
    fun cachedPageCount(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).all.keys.count { it.startsWith(KEY_PREFIX) }
}
