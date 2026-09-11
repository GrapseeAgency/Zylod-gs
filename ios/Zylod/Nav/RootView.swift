import SwiftUI

// 5-tab shell matching mobile-bottom-nav.tsx (Home · Categories · Hot Deals ·
// Cart · Profile), same as android ui/nav/ZylodRoot.kt. Tier 3 pageIds render
// in an embedded WebView; Tier 1 destinations (auth suite, product-detail,
// cart) are native (Phase 1, §7.5/§10).
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
    @State private var welcomeCover: AuthRoute?
    @State private var deferredLink: ParsedDeepLink?
    @StateObject private var flow = AppFlow()
    @StateObject private var deepLink = DeepLinkCenter()
    @StateObject private var cartStore = CartStore.shared

    var body: some View {
        ZStack {
            TabView(selection: $tab) {
                homeTab
                    .tabItem { Label("Home", systemImage: "house") }
                    .tag(Tab.home)

                webViewTab("Categories", systemImage: "square.grid.2x2", pageId: "category-browser")
                    .tag(Tab.categories)
                webViewTab("Hot Deals", systemImage: "bolt", pageId: "flash-deals")
                    .tag(Tab.deals)
                cartTab
                    .tabItem { Label("Cart", systemImage: "cart") }
                    .tag(Tab.cart)
                webViewTab("Profile", systemImage: "person", pageId: "profile")
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
            HomeView(openPage: { pageId, query in
                flow.openPage(pageId, query)
            }, openProduct: { id in
                flow.openProduct(id)
            })
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
                    flow.cartPath.append(WebRoute(pageId: pageId, query: query))
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

    private func webViewTab(_ title: String, systemImage: String, pageId: String) -> some View {
        NavigationStack {
            // OWNED shell (not pooled): TabView keeps each tab's WebView for
            // the tab's lifetime — tab switches are instant and a tab shell
            // can never collide with a pooled push from another stack.
            TabWebViewScreen(pageId: pageId, query: "")
        }
        .tabItem { Label(title, systemImage: systemImage) }
    }

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
            switch link.targetPage {
            case "product-detail":
                tab = .home
                flow.openProduct(link.params["id"] ?? "")
            case "cart":
                tab = .cart
            default:
                // Tier 3 destination: resolve the server before opening the
                // WebView (links can arrive before any resolution happened).
                tab = .home
                _ = await ServerConfig.resolve()
                flow.openPage(link.targetPage, query)
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

// Destination registration must attach to ANY view in the chain (HomeView with
// toolbar, CartView with environmentObject), so this is a View extension —
// RootView-owned behavior (auth success hand-off) is injected via closure.
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
            tab = .home
            flow.openPage("supplier-dashboard", "")
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
