import Foundation
import CryptoKit
import UIKit

// Shared auth plumbing: session persistence, profile hydration (§7.4), the
// client rate-limit mirror of `zylod-auth-ratelimit` (auth-security.ts) and
// the social-consent providerId derivation (social-auth.ts).

enum AuthSession {

    /// Resolves (cache-first) the active server and returns a client.
    static func client() async -> ApiClient? {
        let base = ServerConfig.cached() ?? await ServerConfig.resolve()
        return ApiClient(base: base)
    }

    /// Persists the session and hydrates the full profile from
    /// GET /api/profile/me — mapping buyerProfile.fullName /
    /// supplierProfile.companyName / supplierProfile.verificationStatus
    /// exactly like auth-store.refreshProfile (auth-store.ts:67-101).
    /// Fires haptic on success (web vibrate parity). Safe to call from any
    /// auth screen after a token+user arrive.
    @MainActor
    static func signInAndHydrate(user: AuthUser?, token: String, fallbackFullName: String? = nil) async {
        let profile = SessionManager.UserProfile(
            id: user?.id ?? "",
            userType: user?.userType,
            email: user?.email,
            phone: user?.phone,
            fullName: fallbackFullName,
            businessName: user?.businessName,
            avatarUrl: nil,
            isProfileComplete: false,
            profileCompletionPct: 0,
            verificationStatus: nil,
            rejectionReason: nil,
            companyName: nil,
            supplierSlug: nil
        )
        SessionManager.signIn(token: token, profile: profile)
        UINotificationFeedbackGenerator().notificationOccurred(.success)

        // Hydrate (best-effort, silent on failure — auth-store parity).
        let base = ServerConfig.cached() ?? await ServerConfig.resolve()
        guard let client = ApiClient(base: base) else { return }
        guard let envelope = try? await client.profileMe(),
              envelope.success == true, let me = envelope.data else { return }

        var hydrated = profile
        if hydrated.id.isEmpty { hydrated.id = me.id }
        if hydrated.userType == nil { hydrated.userType = me.userType }
        hydrated.fullName = me.fullName ?? me.buyerProfile?.fullName ?? me.supplierProfile?.contactPersonName
        hydrated.businessName = me.supplierProfile?.companyName
        hydrated.avatarUrl = me.avatarUrl
        hydrated.isProfileComplete = me.isProfileComplete ?? false
        hydrated.profileCompletionPct = me.profileCompletionPct ?? 0
        hydrated.verificationStatus = me.supplierProfile?.verificationStatus
        hydrated.rejectionReason = me.supplierProfile?.rejectionReason
        hydrated.companyName = me.supplierProfile?.companyName
        hydrated.supplierSlug = me.supplierProfile?.slug
        SessionManager.setProfile(hydrated)
    }

    /// Maps an AuthUser + known names into the persisted profile without a
    /// network round-trip (used by register flows where the response already
    /// carries fullName/businessName).
    static func profileFromRegistration(user: AuthUser?, token: String, fullName: String?, businessName: String?, completionPct: Int) {
        let profile = SessionManager.UserProfile(
            id: user?.id ?? "",
            userType: user?.userType,
            email: user?.email,
            phone: user?.phone,
            fullName: fullName ?? user?.fullName,
            businessName: businessName ?? user?.businessName,
            avatarUrl: nil,
            isProfileComplete: false,
            profileCompletionPct: completionPct,
            verificationStatus: nil,
            rejectionReason: nil,
            companyName: businessName,
            supplierSlug: nil
        )
        SessionManager.signIn(token: token, profile: profile)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

// MARK: - Client rate-limit mirror (auth-security.ts:128-191)

enum AuthRateLimit {
    private static let key = "zylod-auth-ratelimit"
    private static let maxAttempts = 5
    private static let lockoutDuration: TimeInterval = 15 * 60   // 15 minutes
    private static let attemptWindow: TimeInterval = 5 * 60      // 5 minutes

    struct State: Codable {
        var attempts: Int
        var lastAttempt: Double
        var lockedUntil: Double?
    }

    private static func state() -> State {
        guard let data = UserDefaults.standard.data(forKey: key),
              let decoded = try? JSONDecoder().decode(State.self, from: data) else {
            return State(attempts: 0, lastAttempt: 0, lockedUntil: nil)
        }
        return decoded
    }

    private static func save(_ state: State) {
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    static func recordFailedAttempt() {
        var state = state()
        let now = Date().timeIntervalSince1970 * 1000
        if now - state.lastAttempt > attemptWindow * 1000 {
            state = State(attempts: 1, lastAttempt: now, lockedUntil: nil)
        } else {
            state.attempts += 1
            state.lockedUntil = state.attempts >= maxAttempts ? now + lockoutDuration * 1000 : nil
        }
        state.lastAttempt = now
        save(state)
    }

    static func reset() {
        UserDefaults.standard.removeObject(forKey: key)
    }

    static func check() -> (limited: Bool, remainingMs: Double, attemptsRemaining: Int) {
        let state = state()
        let now = Date().timeIntervalSince1970 * 1000
        if let lockedUntil = state.lockedUntil {
            if now < lockedUntil {
                return (true, lockedUntil - now, 0)
            }
            reset()
            return (false, 0, maxAttempts)
        }
        if now - state.lastAttempt > attemptWindow * 1000 {
            return (false, 0, maxAttempts)
        }
        return (false, 0, maxAttempts - state.attempts)
    }
}

// MARK: - Math CAPTCHA mirror (auth-security.ts:6-46)

struct MathCaptcha: Equatable {
    let question: String
    let answer: Int

    static func generate() -> MathCaptcha {
        let operations = ["+", "-", "×"]
        let op = operations.randomElement()!
        let a: Int, b: Int, answer: Int
        switch op {
        case "+":
            a = Int.random(in: 10..<60); b = Int.random(in: 10..<60); answer = a + b
        case "-":
            a = Int.random(in: 30..<80); b = Int.random(in: 1..<31); answer = a - b
        default:
            a = Int.random(in: 2..<14); b = Int.random(in: 2..<14); answer = a * b
        }
        return MathCaptcha(question: "\(a) \(op) \(b) = ?", answer: answer)
    }

    func verify(_ userAnswer: String) -> Bool {
        Int(userAnswer.trimmingCharacters(in: .whitespaces)) == answer
    }
}

// MARK: - Social consent (social-auth.ts parity)

enum SocialConsent {

    /// Deterministic provider id from the chosen email — SHA-256 hex prefix
    /// (social-auth.ts:36-43). `g-` for Google, `fb-` for Facebook; the
    /// Facebook exchange strips the prefix before POSTing.
    static func providerId(provider: String, email: String) -> String {
        let digest = SHA256.hash(data: Data(email.lowercased().utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return "\(provider == "google" ? "g" : "fb")-\(String(hex.prefix(24)))"
    }
}
