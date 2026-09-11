package com.zylod.wholesale.ui.nav

/**
 * THE route-ownership table (owner round-4 audit, binding directive):
 *
 *   pageId → NATIVE or WEBVIEW
 *
 * and every navigation entry point MUST use [resolve] — the one resolver.
 * No special-case routing may live inside individual screens, and no pageId
 * may be simultaneously owned by Compose and the WebView SPA.
 *
 * Ownership decisions recorded here (Phase 1, NATIVE_PRODUCT_SPECIFICATION
 * §2.2 — Tier-1 surfaces native, Tier-3 long-tail WebView):
 *
 *  NATIVE   home, cart, product-detail, and the auth suite entry points
 *           (welcome/login/register-buyer/register-supplier/forgot-password).
 *  WEBVIEW  everything else — the ~400 Tier-3 pageIds of the SPA contract
 *           (src/lib/page-loader.ts is the web-side registry; the default
 *           for an unknown pageId is WEBVIEW, matching the SPA's own
 *           isKnownPage() which never rejects).
 *
 * This object is also the SINGLE copy of the tab-alias map (which bottom
 * tab highlights for a given pageId). It was previously duplicated in
 * Kotlin [ZylodRoot], the web bundle (mobile-bottom-nav.tsx getActiveId),
 * and implicitly on iOS — three copies that could drift; drift between the
 * shell's alias map and the web's is what produced wrong tab highlights.
 *
 * Guest policy (parity with the web bar's own behavior, which the native
 * shell must match so a surface behaves identically hosted or in a
 * browser): an UNAUTHENTICATED Profile request opens the native login
 * screen. Authenticated Profile is a WEBVIEW page (Phase 1 scope; native
 * Profile is a later phase — the spec is not silently reduced: this row is
 * the explicit Phase 1 ownership decision, revisitable in exactly one
 * place).
 */
object RouteOwnership {

    /** Who renders a pageId. Exactly one owner per pageId — never both. */
    enum class Owner { NATIVE, WEBVIEW }

    /**
     * A resolved navigation target. [Web] is the ONLY variant that may reach
     * the `web/{pageId}` destination — a WebView surface cannot exist without
     * having passed through this resolver.
     */
    sealed class Destination {
        /** Native Compose Home (Tier 1). */
        data object Home : Destination()

        /** Native Compose Cart (Tier 1). */
        data object Cart : Destination()

        /** Native Compose product detail (back-bar push, no tab highlight). */
        data class Product(val productId: String) : Destination()

        /** Native fullscreen auth screen — [route] is the NavHost route name. */
        data class Auth(val route: String) : Destination()

        /** WebView shell surface for the SPA pageId (Tier 3). */
        data class Web(val pageId: String, val query: String) : Destination()
    }

    /**
     * The ownership table itself. Keys are pageIds as used by the SPA
     * contract; the value decides the rendering path. Explicit rows for
     * every native surface; everything not listed is WEBVIEW by default
     * (the long-tail Tier-3 registry is the web bundle's page-loader).
     */
    private const val PAGE_HOME = "home"
    private const val PAGE_CART = "cart"
    private const val PAGE_PRODUCT_DETAIL = "product-detail"

    // Native auth-suite pageIds (mirrors ZylodRoot's fullscreen routes).
    private val NATIVE_AUTH_PAGE_IDS = setOf(
        "welcome", "login", "register-buyer", "register-supplier", "forgot-password",
    )

    fun ownerOf(pageId: String): Owner = when (pageId) {
        PAGE_HOME, PAGE_CART, PAGE_PRODUCT_DETAIL -> Owner.NATIVE
        in NATIVE_AUTH_PAGE_IDS -> Owner.NATIVE
        else -> Owner.WEBVIEW
    }

    /**
     * THE resolver. Every navigation entry point funnels through here:
     * native bottom bar, web-initiated `openPage` bridge, Home quick-access
     * tiles, Cart links, PDP links, deep links.
     *
     * [isAuthenticated] only affects the Profile row (guest → native login,
     * matching the web bar's own `if (item.id === 'profile' &&
     * !isAuthenticated) navigate('login')` behavior).
     */
    fun resolve(pageId: String, query: String, isAuthenticated: Boolean): Destination {
        // Unknown/blank pageIds can never resolve to a native surface.
        if (pageId.isBlank()) return Destination.Web(pageId, query)
        return when (pageId) {
            PAGE_HOME -> Destination.Home
            PAGE_CART -> Destination.Cart
            PAGE_PRODUCT_DETAIL -> {
                // Links use either `productId=` (web PDP contract) or `id=`
                // (legacy zylod:// deep links).
                val productId = RouteOwnership.queryParam(query, "productId")
                    .ifBlank { RouteOwnership.queryParam(query, "id") }
                if (productId.isNotBlank()) Destination.Product(productId)
                // A product-detail without an id cannot render natively —
                // the SPA surface handles the missing-id state.
                else Destination.Web(pageId, query)
            }
            in NATIVE_AUTH_PAGE_IDS -> when (pageId) {
                // The welcome GATE is shell state, not a navigation target —
                // an openPage("welcome") request means "go to the app start".
                "welcome" -> Destination.Home
                else -> Destination.Auth(pageId)
            }
            "profile" -> if (isAuthenticated) Destination.Web(pageId, query) else Destination.Auth("login")
            else -> Destination.Web(pageId, query)
        }
    }

    /**
     * The SINGLE tab-alias map (ported from mobile-bottom-nav.tsx
     * getActiveId, which remains the visual reference for the web bar in
     * browsers only). Returns the tab id ("home"|"categories"|"deals"|
     * "cart"|"profile") whose highlight reflects [pageId].
     */
    private val TAB_ALIASES: Map<String, String> = buildMap {
        putAll(
            listOf(
                "category-products", "category-browser", "textiles-fabrics", "agriculture-food",
                "electronics", "construction", "packaging", "home-garden", "gifts-crafts",
                "beauty-personal-care", "promotional-items", "garments", "spices",
                "mobile-accessories", "led-lighting", "automotive", "sports-fitness",
                "books-stationery", "toys", "jewelry", "medical-supplies", "furniture",
            ).associateWith { "categories" },
        )
        putAll(listOf("chat-list", "chat-detail", "messages").associateWith { "profile" })
        putAll(listOf("flash-sale", "flash-deals", "daily-deals").associateWith { "deals" })
        putAll(listOf("cart", "checkout").associateWith { "cart" })
        putAll(
            listOf(
                "profile", "buyer-dashboard", "buyer-orders", "buyer-wishlist", "buyer-settings",
                "buyer-profile", "supplier-dashboard", "supplier-profile", "admin-dashboard",
                "notification-preferences", "privacy-settings", "language-settings",
                "theme-settings", "linked-accounts", "business-profile",
            ).associateWith { "profile" },
        )
    }

    fun activeTabFor(pageId: String?): String = when (pageId) {
        null, PAGE_HOME -> "home"
        else -> TAB_ALIASES[pageId] ?: "home"
    }

    /** Query-string helper: extracts `name=value` (first occurrence, decoded). */
    fun queryParam(query: String, name: String): String =
        query.split('&')
            .firstOrNull { it.substringBefore('=') == name }
            ?.substringAfter('=', "")
            ?.let { android.net.Uri.decode(it) }
            .orEmpty()
}
