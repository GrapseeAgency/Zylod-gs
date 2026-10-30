package com.zylod.wholesale.ui.pages

import android.net.Uri
import com.zylod.wholesale.data.api.ServerConfig
import com.zylod.wholesale.ZylodApp
import org.json.JSONArray
import org.json.JSONObject

/**
 * t233 — page-content brain: endpoint building, generic wire parsing and the
 * curated seed content for endpoint-less pages.
 *
 * PARSING (per [NativePageKind]) is deliberately org.json + tolerant, exactly
 * like OfflineCatalogSupport: any shape drift degrades that section to empty
 * instead of failing the page parse (the screen then shows its saved cache or
 * curated content — never a crash, never a white screen).
 */
object NativePageContent {

    /** Price formatter — BDT, whole taka without decimals (OrdersScreen convention). */
    fun formatBdt(value: Double): String =
        if (value % 1.0 == 0.0) "৳" + java.text.NumberFormat.getIntegerInstance().format(value.toLong())
        else "৳" + String.format(java.util.Locale.US, "%.2f", value)

    /**
     * Relative image path ("/images/…") → absolute against the persisted
     * server base; absolute URLs pass through; null when unresolvable
     * (caller renders the letter avatar).
     */
    fun absoluteImageUrl(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
        if (!raw.startsWith("/")) return null
        val base = ServerConfig.cached(ZylodApp.instance) ?: return null
        return base.trimEnd('/') + raw
    }

    /**
     * The endpoint actually requested, with the navigation query folded in
     * (web contract, src/app/api/products/route.ts): `search=` for typed
     * queries, `category=` for category slugs, plus clearance/seasonal flags
     * baked into the page metadata's endpoint itself.
     */
    fun buildEndpoint(meta: NativePageMeta, query: String): String? {
        val base = meta.endpoint ?: return null
        if (meta.kind != NativePageKind.PRODUCTS) return base
        val extras = StringBuilder()
        query.split('&').filter { it.contains('=') }.forEach { pair ->
            val name = pair.substringBefore('=')
            val value = Uri.decode(pair.substringAfter('=', ""))
            when (name) {
                "q", "search" -> if (value.isNotBlank()) extras.append("&search=").append(Uri.encode(value))
                "categoryId", "category", "categorySlug" -> if (value.isNotBlank()) extras.append("&category=").append(Uri.encode(value))
                "brand" -> if (value.isNotBlank()) extras.append("&brand=").append(Uri.encode(value))
            }
        }
        return if (extras.isEmpty()) base else base + extras
    }

    /** Human source line shown under the page title (provenance, honest). */
    fun sourceLine(meta: NativePageMeta): String {
        // Local val: meta.endpoint is an abstract (custom-getter) property, so a
        // null-check on it can never smart-cast — snapshot it first.
        val endpoint = meta.endpoint
        return when {
            endpoint == null -> "Curated native page — ${meta.category}"
            else -> "Live from ${endpoint.substringBefore('?')} · ${meta.category}"
        }
    }

    // ── Live payload parsing ────────────────────────────────────────────

    /** Parses the endpoint body into a renderable [NativePageData]; null = unusable shape. */
    fun parseEndpointPayload(meta: NativePageMeta, body: String): NativePageData? {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        return when (meta.kind) {
            NativePageKind.PRODUCTS -> parseProducts(meta, json)
            NativePageKind.SUPPLIERS -> parseSuppliers(meta, json)
            NativePageKind.ORDERS -> parseOrders(meta, json)
            NativePageKind.DEALS -> parseDeals(meta, json)
            NativePageKind.CATEGORIES -> parseCategories(meta, json)
            NativePageKind.WISHLIST -> parseWishlist(meta, json)
            NativePageKind.NOTIFICATIONS -> parseNotifications(meta, json)
            NativePageKind.CONTENT -> null
        }
    }

    /** Envelope-agnostic row array: `data` array, `data.banners`, bare array, or `{rows:[…]}`. */
    private fun rowsOf(json: JSONObject): JSONArray? {
        val data = json.opt("data")
        return when (data) {
            is JSONArray -> data
            is JSONObject -> data.optJSONArray("banners")
                ?: data.optJSONArray("orders")
                ?: data.optJSONArray("items")
                ?: data.optJSONArray("rows")
            else -> null
        } ?: json.optJSONArray("rows")
    }

    private fun JSONArray.rowObjects(): List<JSONObject> {
        val out = mutableListOf<JSONObject>()
        for (i in 0 until length()) optJSONObject(i)?.let { out.add(it) }
        return out
    }

