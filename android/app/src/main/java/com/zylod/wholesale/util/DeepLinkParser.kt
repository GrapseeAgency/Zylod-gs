package com.zylod.wholesale.util

import android.net.Uri

data class ParsedDeepLink(
    val targetPage: String,
    val params: Map<String, String> = emptyMap()
)

object DeepLinkParser {

    fun parse(uri: Uri?): ParsedDeepLink? {
        if (uri == null) return null

        val scheme = uri.scheme
        val host = uri.host
        val pathSegments = uri.pathSegments

        // Handle custom scheme: zylod://product/123 or zylod://deals
        if (scheme == "zylod") {
            val page = host ?: return null
            val id = pathSegments.firstOrNull()
            return when (page) {
                "product" -> ParsedDeepLink("product-detail", id?.let { mapOf("id" to it) } ?: emptyMap())
                // Web Round-1/2 audits retired supplier-storefront in favor of
                // seller-storefront (see page-routing-audit) — keep the scheme
                // pointed at the live pageId (D9 fix).
                "supplier" -> ParsedDeepLink("seller-storefront", id?.let { mapOf("id" to it) } ?: emptyMap())
                "deal" -> ParsedDeepLink("exclusive-deal-detail", id?.let { mapOf("id" to it) } ?: emptyMap())
                "cart" -> ParsedDeepLink("cart")
                // t203: native ORDERS screen owns pageId "buyer-orders"
                // (RouteOwnership NATIVE set) — "my-orders" sent the link to a
                // WebView list while the polished native Orders screen existed.
                // t206 B5: zylod://orders/ORD-X targets ONE order — ride the
                // WebView order-detail page (accepts orderId param) instead of
                // dropping the id and landing on the bare list.
                "orders" -> if (id != null) ParsedDeepLink("order-detail", mapOf("orderId" to id)) else ParsedDeepLink("buyer-orders")
                "live" -> ParsedDeepLink("live-shopping-detail", id?.let { mapOf("id" to it) } ?: emptyMap())
                else -> ParsedDeepLink(page)
            }
        }

        // Handle HTTPS scheme: https://zylod.com/product/123
        if (scheme == "https" && (host == "zylod.com" || host == "www.zylod.com")) {
            // t207-c: SPA query-param deep links — the payload BOTH PDP QR
            // codes encode (web ProductQRCodeDialog product-qr-code.tsx and
            // native QrDialog ProductDetailScreen.kt:267):
            // https://zylod.com/?page=product-detail&productId=X. That URL
            // has NO path segments, so the blanket "home" return below
            // dropped the product and an in-app scan landed on the home tab.
            // Map ?page=<pageId> (+ every other query param) onto the same
            // openPage contract every other entry point uses; unknown pageIds
            // stay safe (RouteOwnership defaults to WEBVIEW, mirroring the
            // SPA's own ?page= boot reader).
            val queryPage = uri.getQueryParameter("page")
            if (!queryPage.isNullOrBlank()) {
                val params = mutableMapOf<String, String>()
                for (name in uri.queryParameterNames) {
                    if (name == "page") continue
                    uri.getQueryParameter(name)?.let { params[name] = it }
                }
                return ParsedDeepLink(queryPage, params)
            }
            if (pathSegments.isEmpty()) return ParsedDeepLink("home")

            val firstSegment = pathSegments[0]
            val secondSegment = pathSegments.getOrNull(1)

            return when (firstSegment) {
                "product" -> ParsedDeepLink("product-detail", secondSegment?.let { mapOf("id" to it) } ?: emptyMap())
                // Same D9 fix as the custom scheme above.
                "supplier" -> ParsedDeepLink("seller-storefront", secondSegment?.let { mapOf("id" to it) } ?: emptyMap())
                "deals" -> ParsedDeepLink("daily-deals")
                "cart" -> ParsedDeepLink("cart")
                // t203: native ORDERS screen owns "buyer-orders" (see above).
                // t206 B5: /orders/ORD-X → order-detail with the id (parity
                // with the custom-scheme branch above).
                "orders" -> if (secondSegment != null) ParsedDeepLink("order-detail", mapOf("orderId" to secondSegment)) else ParsedDeepLink("buyer-orders")
                "terms" -> ParsedDeepLink("terms-of-service")
                "privacy" -> ParsedDeepLink("privacy-policy")
                "about" -> ParsedDeepLink("about-us")
                "careers" -> ParsedDeepLink("careers-page")
                else -> ParsedDeepLink(firstSegment)
            }
        }

        return null
    }
}
