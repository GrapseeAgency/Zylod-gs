import SwiftUI

// 5-tab shell matching mobile-bottom-nav.tsx (Home · Categories · Hot Deals ·
// Cart · Profile), same as android ui/nav/ZylodRoot.kt. PageIds render in an
// embedded WebView; native destinations (auth suite, product-detail, cart)
// are native (Phase 1, §7.5/§10).
//
// OWNER DIRECTIVE — native-Home TERMINATION: home → WEBVIEW on both
// platforms. The Home tab root is native shell state, but its renderer is
// the OWNED WebView shell (`TabWebViewScreen(pageId: "home")`) under the
// same provenance contract as every other pageId. The former SwiftUI
// HomeView/HomeViewModel are quarantined (ios/Quarantined/).
//
// Phase 1 deltas:
// - Welcome gate: fullscreen WelcomeView until `zylod-onboarding-seen`
//   (§3.1); CTAs open the NATIVE register-buyer/login screens in a cover.
// - Cart tab → native CartView in its own NavigationStack with badge.
// - Home stack gains ProductRoute + AuthRoute destinations.
// - .onOpenURL deep links (zylod:// + https zylod.com) → DeepLinkParser.

struct RootView: View {
    private enum Tab: Hashable {
        case home, categories, deals, cart, profile
    }

    @AppStorage("zylod-onboarding-seen") private var onboardingSeen = false
    @State private var tab: Tab = .home
    /// F7 tab synchronisation: re-tapping the SELECTED web tab bumps its
    /// drive counter — the owned shell re-drives to its canonical pageId
    /// (pop-the-tab's-web-stack-to-root, UIKit convention parity with the
    /// Home/Cart pop-to-root handling above).
    @State private var webTabDriveTicks: [Tab: Int] = [:]
    @State private var welcomeCover: AuthRoute?
    @State private var deferredLink: ParsedDeepLink?
    @StateObject private var flow = AppFlow()
    @StateObject private var deepLink = DeepLinkCenter()
    @StateObject private var cartStore = CartStore.shared

    var body: some View {
        ZStack {
            // Tab selection with RE-TAP semantics (owner round-3 finding: from
            // a pushed Category screen, tapping Home did nothing). TabView's
            // plain selection binding writes the SAME value when the selected
            // tab is re-tapped — SwiftUI sees no change and the pushed
            // Category stays on top. The custom binding intercepts EVERY tap:
            // re-tapping the selected tab pops that tab's stack to its root,
            // matching UIKit tab-bar convention.
            TabView(selection: Binding(
                get: { tab },
                set: { tapped in
                    if tapped == tab {
                        switch tapped {
                        case .home:
                            // Home is WebView-owned: pop pushed screens AND
                            // re-drive the owned home shell to its canonical
                            // pageId (UIKit pop-to-root parity — the shell's
                            // drive() verifies instantly when already home).
                            flow.popHomeToRoot()
                            webTabDriveTicks[.home, default: 0] += 1
                        case .cart: flow.popCartToRoot()
                        case .categories, .deals, .profile:
                            // Re-tap re-drives the owned shell to its
                            // canonical pageId (no-op when already there).
                            webTabDriveTicks[tapped, default: 0] += 1
                        }
                    } else {
                        tab = tapped
                    }
                }
            )) {
                homeTab
                    .tabItem { Label("Home", systemImage: "house") }
                    .tag(Tab.home)

                webViewTab("Categories", systemImage: "square.grid.2x2", pageId: "category-browser", tick: webTabDriveTicks[.categories] ?? 0)
                    .tag(Tab.categories)
                webViewTab("Hot Deals", systemImage: "bolt", pageId: "flash-deals", tick: webTabDriveTicks[.deals] ?? 0)
                    .tag(Tab.deals)
                cartTab
                    .tabItem { Label("Cart", systemImage: "cart") }
                    .tag(Tab.cart)
                webViewTab("Profile", systemImage: "person", pageId: "profile", tick: webTabDriveTicks[.profile] ?? 0)
                    .tag(Tab.profile)
            }
        }
        .tint(ZylodColor.primary)
        .overlay(ToastOverlay())
        .overlay { if !onboardingSeen { welcomeGate } }
        .onOpenURL { url in deepLink.open(url) }
        .onReceive(deepLink.$pending) { pending in
            guard pending != nil else { return }
            handlePendingLink()
        }
        .onReceive(NotificationCenter.default.publisher(for: .zylodSessionExpired)) { _ in
            if !SessionManager.isAuthenticated {
                ToastCenter.shared.show("Your session expired. Please sign in again.", tone: .error)
                flow.openAuth(.login)
                tab = .home
            }
        }
        .onAppear {
            // Web-initiated navigation contract (Android NativeNavBus parity):
            // a page inside any shell can ask the NATIVE shell to change
            // screens (`ZylodNativeBridge.openPage`) — a visible legacy web
            // bottom bar must never perform a divergent SPA navigation.
            ZylodNativeBridge.onOpenPage = { pageId, query in
                routeWebNav(pageId, query)
            }
            Task { await cartStore.pullServerCart() }
        }
    }