    private fun JSONObject.str(vararg keys: String): String? {
        for (key in keys) {
            val value = optString(key, "").trim()
            if (value.isNotEmpty() && value != "null") return value
        }
        return null
    }

    private fun JSONObject.num(vararg keys: String): Double? {
        for (key in keys) {
            val value = optDouble(key, Double.NaN)
            if (!value.isNaN()) return value
        }
        return null
    }

    private fun parseProducts(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val id = row.str("id") ?: return@mapIndexedNotNull null
            val title = row.str("name", "title") ?: return@mapIndexedNotNull null
            val price = row.num("basePrice", "price", "dealPrice") ?: 0.0
            val supplier = row.optJSONObject("supplier")?.str("companyName") ?: row.str("supplierName")
            val category = row.optJSONObject("category")?.str("name") ?: row.str("categoryName")
            val moq = row.optInt("moq", row.optInt("minOrderQuantity", 1))
            NativePageCard(
                id = id,
                title = title,
                subtitle = listOfNotNull(supplier, category).joinToString(" • ").ifBlank { null },
                priceLabel = formatBdt(price),
                badge = "MOQ $moq",
                imageUrl = row.str("thumbnailUrl", "imageUrl", "image"),
                targetPageId = "product-detail",
                targetQuery = "productId=$id",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${cards.size} live product${if (cards.size == 1) "" else "s"} from the Zylod catalog",
            sections = listOf(
                NativePageSection(
                    id = "products",
                    title = "Products",
                    style = NativeSectionStyle.CARDS,
                    emptyText = "No products matched this page yet.",
                    cards = cards,
                ),
            ),
        )
    }

    private fun parseSuppliers(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val name = row.str("companyName", "company", "name") ?: return@mapIndexedNotNull null
            val id = row.str("id") ?: "supplier-$index"
            val products = row.optInt("productCount", row.optInt("totalProducts", 0))
            val verified = row.optBoolean("isVerified", row.optBoolean("verified", false))
            NativePageCard(
                id = id,
                title = name,
                subtitle = row.str("city", "country", "location"),
                detail = row.str("businessType", "description"),
                badge = if (verified) "Verified" else null,
                priceLabel = if (products > 0) "$products products" else null,
                targetPageId = "store-page",
                targetQuery = "supplierId=$id",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${cards.size} supplier${if (cards.size == 1) "" else "s"} on the directory",
            sections = listOf(
                NativePageSection("suppliers", "Suppliers", NativeSectionStyle.ROWS, "No suppliers listed yet.", cards),
            ),
        )
    }

    private fun parseOrders(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val id = row.str("id", "orderNumber") ?: return@mapIndexedNotNull null
            val status = row.str("status")?.lowercase()?.replaceFirstChar { it.uppercase() }
            val total = row.num("totalAmount", "total", "grandTotal")
            NativePageCard(
                id = id,
                title = "Order ${row.str("orderNumber") ?: id.takeLast(8)}",
                subtitle = row.str("createdAt", "placedAt"),
                detail = row.str("paymentStatus", "fulfillmentStatus"),
                priceLabel = total?.let(::formatBdt),
                badge = status,
                targetPageId = "order-detail",
                targetQuery = "orderId=${row.str("id") ?: id}",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = if (cards.size == 1) "1 order on file" else "${cards.size} orders on file",
            sections = listOf(
                NativePageSection("orders", "Orders", NativeSectionStyle.ROWS, "No orders yet — your purchases will appear here.", cards),
            ),
        )
    }

    private fun parseDeals(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val data = json.optJSONObject("data") ?: return null
        fun dealCards(array: JSONArray?, prefix: String): List<NativePageCard> =
            array?.rowObjects().orEmpty().mapIndexedNotNull { index, row ->
                val productId = row.str("productId") ?: row.optJSONObject("product")?.str("id") ?: return@mapIndexedNotNull null
                val name = row.str("productName") ?: row.optJSONObject("product")?.str("name") ?: return@mapIndexedNotNull null
                val price = row.num("dealPrice") ?: row.num("originalPrice") ?: return@mapIndexedNotNull null
                val discount = row.num("discountPercent")
                NativePageCard(
                    id = "$prefix-${row.str("id") ?: productId}",
                    title = name,
                    subtitle = row.str("supplierName", "categoryName"),
                    priceLabel = formatBdt(price),
                    badge = discount?.takeIf { it >= 0.5 }?.let { "-${it.toInt()}%" },
                    imageUrl = row.str("productThumbnail"),
                    targetPageId = "product-detail",
                    targetQuery = "productId=$productId",
                )
            }
        val flash = dealCards(data.optJSONArray("flashDeals"), "flash")
        val daily = dealCards(data.optJSONArray("dailyDeals"), "daily")
        if (flash.isEmpty() && daily.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${flash.size} flash • ${daily.size} daily deals live now",
            sections = buildList {
                if (flash.isNotEmpty()) add(NativePageSection("flash", "Flash Deals", NativeSectionStyle.CARDS, "No flash deals live.", flash))
                if (daily.isNotEmpty()) add(NativePageSection("daily", "Daily Deals", NativeSectionStyle.CARDS, "No daily deals today.", daily))
            },
        )
    }

