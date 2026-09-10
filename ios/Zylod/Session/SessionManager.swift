import Foundation
import Security

/// Session token + user-profile store mirroring the Android SessionManager
/// contract, extended in Phase 1 with §7.4 auth seeding.
///
/// - Token: Keychain (`auth_token` service `com.zylod.wholesale`) — unchanged.
/// - Profile: JSON dict in UserDefaults (`zylod_profile`) — same fields the
///   web auth-store's UserProfile persists in `b2b-auth-storage`.
/// - seedJavaScript(): produces the exact zustand-persist payload the WebView
///   needs (`{"state":{"isAuthenticated":true,"user":{…},"token":"…"},"version":0}`)
///   so Tier 3 pages inherit the native session.
enum SessionManager {
    private static let service = "com.zylod.wholesale"
    private static let account = "auth_token"
    private static let profileKey = "zylod_profile"

    // MARK: Token (Keychain)

    static func token() -> String? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func setToken(_ token: String?) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        guard let token, !token.isEmpty,
              let data = token.data(using: .utf8) else { return }
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attributes as CFDictionary, nil)
    }

    // MARK: User profile (§7.4)

    /// Mirrors src/store/auth-store.ts UserProfile exactly (JSON keys match).
    struct UserProfile: Codable, Equatable {
        var id: String
        var userType: String?          // "buyer" | "supplier" | "admin" | null
        var email: String?
        var phone: String?
        var fullName: String?
        var businessName: String?
        var avatarUrl: String?
        var isProfileComplete: Bool
        var profileCompletionPct: Int
        // Supplier-specific (optional, only present for suppliers)
        var verificationStatus: String?
        var rejectionReason: String?
        var companyName: String?
        var supplierSlug: String?
    }

    static func profile() -> UserProfile? {
        guard let data = UserDefaults.standard.data(forKey: profileKey) else { return nil }
        return try? JSONDecoder().decode(UserProfile.self, from: data)
    }

    static func setProfile(_ profile: UserProfile?) {
        guard let profile else {
            UserDefaults.standard.removeObject(forKey: profileKey)
            return
        }
        if let data = try? JSONEncoder().encode(profile) {
            UserDefaults.standard.set(data, forKey: profileKey)
        }
    }

    /// Full sign-in: token + profile at once.
    static func signIn(token: String, profile: UserProfile) {
        setToken(token)
        setProfile(profile)
    }

    /// Sign-out: clears the Keychain token, profile, and WebView-side auth.
    static func signOut() {
        setToken(nil)
        setProfile(nil)
    }

    static var isAuthenticated: Bool { token() != nil }

    // MARK: §7.4 — WebView auth seeding

    /// JS that writes the `b2b-auth-storage` zustand-persist value BEFORE any
    /// page script runs. Shape verified against auth-store.ts persist config:
    /// {"state":{"isAuthenticated":true,"user":{…},"token":"…"},"version":0}.
    /// User fields match UserProfile in auth-store.ts.
    static func seedJavaScript() -> String? {
        guard let token = token(), !token.isEmpty else { return nil }
        let user = profile() ?? UserProfile(
            id: "", userType: nil, email: nil, phone: nil, fullName: nil,
            businessName: nil, avatarUrl: nil, isProfileComplete: false,
            profileCompletionPct: 0,
            verificationStatus: nil, rejectionReason: nil,
            companyName: nil, supplierSlug: nil
        )

        struct SeedUser: Encodable {
            var id: String?
            var userType: String?
            var email: String?
            var phone: String?
            var fullName: String?
            var businessName: String?
            var avatarUrl: String?
            var isProfileComplete: Bool
            var profileCompletionPct: Int
            var verificationStatus: String?
            var rejectionReason: String?
            var companyName: String?
            var supplierSlug: String?
        }

        struct SeedState: Encodable {
            var isAuthenticated: Bool
            var user: SeedUser
            var token: String
        }

        struct SeedPayload: Encodable {
            var state: SeedState
            var version: Int
        }

        let payload = SeedPayload(
            state: SeedState(
                isAuthenticated: true,
                user: SeedUser(
                    id: user.id,
                    userType: user.userType,
                    email: user.email,
                    phone: user.phone,
                    fullName: user.fullName,
                    businessName: user.businessName,
                    avatarUrl: user.avatarUrl,
                    isProfileComplete: user.isProfileComplete,
                    profileCompletionPct: user.profileCompletionPct,
                    verificationStatus: user.verificationStatus,
                    rejectionReason: user.rejectionReason,
                    companyName: user.companyName,
                    supplierSlug: user.supplierSlug
                ),
                token: token
            ),
            version: 0
        )

        guard let data = try? JSONEncoder().encode(payload),
              let json = String(data: data, encoding: .utf8) else { return nil }
        return "try{window.localStorage.setItem('b2b-auth-storage', \(Self.jsStringLiteral(json)));}catch(e){}"
    }

    /// JS that removes the seeded auth state (used whenever there is no native
    /// session — logout propagation native → WebView).
    static let clearAuthJavaScript =
        "try{window.localStorage.removeItem('b2b-auth-storage');}catch(e){}"

    /// Escapes a Swift string into a safely-quoted JavaScript string literal.
    static func jsStringLiteral(_ raw: String) -> String {
        var out = "\""
        for ch in raw.unicodeScalars {
            switch ch {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if ch.value < 32 {
                    out += String(format: "\\u%04x", ch.value)
                } else {
                    out.unicodeScalars.append(ch)
                }
            }
        }
        out += "\""
        return out
    }
}

// MARK: - Session-expired event

extension Notification.Name {
    /// Posted when a 401 survives the single refresh attempt — screens observe
    /// this to route the user back to login (§7-D honesty contract).
    static let zylodSessionExpired = Notification.Name("zylod.sessionExpired")
}
