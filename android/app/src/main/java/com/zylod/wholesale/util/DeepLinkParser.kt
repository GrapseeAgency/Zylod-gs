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
                "orders" -> ParsedDeepLink("my-orders")
                "live" -> ParsedDeepLink("live-shopping-detail", id?.let { mapOf("id" to it) } ?: emptyMap())
                else -> ParsedDeepLink(page)
            }
        }

        // Handle HTTPS scheme: https://zylod.com/product/123
        if (scheme == "https" && (host == "zylod.com" || host == "www.zylod.com")) {
            if (pathSegments.isEmpty()) return ParsedDeepLink("home")

            val firstSegment = pathSegments[0]
            val secondSegment = pathSegments.getOrNull(1)

            return when (firstSegment) {
                "product" -> ParsedDeepLink("product-detail", secondSegment?.let { mapOf("id" to it) } ?: emptyMap())
                // Same D9 fix as the custom scheme above.
                "supplier" -> ParsedDeepLink("seller-storefront", secondSegment?.let { mapOf("id" to it) } ?: emptyMap())
                "deals" -> ParsedDeepLink("daily-deals")
                "cart" -> ParsedDeepLink("cart")
                "orders" -> ParsedDeepLink("my-orders")
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