    private fun parseCategories(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val name = row.str("name") ?: return@mapIndexedNotNull null
            val slug = row.str("slug") ?: name.lowercase().replace(' ', '-')
            val products = row.optInt("productCount", 0)
            NativePageCard(
                id = row.str("id") ?: "cat-$slug",
                title = name,
                subtitle = if (products > 0) "$products products" else "Browse products",
                targetPageId = "category-products",
                targetQuery = "category=$slug",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${cards.size} categories open for wholesale trade",
            sections = listOf(
                NativePageSection("categories", "Categories", NativeSectionStyle.CHIPS, "No categories published yet.", cards),
            ),
        )
    }

    private fun parseWishlist(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val product = row.optJSONObject("product") ?: row
            val id = product.str("id") ?: return@mapIndexedNotNull null
            val title = product.str("name", "title") ?: return@mapIndexedNotNull null
            val price = product.num("basePrice", "price")
            NativePageCard(
                id = id,
                title = title,
                subtitle = product.optJSONObject("supplier")?.str("companyName"),
                priceLabel = price?.let(::formatBdt),
                imageUrl = product.str("thumbnailUrl", "imageUrl"),
                badge = row.str("addedAt", "createdAt"),
                targetPageId = "product-detail",
                targetQuery = "productId=$id",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${cards.size} saved item${if (cards.size == 1) "" else "s"}",
            sections = listOf(
                NativePageSection("wishlist", "Saved items", NativeSectionStyle.CARDS, "Nothing saved yet.", cards),
            ),
        )
    }

    private fun parseNotifications(meta: NativePageMeta, json: JSONObject): NativePageData? {
        val rows = rowsOf(json)?.rowObjects() ?: return null
        val cards = rows.mapIndexedNotNull { index, row ->
            val id = row.str("id") ?: return@mapIndexedNotNull null
            val title = row.str("title") ?: return@mapIndexedNotNull null
            val unread = !row.optBoolean("isRead", true)
            NativePageCard(
                id = id,
                title = title,
                subtitle = row.str("message", "body"),
                detail = row.str("timestamp", "createdAt"),
                badge = row.str("type")?.lowercase()?.replaceFirstChar { it.uppercase() },
                targetPageId = "notifications",
            )
        }
        if (cards.isEmpty()) return null
        return NativePageData(
            title = meta.title,
            subtitle = "${cards.size} notification${if (cards.size == 1) "" else "s"} in your feed",
            sections = listOf(
                NativePageSection("notifications", "Notifications", NativeSectionStyle.ROWS, "No notifications yet.", cards),
            ),
        )
    }

    // ── Curated seed content (endpoint-less pages / nothing saved yet) ──

    /**
     * Builds the page's honest on-device content from its Kotlin metadata:
     * an about card (summary), key-fact bullets, and related native pages.
     * No server data is invented — this is the page's own documentation.
     */
    fun seedFor(meta: NativePageMeta): NativePageData {
        val sections = mutableListOf<NativePageSection>()
        sections.add(
            NativePageSection(
                id = "about",
                title = "About this page",
                style = NativeSectionStyle.INFO,
                cards = listOf(
                    NativePageCard(id = "about-summary", title = meta.title, subtitle = meta.summary),
                ),
            ),
        )
        if (meta.bullets.isNotEmpty()) {
            sections.add(
                NativePageSection(
                    id = "facts",
                    title = "Key facts",
                    style = NativeSectionStyle.INFO,
                    cards = meta.bullets.mapIndexed { index, line ->
                        NativePageCard(id = "fact-$index", title = line)
                    },
                ),
            )
        }
        if (meta.related.isNotEmpty()) {
            sections.add(
                NativePageSection(
                    id = "related",
                    title = "Related native pages",
                    style = NativeSectionStyle.CHIPS,
                    emptyText = "No related pages.",
                    cards = meta.related.map { link ->
                        NativePageCard(id = "link-${link.pageId}", title = link.label, targetPageId = link.pageId)
                    },
                ),
            )
        }
        return NativePageData(
            title = meta.title,
            subtitle = "Fully native Kotlin screen · ${meta.category}",
            sections = sections,
        )
    }
}
