package com.zylod.wholesale.util

import android.content.Context

/**
 * t279 — bounded per-entity offline caches.
 *
 * Several features persist one prefs key PER ENTITY ever viewed:
 * `native_dm_thread_cache_<conversationId>`, `native_invoice_detail_cache_<orderId>`,
 * `native_tx_detail_cache_<id>`, `native_supplier_core_supplier-listing_<supplierId>_cache`,
 * `native_page_cache_<pageId>`, `native_blog_post_cache_`, `native_complaint_detail_cache_`,
 * `native_job_detail_cache_`, `native_press_release_cache_`. Nothing ever evicted
 * them: SharedPreferences rewrites the whole zylod_config XML per apply() and keeps
 * every string in RAM, so months of use grew the file without bound.
 *
 * [trimCacheKeys] keeps only the newest [keepN] keys under [prefix] (by
 * insertion/recency order — Android orders a prefs map by most recent write,
 * and each write site re-writes the key on every successful load, so the
 * newest keys are genuinely the most recently USED ones). Call it right after
 * a dynamic-suffix cache write.
 */
object CacheTrim {

    /** Keep only the newest [keepN] `prefix*` keys in the shared config prefs. */
    fun trim(context: Context, prefix: String, keepN: Int = 12) {
        runCatching {
            val prefs = context.getSharedPreferences("zylod_config", Context.MODE_PRIVATE)
            val keys = prefs.all.keys.filter { it.startsWith(prefix) }.toMutableList()
            if (keys.size <= keepN) return
            // SharedPreferences keeps its in-memory map in insertion order and
            // re-inserts a key on rewrite — the TAIL is the most recently
            // written/used set. Drop the oldest head entries beyond keepN.
            val doomed = keys.subList(0, keys.size - keepN)
            if (doomed.isNotEmpty()) {
                val editor = prefs.edit()
                doomed.forEach { editor.remove(it) }
                editor.apply()
            }
        }
    }
}
