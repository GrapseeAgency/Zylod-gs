import Foundation

// §7.2 — verbatim port of android util/DeepLinkParser.kt (DeepLinkParser.kt:10-61).
// Handles zylod:// custom scheme and https://zylod.com app links.

struct ParsedDeepLink: Equatable {
    var targetPage: String
    var params: [String: String]

    init(_ page: String, _ params: [String: String] = [:]) {
        self.targetPage = page
        self.params = params
    }
}

enum DeepLinkParser {

    static func parse(url: URL?) -> ParsedDeepLink? {
        guard let url else { return nil }
        guard let scheme = url.scheme?.lowercased() else { return nil }

        let host = url.host?.lowercased()
        // pathSegments (Android Uri.getPathSegments parity): leading "/" is
        // stripped by URL.pathComponents handling; filter empty components.
        let pathSegments = url.pathComponents.filter { $0 != "/" }

        // Custom scheme: zylod://product/123 or zylod://deals
        if scheme == "zylod" {
            guard let page = host else { return nil }
            let id = pathSegments.first
            switch page {
            case "product":
                return ParsedDeepLink("product-detail", id.map { ["id": $0] } ?? [:])
            // Web Round-1/2 audits retired supplier-storefront in favor of
            // seller-storefront — keep the scheme pointed at the live pageId (D9).
            case "supplier":
                return ParsedDeepLink("seller-storefront", id.map { ["id": $0] } ?? [:])
            case "deal":
                return ParsedDeepLink("exclusive-deal-detail", id.map { ["id": $0] } ?? [:])
            case "cart":
                return ParsedDeepLink("cart")
            case "orders":
                return ParsedDeepLink("my-orders")
            case "live":
                return ParsedDeepLink("live-shopping-detail", id.map { ["id": $0] } ?? [:])
            default:
                return ParsedDeepLink(page)
            }
        }

        // HTTPS: https://zylod.com/product/123
        if scheme == "https", host == "zylod.com" || host == "www.zylod.com" {
            if pathSegments.isEmpty { return ParsedDeepLink("home") }
            let firstSegment = pathSegments[0]
            let secondSegment = pathSegments.count > 1 ? pathSegments[1] : nil
            switch firstSegment {
            case "product":
                return ParsedDeepLink("product-detail", secondSegment.map { ["id": $0] } ?? [:])
            case "supplier":
                return ParsedDeepLink("seller-storefront", secondSegment.map { ["id": $0] } ?? [:])
            case "deals":
                return ParsedDeepLink("daily-deals")
            case "cart":
                return ParsedDeepLink("cart")
            case "orders":
                return ParsedDeepLink("my-orders")
            case "terms":
                return ParsedDeepLink("terms-of-service")
            case "privacy":
                return ParsedDeepLink("privacy-policy")
            case "about":
                return ParsedDeepLink("about-us")
            case "careers":
                return ParsedDeepLink("careers-page")
            default:
                return ParsedDeepLink(firstSegment)
            }
        }

        return nil
    }
}