    // MARK: - Welcome gate (§3.1)

    private var welcomeGate: some View {
        WelcomeView(
            onLogin: { welcomeCover = .login },
            onRegisterBuyer: { welcomeCover = .registerBuyer },
            onRegisterSupplier: { welcomeCover = .registerSupplier },
            onGuest: {
                onboardingSeen = true
                flushDeferredLink()
            }
        )
        .fullScreenCover(item: $welcomeCover) { route in
            WelcomeAuthCover(route: route) {
                // Authenticated from the pre-onboarding flow → enter the app.
                onboardingSeen = true
                welcomeCover = nil
                flushDeferredLink()
            } onCancel: {
                welcomeCover = nil
            }
        }
    }

    // MARK: - Tabs

    private var homeTab: some View {
        NavigationStack(path: $flow.homePath) {
            // OWNER DIRECTIVE — home → WEBVIEW (native Home terminated).
            // Exactly ONE Home: the home tab root renders the OWNED WebView
            // shell through the SAME provenance contract as every other
            // pageId — verified endpoint → verified bundle identity →
            // ?page=home → SPA-confirmed pageId=home → reveal. No stale Home
            // pixels, no Home fallback. Web-initiated navigation from inside
            // the home content rides the SAME resolver (routeWebNav via the
            // openPage bridge) — no per-screen special cases. The former
            // SwiftUI HomeView is quarantined (ios/Quarantined/).
            TabWebViewScreen(pageId: "home", query: "", driveTick: webTabDriveTicks[.home] ?? 0)
                .toolbar(.hidden, for: .navigationBar)
                .phaseDestinations(flow: flow, push: { flow.openAuth($0) }, onAuthenticated: { self.handleAuthenticated(flow: flow) }) {
                    flow.homePath.removeLast()
                }
        }
    }

    private var cartTab: some View {
        NavigationStack(path: $flow.cartPath) {
            CartView(
                openPage: { pageId, query in
                    // THE contract: Cart links resolve through the SAME
                    // ownership table (product-detail → NATIVE PDP).
                    self.navigate(
                        RouteOwnership.resolve(pageId, query, isAuthenticated: SessionManager.isAuthenticated),
                    )
                },
                openProduct: { id in
                    flow.cartPath.append(ProductRoute(id: id))
                },
                openAuth: { route in
                    flow.cartPath.append(route)
                }
            )
            .environmentObject(cartStore)
            .toolbar(.hidden, for: .navigationBar)
            .phaseDestinations(flow: flow, push: { flow.cartPath.append($0) }, onAuthenticated: { self.handleAuthenticated(flow: flow) }) {
                flow.cartPath.removeLast()
            }
        }
        // Tab badge = distinct item count, 99+ cap (mobile-bottom-nav parity).
        .badge(cartStore.badgeText.map(Text.init))
    }

