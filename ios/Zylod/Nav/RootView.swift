import SwiftUI

// 5-tab shell matching mobile-bottom-nav.tsx (Home · Categories · Hot Deals ·
// Cart · Profile), same as android ui/nav/ZylodRoot.kt. Tier 3 pageIds render
// in an embedded WebView; Tier 1 hand-offs from Home push onto the stack.

struct WebRoute: Hashable {
    let pageId: String
    let query: String
}

struct RootView: View {
    private enum Tab: Hashable {
        case home, categories, deals, cart, profile
    }

    @State private var tab: Tab = .home
    @State private var homePath = NavigationPath()

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack(path: $homePath) {
                HomeView(openPage: { pageId, query in
                    homePath.append(WebRoute(pageId: pageId, query: query))
                })
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: WebRoute.self) { route in
                    WebViewScreen(pageId: route.pageId, query: route.query)
                }
            }
            .tabItem { Label("Home", systemImage: "house") }
            .tag(Tab.home)

            webViewTab("Categories", systemImage: "square.grid.2x2", pageId: "category-browser")
                .tag(Tab.categories)
            webViewTab("Hot Deals", systemImage: "bolt", pageId: "flash-deals")
                .tag(Tab.deals)
            webViewTab("Cart", systemImage: "cart", pageId: "cart")
                .tag(Tab.cart)
            webViewTab("Profile", systemImage: "person", pageId: "profile")
                .tag(Tab.profile)
        }
        .tint(ZylodColor.primary)
    }

    private func webViewTab(_ title: String, systemImage: String, pageId: String) -> some View {
        NavigationStack {
            WebViewScreen(pageId: pageId, query: "")
        }
        .tabItem { Label(title, systemImage: systemImage) }
    }
}
