package com.zylod.wholesale.ui.web

import android.content.Context
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.zylod.wholesale.ZylodApp
import com.zylod.wholesale.data.model.OfflineProduct
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * t227 — OFFLINE CONTRACT for the WebView surfaces.
 *
 * Owner order: the app must never dead-end on "Can't reach Zylod" when it
 * holds real data. Two halves:
 *
 *  1. [syncOfflineProductCache] — the NATIVE side self-populates the Room
 *     offline cache. Until now the cache was only written when the WEB page
 *     chose to call the JS bridge (cacheOfflineProducts); on a page that
 *     never loaded, the cache stayed empty forever. Now every AUTHORITATIVE
 *     reveal (provenance-verified page) also fires a throttled native fetch
 *     of /api/products into the same Room table. First successful online
 *     session ⇒ real, device-local data.
 *
 *  2. [OfflineCatalogScreen] — when the server is unreachable AND the cache
 *     holds rows, the error branch renders the CACHED CATALOG instead of an
 *     empty cloud icon. Every row shown is a REAL product fetched while
 *     online; the header says exactly that. No fabricated content — with an
 *     empty cache the plain error state remains.
 */
object OfflineCatalogSupport {

    private const val TAG = "ZylodOffline"
    private const val PREFS = "zylod_config"
    private const val KEY_LAST_SYNC = "offline_products_last_sync_ms"
    /** At most one native cache refresh per 10 minutes per process lifetime. */
    private const val MIN_SYNC_INTERVAL_MS = 10 * 60 * 1000L

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .build()

    /**
     * Fire-and-forget: fetch the first catalog page from [baseUrl] and merge
     * it into the Room offline cache. Never throws; never touches the UI.
     * Throttled by [MIN_SYNC_INTERVAL_MS].
     */
    fun syncOfflineProductCache(context: Context, baseUrl: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val last = prefs.getLong(KEY_LAST_SYNC, 0L)
        if (now - last < MIN_SYNC_INTERVAL_MS) return
        prefs.edit().putLong(KEY_LAST_SYNC, now).apply()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = baseUrl.trimEnd('/') + "/api/products?limit=60&page=1"
                val body = client.newCall(
                    Request.Builder()
                        .url(url)
                        .header("User-Agent", "ZylodNative/2.4.5")
                        .build()
                ).execute().use { resp ->
                    if (!resp.isSuccessful) return@launch
                    resp.body?.string() ?: return@launch
                }
                val data = JSONObject(body).optJSONArray("data") ?: return@launch
                val rows = data.toOfflineProducts()
                if (rows.isEmpty()) return@launch
                ZylodApp.instance.database.productDao().insertAll(rows)
                Log.i(TAG, "offline cache refreshed rows=${rows.size}")
            } catch (e: Exception) {
                // Cache maintenance is best-effort; never surface or crash.
                Log.w(TAG, "offline cache refresh failed: ${e.message}")
            }
        }
    }

    /** Maps /api/products rows onto the offline cache entity, tolerating shape drift. */
    private fun JSONArray.toOfflineProducts(): List<OfflineProduct> {
        val result = mutableListOf<OfflineProduct>()
        for (i in 0 until length()) {
            val obj = optJSONObject(i) ?: continue
            val id = obj.optString("id")
            val title = obj.optString("name").ifEmpty { obj.optString("title") }
            if (id.isEmpty() || title.isEmpty()) continue
            val basePrice = obj.optDouble("basePrice", Double.NaN).takeIf { !it.isNaN() }
                ?: obj.optDouble("price", 0.0)
            val supplier = obj.optJSONObject("supplier")
            val category = obj.optJSONObject("category")
            result.add(
                OfflineProduct(
                    id = id,
                    title = title,
                    slug = obj.optString("slug").ifEmpty { id },
                    priceBDT = basePrice,
                    minOrderQuantity = obj.optInt("moq", obj.optInt("minOrderQuantity", 1)),
                    supplierName = supplier?.optString("companyName")?.ifEmpty { null }
                        ?: obj.optString("supplierName").ifEmpty { null },
                    imageUrl = obj.optString("thumbnailUrl").ifEmpty { null }
                        ?: obj.optString("imageUrl").ifEmpty { null },
                    categoryName = category?.optString("name")?.ifEmpty { null }
                        ?: obj.optString("categoryName").ifEmpty { null },
                    stock = obj.optInt("stockQuantity", obj.optInt("stock", 0)),
                    unit = obj.optString("unit").ifEmpty { "pcs" }
                )
            )
        }
        return result
    }
}

/**
 * Offline state WITH real cached data: the last synced catalog, rendered
 * natively. Honest copy — "last synced", not live. Retry stays primary.
 */
@Composable
fun OfflineCatalogScreen(products: List<OfflineProduct>, onRetry: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .padding(top = 24.dp),
    ) {
        Icon(
            Icons.Outlined.CloudOff,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(36.dp),
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "You're offline",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Showing your last synced catalog — ${products.size} product${if (products.size == 1) "" else "s"}. " +
                "Prices and stock are as of the last sync.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp),
        )
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(50),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ),
            modifier = Modifier.fillMaxWidth(0.6f),
        ) {
            Text("Retry", fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(16.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f))
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(products, key = { it.id }) { product ->
                OfflineProductRow(product)
            }
        }
    }
}

@Composable
private fun OfflineProductRow(product: OfflineProduct) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            if (product.imageUrl.isNullOrBlank()) {
                Text(
                    product.title.take(1).uppercase(),
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(product.imageUrl)
                        .crossfade(200)
                        .build(),
                    contentDescription = product.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                product.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                buildString {
                    product.categoryName?.let { append("$it · ") }
                    append("MOQ ${product.minOrderQuantity} ${product.unit}")
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            product.supplierName?.let {
                Spacer(Modifier.height(2.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(
                "৳%,.0f".format(product.priceBDT),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 14.sp,
            )
            Text(
                "per ${product.unit}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