    private func webViewTab(_ title: String, systemImage: String, pageId: String, tick: Int = 0) -> some View {
        NavigationStack {
            // OWNED shell (not pooled): TabView keeps each tab's WebView for
            // the tab's lifetime — tab switches are instant and a tab shell
            // can never collide with a pooled push from another stack.
            TabWebViewScreen(pageId: pageId, query: "", driveTick: tick)
        }
        .tabItem { Label(title, systemImage: systemImage) }
    }

    // MARK: - THE navigation entry point (round-4: one navigation authority)

    /// Web-initiated navigation (`ZylodNativeBridge.openPage`) through the
    /// SAME contract as the native tab bar — RouteOwnership.resolve decides;
    /// no per-screen special cases.
    private func routeWebNav(_ pageId: String, _ query: String) {
        navigate(
            RouteOwnership.resolve(pageId, query, isAuthenticated: SessionManager.isAuthenticated),
        )
    }

    /// Applies a resolver destination. Every entry point funnels here: the
    /// tab bar (via openPage below), web-initiated navigation, Home
    /// quick-access tiles, Cart links, PDP links, deep links.
    func navigate(_ destination: RouteOwnership.Destination) {
        switch destination {
        case .home:
            tab = .home
            flow.popHomeToRoot()
            // Home is WebView-owned: re-drive the owned home shell to its
            // canonical pageId. drive() probes the live page first, so an
            // already-home shell re-verifies and reveals instantly.
            webTabDriveTicks[.home, default: 0] += 1
        case .cart:
            tab = .cart
            flow.popCartToRoot()
        case .product(let productId):
            tab = .home
            flow.openProduct(productId)
        case .auth(let route):
            tab = .home
            flow.openAuth(route)
        case .web(let pageId, let query):
            // A pageId that IS a webview tab's fixed surface selects that
            // tab (owned shell, instant); everything else opens in the home
            // stack (shared Tier-3 contract). The mapping is the shell's
            // DECLARED tab structure — the same rows RouteOwnership owns.
            switch RootView.webViewTabForPageId[pageId] {
            case .categories?: tab = .categories
            case .deals?: tab = .deals
            case .profile?: tab = .profile
            default:
                tab = .home
                flow.openPage(pageId, query)
            }
        }
    }

    /// Tab-structure table: which owned tab shell renders a fixed pageId.
    /// Declared here once — the ownership table's presentation on iOS.
    private static let webViewTabForPageId: [String: Tab] = [
        "category-browser": .categories,
        "flash-deals": .deals,
        "profile": .profile,
    ]

    // MARK: - Deep links (§7.2)

    private func handlePendingLink() {
        guard let link = deepLink.consume() else { return }
        if !onboardingSeen {
            deferredLink = link
            return
        }
        routeDeepLink(link)
    }

    private func flushDeferredLink() {
        guard let link = deferredLink else { return }
        deferredLink = nil
        routeDeepLink(link)
    }

    private func routeDeepLink(_ link: ParsedDeepLink) {
        Task { @MainActor in
            // Sort the pairs BEFORE stringifying — the closure compares keys.
            let query = link.params
                .sorted { $0.key < $1.key }
                .map { "\($0.key)=\($0.value)" }
                .joined(separator: "&")
            switch RouteOwnership.resolve(link.targetPage, query, isAuthenticated: SessionManager.isAuthenticated) {
            case .web:
                // Tier 3 destination: resolve the server before opening the
                // WebView (links can arrive before any resolution happened).
                _ = await ServerConfig.resolve()
                navigate(.web(pageId: link.targetPage, query: query))
            case let destination:
                navigate(destination)
            }
        }
    }
}

// MARK: - Pre-onboarding auth cover

private struct WelcomeAuthCover: View {
    let route: AuthRoute
    let onAuthenticated: () -> Void
    let onCancel: () -> Void
    @State private var path = NavigationPath()
    @StateObject private var flow = AppFlow()

    var body: some View {
        NavigationStack(path: $path) {
            authDestination(route)
                .navigationBarHidden(true)
                .navigationDestination(for: AuthRoute.self) { pushed in
                    authDestination(pushed)
                }
                .navigationDestination(for: WebRoute.self) { route in
                    WebViewScreen(pageId: route.pageId, query: route.query)
                }
        }
    }

