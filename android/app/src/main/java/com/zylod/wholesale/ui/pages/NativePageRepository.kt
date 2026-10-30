package com.zylod.wholesale.ui.pages

import android.content.Context
import android.util.Log
import com.zylod.wholesale.BuildConfig
import com.zylod.wholesale.data.api.ApiClient
import com.zylod.wholesale.data.api.ServerConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request

/**
 * t233 — the one data pipeline behind every generated native page.
 *
 * Load order (owner offline contract — "offline shows last-saved content,
 * never white"):
 *  1. LIVE — GET {server}/{endpoint} through the shared OkHttp client (auth +
 *     401-refresh come free from ApiClient), parsed per [NativePageKind];
 *     success writes [NativePageCache] for the next offline visit.
 *  2. CACHE — last-saved [NativePageData] for this pageId.
 *  3. SEED — the page's curated Kotlin metadata (never a blank body).
 *
 * Endpoint-less ([NativePageKind.CONTENT]) pages skip straight to SEED: they
 * have nothing honest to fetch, so there is no spinner and no error path.
 */
object NativePageRepository {

    private const val TAG = "ZylodNativePages"

    data class Result(
        val data: NativePageData?,
        val source: NativePageSource,
        /** Degrade notice when [source] != LIVE (banner copy); null when live. */
        val notice: String?,
    )

    suspend fun load(context: Context, meta: NativePageMeta, query: String): Result {
        val endpoint = NativePageContent.buildEndpoint(meta, query)
        if (endpoint == null) {
            return Result(NativePageContent.seedFor(meta), NativePageSource.SEED, null)
        }
        return try {
            val base = ServerConfig.resolve(context)
            val url = base.trimEnd('/') + "/" + endpoint
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "ZylodNative/${BuildConfig.VERSION_NAME}")
                .build()
            // Explicit Pair type: without it the lambda's branches (Pair vs bare
            // String?) unify to Serializable? and the destructuring below fails.
            val payload: Pair<String?, String?> = withContext(Dispatchers.IO) {
                ApiClient.okHttpClient().newCall(request).execute().use { response ->
                    val body = response.body?.string()
                    if (!response.isSuccessful) {
                        return@withContext null to "Server error (HTTP ${response.code}) while loading ${meta.title}."
                    }
                    body to null
                }
            }
            val (body, error) = payload
            if (body == null) return degraded(context, meta, error ?: "Could not load ${meta.title}.")
            val data = runCatching { NativePageContent.parseEndpointPayload(meta, body) }
                .onFailure { Log.w(TAG, "parse failed (${meta.pageId}): ${it.message}") }
                .getOrNull()
            if (data == null) {
                return degraded(context, meta, "Unexpected response from ${endpoint.substringBefore('?')}.")
            }
            NativePageCache.write(context, meta.pageId, data)
            Result(data, NativePageSource.LIVE, null)
        } catch (ce: CancellationException) {
            throw ce
        } catch (_: Exception) {
            degraded(context, meta, "Network error — check your connection and retry.")
        }
    }

    private suspend fun degraded(context: Context, meta: NativePageMeta, message: String): Result {
        NativePageCache.read(context, meta.pageId)?.let { saved ->
            return Result(saved, NativePageSource.CACHE, "You're offline — showing your last saved ${meta.title}.")
        }
        // t233 OfflineCatalogSupport extension: product-shaped pages fall back
        // to the Room offline catalog (real rows synced by
        // syncOfflineProductCache) before curated content.
        if (meta.kind == NativePageKind.PRODUCTS) {
            val offline = com.zylod.wholesale.ui.web.OfflineCatalogSupport.cachedOfflineProducts()
            if (offline.isNotEmpty()) {
                val cards = offline.map { row ->
                    NativePageCard(
                        id = row.id,
                        title = row.title,
                        subtitle = listOfNotNull(row.supplierName, row.categoryName).joinToString(" • ").ifBlank { null },
                        priceLabel = NativePageContent.formatBdt(row.priceBDT),
                        badge = "MOQ ${row.minOrderQuantity}",
                        imageUrl = row.imageUrl,
                        targetPageId = "product-detail",
                        targetQuery = "productId=${row.id}",
                    )
                }
                val data = NativePageData(
                    title = meta.title,
                    subtitle = "Offline catalog — ${cards.size} products last synced on this device",
                    sections = listOf(
                        NativePageSection("products", "Products", NativeSectionStyle.CARDS, "No products cached yet.", cards),
                    ),
                )
                return Result(data, NativePageSource.CACHE, "You're offline — showing the catalog synced on this device.")
            }
        }
        return Result(NativePageContent.seedFor(meta), NativePageSource.SEED, message)
    }
}
