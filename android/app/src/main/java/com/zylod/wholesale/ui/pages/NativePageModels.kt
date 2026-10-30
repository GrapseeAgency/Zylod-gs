package com.zylod.wholesale.ui.pages

/**
 * t233 — PURE NATIVE conversion core.
 *
 * The owner's order: every pageId the web SPA registry serves
 * (src/lib/page-loader.ts + src/lib/page-chunks/) must render as a native
 * Kotlin/Jetpack Compose screen — zero React in the app layer.
 *
 * ~780 long-tail pageIds cannot each hand-write a bespoke data pipeline, so
 * they share ONE typed page model ([NativePageData]) and ONE repository
 * ([NativePageRepository]) — while every screen file still carries its own
 * page-specific Kotlin metadata block ([NativePageMeta]) and its own real
 * Compose Scaffold. This is the same trade the SPA itself made
 * ("ultra-minimal, uses generic page types for most routes" — page-loader.ts),
 * except here the generic renderer is Compose, not React.
 *
 * HONESTY CONTRACT (same bar as DealsScreen/OrdersScreen):
 *  - sections render REAL data when an endpoint feeds the page
 *    (api/products / api/categories / api/deals / api/wishlist /
 *    api/orders/my-orders / api/suppliers / api/notifications);
 *  - pages with no obvious endpoint render their curated Kotlin metadata
 *    (summary, key facts, related native pages) — never fabricated server
 *    data, never a blank body, never a white screen;
 *  - offline shows the last-saved payload ([NativePageCache]) and falls back
 *    to the curated content — the page always renders.
 */

/** Which wire shape feeds a generated page — drives parsing + the endpoint hint. */
enum class NativePageKind {
    /** Product-grid shaped: GET api/products (supports search/category/clearance/seasonal). */
    PRODUCTS,
    /** Supplier-directory shaped: GET api/suppliers. */
    SUPPLIERS,
    /** Buyer-order shaped: GET api/orders/my-orders. */
    ORDERS,
    /** Deal shaped: GET api/deals (flash + daily arrays). */
    DEALS,
    /** Category-tree shaped: GET api/categories. */
    CATEGORIES,
    /** Wishlist shaped: GET api/wishlist. */
    WISHLIST,
    /** Authenticated notification-feed shaped: GET api/notifications. */
    NOTIFICATIONS,
    /** No obvious endpoint — the page renders its curated Kotlin metadata. */
    CONTENT,
}

/** Where the currently rendered [NativePageData] came from. */
enum class NativePageSource {
    /** Live fetch from the page's endpoint. */
    LIVE,
    /** Device-saved cache (offline — [NativePageCache]). */
    CACHE,
    /** Curated Kotlin metadata built on-device (first launch, nothing saved). */
    SEED,
}

/** One tappable content card inside a page section. */
@kotlinx.serialization.Serializable
data class NativePageCard(
    /** Stable LazyColumn key — never reused inside a section. */
    val id: String,
    val title: String,
    val subtitle: String? = null,
    /** Secondary line (category · supplier · status …). */
    val detail: String? = null,
    /** Preformatted price line (e.g. "৳1,250"); null = not a priced row. */
    val priceLabel: String? = null,
    /** Small trailing badge (MOQ, unread, discount …). */
    val badge: String? = null,
    /** Relative server image path or absolute URL; null = letter avatar. */
    val imageUrl: String? = null,
    /** Native pageId this card opens (through RouteOwnership — always). */
    val targetPageId: String? = null,
    /** Query string appended to the target navigation. */
    val targetQuery: String = "",
)

/** Render style of a section — the shared renderer switches on this. */
enum class NativeSectionStyle {
    /** Two-column product-style cards with images and prices. */
    CARDS,
    /** Full-width list rows (orders, notifications, tickets …). */
    ROWS,
    /** Compact tappable chips (categories, quick links). */
    CHIPS,
    /** Large number + label stat blocks. */
    STATS,
    /** Bulleted info card (policies, guides, curated page facts). */
    INFO,
}

/** One titled section of a native page. */
@kotlinx.serialization.Serializable
data class NativePageSection(
    /** Stable section key (LazyColumn item key prefix). */
    val id: String,
    val title: String,
    val style: NativeSectionStyle = NativeSectionStyle.CARDS,
    /** Honest empty line when [cards] is empty (rendered instead of nothing). */
    val emptyText: String? = null,
    val cards: List<NativePageCard> = emptyList(),
)

/** The full typed payload a native page renders. */
@kotlinx.serialization.Serializable
data class NativePageData(
    val title: String,
    val subtitle: String? = null,
    val sections: List<NativePageSection> = emptyList(),
)

/** A curated cross-navigation link baked into a page's metadata. */
data class NativePageLink(val pageId: String, val label: String)

/**
 * Page-specific metadata block. Every native page file declares ONE
 * `data object XPageMeta : NativePageMeta()` overriding these vals — the
 * Kotlin-side answer to the SPA's page-loader registry entry.
 */
abstract class NativePageMeta {
    /** The SPA pageId this screen owns (src/lib/page-loader.ts contract). */
    abstract val pageId: String
    /** Human title (top bar + registry + curated content). */
    abstract val title: String
    /** Functional bucket, e.g. "Orders & Logistics" (page-metadata only). */
    abstract val category: String
    /** Wire shape — drives [NativePageRepository] parsing. */
    abstract val kind: NativePageKind
    /** Relative endpoint (after the server base) when one obviously feeds this page; null = curated. */
    abstract val endpoint: String?
    /** One-line description of what the page does (curated content + docs). */
    abstract val summary: String
    /** Which bottom tab to highlight ("home"|"categories"|"search"|"deals"|"cart"|"profile"); "" = none. */
    open val tabHint: String get() = ""
    /** Curated key-facts bullets (INFO section of the seed content). */
    open val bullets: List<String> get() = emptyList()
    /** Curated related native pages (CHIPS section of the seed content). */
    open val related: List<NativePageLink> get() = emptyList()
}