    private func authDestination(_ route: AuthRoute) -> some View {
        RootView.authView(
            route: route,
            push: { path.append($0) },
            pop: { path.removeLast() },
            onAuthenticated: onAuthenticated,
            onCancel: onCancel
        )
        .environmentObject(flow)
    }
}

extension AuthRoute: Identifiable {
    var id: String {
        switch self {
        case .login: return "login"
        case .registerBuyer: return "register-buyer"
        case .registerSupplier: return "register-supplier"
        case .forgotPassword: return "forgot-password"
        case .resetPassword: return "reset-password"
        case .twoFactor: return "two-factor"
        case .accountSuspended: return "account-suspended"
        case .otp: return "otp"
        }
    }
}

// MARK: - Destination builder (shared by Home stack, Cart stack, cover)

// Destination registration must attach to ANY view in the chain (the home
// tab's TabWebViewScreen with toolbar, CartView with environmentObject), so
// this is a View extension — RootView-owned behavior (auth success hand-off)
// is injected via closure.
extension View {

    /// Registers the Phase 1 native destinations on a NavigationStack.
    func phaseDestinations(
        flow: AppFlow,
        push: @escaping (AuthRoute) -> Void,
        onAuthenticated: @escaping () -> Void,
        pop: @escaping () -> Void
    ) -> some View {
        self
            .navigationDestination(for: WebRoute.self) { route in
                WebViewScreen(pageId: route.pageId, query: route.query)
            }
            .navigationDestination(for: ProductRoute.self) { route in
                ProductDetailView(productId: route.id)
                    .navigationBarTitleDisplayMode(.inline)
                    .environmentObject(flow)
            }
            .navigationDestination(for: AuthRoute.self) { route in
                RootView.authView(
                    route: route,
                    push: push,
                    pop: pop,
                    onAuthenticated: onAuthenticated,
                    onCancel: pop
                )
                .navigationBarTitleDisplayMode(.inline)
                .environmentObject(flow)
            }
    }
}

extension RootView {
    /// Auth success hand-off (§3.2): pop to root; supplier logins land on the
    /// supplier-dashboard WebView (supplier screens are Phase 3), everyone
    /// else lands on Home; pull the authoritative server cart.
    func handleAuthenticated(flow: AppFlow) {
        flow.popHomeToRoot()
        flow.popCartToRoot()
        welcomeCover = nil
        if let profile = SessionManager.profile(), profile.userType == "supplier" {
            navigate(.web(pageId: "supplier-dashboard", query: ""))
        }
        Task { await cartStore.pullServerCart() }
    }
}

// static shared view builder — no RootView state touched here.
extension RootView {
    @ViewBuilder
    static func authView(
        route: AuthRoute,
        push: @escaping (AuthRoute) -> Void,
        pop: @escaping () -> Void,
        onAuthenticated: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) -> some View {
        switch route {
        case .login:
            LoginView(push: push, pop: pop, onAuthenticated: onAuthenticated)
        case .registerBuyer:
            RegisterBuyerView(push: push, pop: pop, onAuthenticated: onAuthenticated)
        case .registerSupplier:
            RegisterSupplierView(push: push, pop: pop, onAuthenticated: onAuthenticated)
        case .forgotPassword:
            ForgotPasswordView(push: push, pop: pop)
        case .resetPassword(let token):
            ResetPasswordView(token: token, push: push, pop: pop)
        case .twoFactor(let userId, let maskedPhone):
            TwoFactorView(userId: userId, maskedPhone: maskedPhone, pop: pop, onAuthenticated: onAuthenticated)
        case .accountSuspended(let reason, let reference, let suspendedAt):
            AccountSuspendedView(reason: reason, reference: reference, suspendedAt: suspendedAt, pop: pop)
        case .otp(let phoneOrEmail, let purpose):
            OtpVerificationView(phoneOrEmail: phoneOrEmail, purpose: OtpPurpose(rawValue: purpose) ?? .login, push: push, pop: pop, onAuthenticated: onAuthenticated)
        }
    }
}
