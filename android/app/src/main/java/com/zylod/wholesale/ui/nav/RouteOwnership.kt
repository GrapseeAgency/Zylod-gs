package com.zylod.wholesale.ui.nav

/**
 * THE route-ownership table:
 *
 *   pageId → NATIVE or WEBVIEW
 *
 * and every navigation entry point MUST use [resolve] — the one resolver.
 * No special-case routing may live inside individual screens.
 *
 * t233 OWNER DIRECTIVE — PURE NATIVE, native-first (supersedes the §2.2
 * Tier-1/Tier-3 split and the native-Home termination, both retired by the
 * same order): EVERY page the web SPA serves must render as a native Kotlin
 * screen — zero React/TypeScript in the app layer. Resolution order:
 *
 *  1. dedicated parameterized rows: home (tab root — now the NATIVE
 *     HomeScreen, t233), cart, buyer-orders, the v2.4.8 deals ids, the auth
 *     suite, product-detail (needs its productId arg);
 *  2. [NativePageRegistry] — EVERY other SPA pageId (the long-tail ids from
 *     src/lib/page-loader.ts + page-chunks) resolves
 *     Destination.NativePage(pageId): hand-written cores (search/categories/
 *     profile/notifications/wishlist) + one generated per-pageId Compose
 *     screen, all backed by ServerConfig/ApiClient data with the offline
 *     cache contract (last-saved content, never white);
 *  3. Destination.Web — LAST RESORT only, for ids the SPA contract itself
 *     does not know (matching the SPA's own isKnownPage(), which never
 *     rejects). A registered pageId can never fall through to the WebView.
 *
 * This object remains the SINGLE copy of the tab-alias map (which bottom
 * tab highlights for a given pageId); native pages add per-screen tabHint
 * metadata which [activeTabFor] consults before the alias map.
 *
 * Guest policy (unchanged): an UNAUTHENTICATED Profile request opens the
 * native login screen (web-bar parity). buyer-orders renders natively for
 * guests TOO — the screen's own needsAuth state is the guest UX (soft CTA,
 * never a redirect; the Phase 2 rationale is preserved verbatim: Cart is
 * the established native guest-reachable surface, Orders are a strict
 * subset, and a hard redirect would strand the post-login return path).
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
        /**
         * Home TAB ROOT. t233: the root entry is native shell state AND its
         * renderer is the NATIVE [com.zylod.wholesale.ui.home.HomeScreen]
         * (banners + stats + deals + categories + infinite featured grid).
         * The WebView-rendered home of the t22x directive was retired by
         * the same order that made the whole SPA native.
         */
        data object Home : Destination()

        /** Native Compose Cart (Tier 1). */
        data object Cart : Destination()

        /**
         * Native Compose buyer orders (Phase 2 row — revisitable in exactly
         * one place). Tab-like destination: TAB_ALIASES maps the
         * "buyer-orders" pageId to "profile", so it highlights the profile
         * tab exactly as web buyer-dashboard/buyer-orders do.
         */
        data object Orders : Destination()

        /**
         * Native Compose Hot Deals (v2.4.8 ownership row — the owner's
         * "no page is its own Kotlin" complaint ends here). Tab-like
         * destination: highlights the deals tab; home stays DIRECTLY beneath
         * it on the stack, so both the bottom-bar Home tap and system Back
         * land on Home. Owns pageIds: flash-deals, daily-deals, hot-deals,
         * deals. "flash-sale" deliberately stays WEBVIEW (it is a different
         * SPA page) but still highlights the deals tab via TAB_ALIASES.
         */
        data object Deals : Destination()

        /** Native Compose product detail (back-bar push, no tab highlight). */
        data class Product(val productId: String) : Destination()

        /** Native fullscreen auth screen — [route] is the NavHost route name. */
        data class Auth(val route: String) : Destination()

        /**
         * t233 — ANY registered native page (NativePageRegistry): the
         * hand-written cores and the per-pageId generated Compose screens.
         * Rendered by the single `native/{pageId}` destination through
         * NativePageHost. [query] rides along like the web contract's
         * query string (e.g. category-products?category=…).
         */
        data class NativePage(val pageId: String, val query: String) : Destination()

        /** WebView shell surface — LAST RESORT for ids the SPA doesn't know. */
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
    private const val PAGE_BUYER_ORDERS = "buyer-orders"

    // v2.4.8 native Hot Deals ownership row (one screen, four SPA pageIds —
    // the web bar's deals tab targets "flash-deals", deep links use the rest).
    private val NATIVE_DEALS_PAGE_IDS = setOf("flash-deals", "daily-deals", "hot-deals", "deals")

    // NOTE: PAGE_HOME is deliberately NOT in the deals set — home has its own
    // dedicated row (t233: NATIVE HomeScreen). The constant survives because
    // the tab root, tab aliases and deep links still speak "home".

    // Native auth-suite pageIds (mirrors ZylodRoot's fullscreen routes).
    // t233: the generic "register" pageId joins them (→ buyer registration).
    private val NATIVE_AUTH_PAGE_IDS = setOf(
        "welcome", "login", "register", "register-buyer", "register-supplier", "forgot-password",
    )

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
            // The home tab root — t233: the NATIVE HomeScreen.
            PAGE_HOME -> Destination.Home
            PAGE_CART -> Destination.Cart
            // Phase 2 row (preserved): buyer-orders renders natively for
            // guests TOO — the screen's own needsAuth state is the guest UX.
            PAGE_BUYER_ORDERS -> Destination.Orders
            // v2.4.8 (preserved by t233): the Hot Deals tab (and every alias
            // pageId) renders the NATIVE Compose deals screen.
            in NATIVE_DEALS_PAGE_IDS -> Destination.Deals
            PAGE_PRODUCT_DETAIL -> {
                // Links use either `productId=` (web PDP contract) or `id=`
                // (legacy zylod:// deep links).
                val productId = RouteOwnership.queryParam(query, "productId")
                    .ifBlank { RouteOwnership.queryParam(query, "id") }
                if (productId.isNotBlank()) Destination.Product(productId)
                // t246 — zero-WebView coverage contract: known pageIds never
                // fall back to Web; id-less product links land on the native
                // catalog (all-products), not a blank WebView PDP.
                else Destination.NativePage("all-products", query)
            }
            in NATIVE_AUTH_PAGE_IDS -> when (pageId) {
                // The welcome GATE is shell state — an openPage("welcome")
                // request means "go to the app start" (the native home root).
                "welcome" -> Destination.Home
                // t233: the generic "register" pageId opens buyer registration.
                "register" -> Destination.Auth("register-buyer")
                else -> Destination.Auth(pageId)
            }
            // t233 native-first: an authenticated profile renders the NATIVE
            // ProfileScreen (guests still get the native login row above).
            "profile" -> if (isAuthenticated) Destination.NativePage(pageId, query) else Destination.Auth("login")
            // t233 native-first: ANY pageId the Kotlin registry knows renders
            // NATIVELY — the WebView row below is LAST-RESORT fallback only.
            else ->
                if (NativePageRegistry.knows(pageId)) Destination.NativePage(pageId, query)
                else Destination.Web(pageId, query)
        }
    }

    /**
     * The SINGLE tab-alias map (ported from mobile-bottom-nav.tsx
     * getActiveId, which remains the visual reference for the web bar in
     * browsers only). Returns the tab id ("home"|"categories"|"search"|
     * "deals"|"cart"|"profile") whose highlight reflects [pageId].
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
        // t219: search tab (parity with the web bar — its getActiveId maps
        // "search-results" to the search tab; "search" is the search-home
        // pageId in src/lib/page-loader.ts, so both highlight "search").
        putAll(listOf("search-results", "search").associateWith { "search" })
        putAll(listOf("chat-list", "chat-detail", "messages").associateWith { "profile" })
        // v2.4.8: "hot-deals" joins the deals alias set alongside the other
        // deals pageIds (now native; "flash-sale" remains a WEBVIEW page that
        // still highlights the deals tab, exactly like checkout highlights cart).
        putAll(listOf("flash-sale", "flash-deals", "daily-deals", "hot-deals", "deals").associateWith { "deals" })
        // t208: the rest of the CHECKOUT FLOW highlighted "home" — buy-now is
        // opened from the NATIVE PDP, order-summary/order-confirmation from
        // the checkout flow itself, while "checkout" already highlighted the
        // cart tab. The cart tab must stay highlighted for the whole flow
        // (same defect class as the t206 profile additions).
        putAll(
            listOf(
                "cart", "checkout", "buy-now", "order-summary", "order-confirmation",
                "checkout-success", "add-to-cart-confirm", "add-to-cart-confirmation",
            ).associateWith { "cart" },
        )
        putAll(
            listOf(
                "profile", "buyer-dashboard", "buyer-orders", "buyer-wishlist", "buyer-settings",
                "buyer-profile", "supplier-dashboard", "supplier-profile", "admin-dashboard",
                "notification-preferences", "privacy-settings", "language-settings",
                "theme-settings", "linked-accounts", "business-profile",
                // t206 cosmetics: money + order + alert surfaces opened from
                // the profile tab used to highlight "home" in the bottom bar.
                "order-detail", "my-orders", "wallet", "my-wallet", "addresses",
                "shipping-address", "add-address", "edit-address", "notifications",
                "notification-archive", "transaction-history", "payment-method",
            ).associateWith { "profile" },
        )
    }

    fun activeTabFor(pageId: String?): String = when {
        pageId == null || pageId == PAGE_HOME -> "home"
        // t233: native pages carry their own tab hint (search → the search
        // tab, profile pages → the profile tab, …) — before the alias map.
        NativePageRegistry.tabHintFor(pageId) != null -> NativePageRegistry.tabHintFor(pageId)!!
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
