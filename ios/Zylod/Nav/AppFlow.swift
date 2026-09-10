import Foundation
import SwiftUI

// Shared navigation state for Phase 1: native routes ride the Home/Cart
// NavigationStacks; auth hand-offs (OTP→register, OTP→reset, login→2FA) read
// their context from here instead of jamming closures into Hashable routes.

/// Buyer registration draft carried across the OTP step (web persists this in
/// sessionStorage `zylod-pending-registration`; native keeps it in memory for
/// the lifetime of the flow — process-death resume is Phase 2 polish).
struct RegistrationDraft: Codable, Equatable {
    var fullName: String
    var businessName: String?
    var email: String?
    var phone: String?
    var password: String
}

enum OtpPurpose: String {
    case login = "login"
    case register = "register"
    case resetPassword = "reset_password"
}

@MainActor
final class AppFlow: ObservableObject {
    @Published var homePath = NavigationPath()
    @Published var cartPath = NavigationPath()
    @Published var pendingRegistration: RegistrationDraft?

    /// Opens a Tier 3 pageId in the Home stack (shared `openPage` contract).
    func openPage(_ pageId: String, _ query: String = "") {
        homePath.append(WebRoute(pageId: pageId, query: query))
    }

    func openProduct(_ id: String) {
        homePath.append(ProductRoute(id: id))
    }

    func openAuth(_ route: AuthRoute) {
        homePath.append(route)
    }

    func popHomeToRoot() {
        homePath = NavigationPath()
    }

    func popCartToRoot() {
        cartPath = NavigationPath()
    }
}

/// Native routes for the Home/Cart stacks.
enum AuthRoute: Hashable {
    case login
    case registerBuyer
    case registerSupplier
    case forgotPassword
    case resetPassword(token: String)
    case twoFactor(userId: String, maskedPhone: String?)
    case accountSuspended(reason: String, reference: String, suspendedAt: String?)
    case otp(phoneOrEmail: String, purpose: String)

    var otpPurpose: OtpPurpose? {
        if case let .otp(_, purpose) = self { return OtpPurpose(rawValue: purpose) }
        return nil
    }
}

/// Tier 3 WebView destination — pageId + query rendered by WebViewScreen.
/// (Was previously declared in RootView.swift; moved here with the shared
/// navigation state after the RootView Phase 1 rewrite dropped it.)
struct WebRoute: Hashable {
    let pageId: String
    let query: String
}

struct ProductRoute: Hashable {
    let id: String
}

/// zylod:// / https deep-link bus. ZylodApp.onOpenURL feeds it; RootView
/// observes and routes (resolving the server first when the destination is a
/// WebView page).
@MainActor
final class DeepLinkCenter: ObservableObject {
    @Published var pending: ParsedDeepLink?

    func open(_ url: URL) {
        guard let parsed = DeepLinkParser.parse(url: url) else { return }
        pending = parsed
    }

    func consume() -> ParsedDeepLink? {
        let value = pending
        pending = nil
        return value
    }
}
