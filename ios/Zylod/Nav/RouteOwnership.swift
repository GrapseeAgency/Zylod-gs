import Foundation

/// THE route-ownership table (owner round-4 audit, binding directive):
///
///   pageId → NATIVE or WEBVIEW
///
/// and every navigation entry point MUST use `RouteOwnership.resolve` — the
/// one resolver. No special-case routing may live inside individual screens,
/// and no pageId may be simultaneously owned by SwiftUI and the WebView SPA.
///
/// This is the iOS mirror of
/// `android/.../ui/nav/RouteOwnership.kt` — the SAME table, SAME decisions.
/// If a row changes, change it in both files (documented in ARCHITECTURE.md).
///
/// Ownership decisions recorded here (Phase 1, NATIVE_PRODUCT_SPECIFICATION
/// §2.2 — Tier-1 surfaces native, Tier-3 long-tail WebView):
///
///  NATIVE   home, cart, product-detail, and the auth suite entry points
///           (login / register-buyer / register-supplier / forgot-password).
///  WEBVIEW  everything else — the ~400 Tier-3 pageIds of the SPA contract
///           (src/lib/page-loader.ts is the web-side registry; the default
///           for an unknown pageId is WEBVIEW).
///
/// Guest policy (parity with the web bar's own behavior): an
/// UNAUTHENTICATED Profile request opens the native login screen.
/// Authenticated Profile is a WEBVIEW page (explicit Phase 1 ownership
/// decision — native Profile comes in a later phase; the native roadmap in
/// NATIVE_PRODUCT_SPECIFICATION remains authoritative and is NOT reduced).
enum RouteOwnership {

    /// Who renders a pageId. Exactly one owner per pageId — never both.
    enum Owner {
        case native
        case webview
    }

    /// A resolved navigation target. `.web` is the ONLY variant that may
    /// reach a WebView surface.
    enum Destination: Equatable {
        /// Native SwiftUI Home (Tier 1).
        case home
        /// Native SwiftUI Cart (Tier 1).
        case cart
        /// Native product detail push (no tab highlight).
        case product(productId: String)
        /// Native fullscreen auth screen.
        case auth(AuthRoute)
        /// WebView shell surface for the SPA pageId (Tier 3).
        case web(pageId: String, query: String)
    }

    static let pageHome = "home"
    static let pageCart = "cart"
    static let pageProductDetail = "product-detail"

    /// Native auth-suite pageIds.
    private static let nativeAuthPageIds: Set<String> = [
        "login", "register-buyer", "register-supplier", "forgot-password",
    ]

    static func ownerOf(_ pageId: String) -> Owner {
        switch pageId {
        case pageHome, pageCart, pageProductDetail:
            return .native
        case let id where nativeAuthPageIds.contains(id) || id == "welcome":
            return .native
        default:
            return .webview
        }
    }

    /// THE resolver. Every navigation entry point funnels through here:
    /// the tab bar, web-initiated `openPage` bridge, Home quick-access
    /// tiles, Cart links, PDP links, deep links.
    ///
    /// `isAuthenticated` only affects the Profile row (guest → native
    /// login, matching the web bar's own behavior in a browser).
    static func resolve(_ pageId: String, _ query: String, isAuthenticated: Bool) -> Destination {
        guard !pageId.isEmpty else { return .web(pageId: pageId, query: query) }
        switch pageId {
        case pageHome:
            return .home
        case pageCart:
            return .cart
        case pageProductDetail:
            // Links use either `productId=` (web PDP contract) or `id=`
            // (legacy zylod:// deep links).
            let productId = queryValue(named: "productId", in: query)
                ?? queryValue(named: "id", in: query)
            if let productId, !productId.isEmpty {
                return .product(productId: productId)
            }
            // A product-detail without an id cannot render natively — the
            // SPA surface handles the missing-id state.
            return .web(pageId: pageId, query: query)
        case let id where nativeAuthPageIds.contains(id):
            switch id {
            case "login": return .auth(.login)
            case "register-buyer": return .auth(.registerBuyer)
            case "register-supplier": return .auth(.registerSupplier)
            case "forgot-password": return .auth(.forgotPassword)
            default: return .web(pageId: pageId, query: query)
            }
        case "welcome":
            // Guest-flow parity with android RouteOwnership.kt: the welcome
            // GATE is shell state, not a navigation target — an openPage/
            // deep-link "welcome" request means "go to the app start".
            return .home
        case "profile":
            return isAuthenticated ? .web(pageId: pageId, query: query) : .auth(.login)
        default:
            return .web(pageId: pageId, query: query)
        }
    }

    /// The SINGLE tab-alias map (mirrors RouteOwnership.kt TAB_ALIASES and
    /// the web bar's getActiveId — three copies that must not drift).
    /// Returns the tab id whose highlight reflects `pageId`.
    static func activeTab(forPageId pageId: String?) -> String {
        guard let pageId, !pageId.isEmpty, pageId != pageHome else { return "home" }
        if tabAliasesCategories.contains(pageId) { return "categories" }
        if tabAliasesProfile.contains(pageId) { return "profile" }
        if tabAliasesDeals.contains(pageId) { return "deals" }
        if tabAliasesCart.contains(pageId) { return "cart" }
        return "home"
    }

    private static let tabAliasesCategories: Set<String> = [
        "category-products", "category-browser", "textiles-fabrics", "agriculture-food",
        "electronics", "construction", "packaging", "home-garden", "gifts-crafts",
        "beauty-personal-care", "promotional-items", "garments", "spices",
        "mobile-accessories", "led-lighting", "automotive", "sports-fitness",
        "books-stationery", "toys", "jewelry", "medical-supplies", "furniture",
    ]
    private static let tabAliasesProfile: Set<String> = [
        "chat-list", "chat-detail", "messages",
        "profile", "buyer-dashboard", "buyer-orders", "buyer-wishlist", "buyer-settings",
        "buyer-profile", "supplier-dashboard", "supplier-profile", "admin-dashboard",
        "notification-preferences", "privacy-settings", "language-settings",
        "theme-settings", "linked-accounts", "business-profile",
    ]
    private static let tabAliasesDeals: Set<String> = [
        "flash-sale", "flash-deals", "daily-deals",
    ]
    private static let tabAliasesCart: Set<String> = [
        "cart", "checkout",
    ]

    /// Query-string helper: first value for `name` (percent-decoded).
    static func queryValue(named name: String, in query: String) -> String? {
        for pair in query.split(separator: "&") {
            let raw = String(pair)
            let key = raw.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? raw
            if key == name {
                let value = raw.contains("=") ? String(raw.dropFirst(key.count + 1)) : ""
                return value.removingPercentEncoding ?? value
            }
        }
        return nil
    }

    /// Parses `a=1&b=2` into a map (percent-decoded values) — used by the
    /// live-state params comparison.
    static func queryParams(_ query: String) -> [String: String] {
        var result: [String: String] = [:]
        for pair in query.split(separator: "&") where !pair.isEmpty {
            let raw = String(pair)
            if let eq = raw.firstIndex(of: "=") {
                let key = String(raw[raw.startIndex..<eq])
                let value = String(raw[raw.index(after: eq)...])
                if !key.isEmpty {
                    result[key] = value.removingPercentEncoding ?? value
                }
            } else {
                result[raw] = ""
            }
        }
        return result
    }
}
