import SwiftUI

// Faithful port of src/components/pages/login-page.tsx (§3.2).
// All 5 server response branches handled: success / requires2FA →
// TwoFactorView / 401 INVALID_CREDENTIALS (+attemptsRemaining, accountLocked)
// / 403 ACCOUNT_SUSPENDED → AccountSuspendedView / 429 RATE_LIMITED
// (lockedUntil countdown). Client mirrors: zylod-auth-ratelimit (5 fails →
// 15-min lockout — the WEB constant; the brief said 5 minutes, web wins) and
// the math CAPTCHA after 2 failed attempts (auth-security.ts). Social buttons
// reproduce the web's simulated consent (social-auth.ts) via a native sheet +
// POST /api/auth/google|facebook.

struct LoginView: View {
    var push: (AuthRoute) -> Void
    var pop: () -> Void
    var onAuthenticated: () -> Void

    @State private var emailOrPhone = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var failedAttempts = 0
    @State private var showCaptcha = false
    @State private var captcha = MathCaptcha.generate()
    @State private var captchaAnswer = ""
    @State private var lockoutRemainingMs: Double = 0
    @State private var socialChoice: SocialChoice?
    @State private var socialEmail = ""
    @State private var socialName = ""

    private let countdown = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header
                tabSelector
                formSection
                socialSection
                footer
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 28)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .onReceive(countdown) { _ in
            guard lockoutRemainingMs > 0 else { return }
            lockoutRemainingMs = max(0, lockoutRemainingMs - 1000)
        }
        .sheet(item: $socialChoice) { choice in
            socialConsentSheet(choice.id)
        }
        .zylodEntrance()
    }

    // MARK: Sections

    private var header: some View {
        VStack(spacing: 6) {
            Text("Zylod")
                .font(ZylodFont.scaled(30, .bold, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.primary)
            Text("Efficient B2B Sourcing Starts Here")
                .font(ZylodFont.scaled(13, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
        }
        .frame(maxWidth: .infinity)
    }

    /// Buyer / Supplier tabs — visual parity (web activeTab drives styling
    /// only; the login endpoint is role-agnostic).
    private var tabSelector: some View {
        HStack(spacing: 0) {
            tabCapsule("Buyer", active: true)
            tabCapsule("Supplier", active: false)
        }
        .frame(maxWidth: 260)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ZylodColor.border).frame(height: 1)
        }
    }

    private func tabCapsule(_ title: String, active: Bool) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                .foregroundColor(active ? ZylodColor.primary : ZylodColor.onMuted)
            Rectangle()
                .fill(active ? ZylodColor.primary : Color.clear)
                .frame(height: 2)
        }
        .frame(maxWidth: .infinity)
    }

    private var formSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZylodTextField(
                label: "Email or Phone Number",
                placeholder: "name@company.com",
                text: $emailOrPhone,
                keyboardType: .emailAddress
            )
            ZylodPasswordField(
                label: "Password",
                placeholder: "Enter your password",
                text: $password
            )

            if lockoutRemainingMs > 0 {
                lockoutBanner
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.destructive)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
            }

            if failedAttempts > 0, lockoutRemainingMs <= 0 {
                let remaining = AuthRateLimit.check().attemptsRemaining
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(ZylodFont.scaled(10, relativeTo: .caption2))
                        .foregroundColor(.orange)
                    Text("\(remaining) attempt\(remaining == 1 ? "" : "s") remaining before lockout")
                        .font(ZylodFont.scaled(11, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                }
            }

            if showCaptcha, lockoutRemainingMs <= 0 {
                captchaSection
            }

            HStack {
                Spacer()
                Button {
                    push(.forgotPassword)
                } label: {
                    Text("Forgot Password?")
                        .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.primary)
                }
            }

            ZylodButton(title: "Login", systemImage: "arrow.right", loading: isLoading) {
                Task { await submit() }
            }
        }
    }

    private var lockoutBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "shield.lefthalf.filled")
                .font(ZylodFont.scaled(16, relativeTo: .body))
                .foregroundColor(ZylodColor.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Account Temporarily Locked")
                    .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.primary)
                Text("Too many failed login attempts. Please try again in \(formatted(lockoutRemainingMs)).")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.primary.opacity(0.06)))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ZylodColor.primary.opacity(0.2), lineWidth: 1))
    }

    private var captchaSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.shield")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.primary)
                Text("Verify you're human")
                    .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onBackground)
            }
            HStack(spacing: 10) {
                Text(captcha.question)
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onBackground)
                Text("=")
                    .foregroundColor(ZylodColor.onMuted)
                TextField("Answer", text: $captchaAnswer)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                    .frame(width: 72, height: 34)
                    .background(RoundedRectangle(cornerRadius: 6).fill(ZylodColor.background))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(ZylodColor.input, lineWidth: 1))
                Button {
                    captcha = MathCaptcha.generate()
                    captchaAnswer = ""
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(ZylodFont.scaled(12, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                }
            }
        }
    }

    private var socialSection: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                Rectangle().fill(ZylodColor.border).frame(height: 1)
                Text("OR CONTINUE WITH")
                    .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onMuted)
                Rectangle().fill(ZylodColor.border).frame(height: 1)
            }
            HStack(spacing: 10) {
                ZylodOutlineButton(title: "Google") { socialChoice = SocialChoice(id: "google") }
                ZylodOutlineButton(title: "Facebook") { socialChoice = SocialChoice(id: "facebook") }
            }
        }
    }

    private var footer: some View {
        VStack(spacing: 10) {
            HStack(spacing: 4) {
                Text("New to Zylod?")
                    .foregroundColor(ZylodColor.onMuted)
                Button {
                    push(.registerBuyer)
                } label: {
                    Text("Register Now")
                        .foregroundColor(ZylodColor.primary)
                }
            }
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            HStack(spacing: 4) {
                Text("Selling on Zylod?")
                    .foregroundColor(ZylodColor.onMuted)
                Button {
                    push(.registerSupplier)
                } label: {
                    Text("Become a Supplier")
                        .foregroundColor(ZylodColor.primary)
                }
            }
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
        }
        .padding(.top, 4)
    }

    // MARK: - Social consent (web openProviderConsent analog)

    private func socialConsentSheet(_ provider: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Continue with \(provider == "google" ? "Google" : "Facebook")")
                .font(ZylodFont.scaled(16, .bold, relativeTo: .headline))
            Text("Choose the account to continue with. Zylod will receive your verified \(provider == "google" ? "Google" : "Facebook") email and name — mirroring the web app's simulated consent flow.")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
            ZylodTextField(label: "Account email", placeholder: "you@example.com", text: $socialEmail, keyboardType: .emailAddress)
            ZylodTextField(label: "Display name", placeholder: "Your name", text: $socialName, autocapitalization: .words)
            HStack(spacing: 10) {
                ZylodOutlineButton(title: "Cancel", tint: ZylodColor.onMuted) {
                    socialChoice = nil
                }
                ZylodButton(title: "Continue") {
                    socialChoice = nil
                    Task { await submitSocial(provider) }
                }
            }
            Spacer()
        }
        .padding(18)
        .presentationDetents([.medium])
    }

    // MARK: - Submit (login-page.tsx handleSubmit:138-282)

    private func submit() async {
        errorMessage = nil
        let identifier = emailOrPhone.trimmingCharacters(in: .whitespaces)
        guard !identifier.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter your email/phone and password"
            return
        }

        let rl = AuthRateLimit.check()
        if rl.limited {
            lockoutRemainingMs = rl.remainingMs
            errorMessage = "Account temporarily locked due to too many failed attempts"
            return
        }
        if showCaptcha {
            guard !captchaAnswer.isEmpty else {
                errorMessage = "Please solve the math verification"
                return
            }
            guard captcha.verify(captchaAnswer) else {
                errorMessage = "Incorrect answer. Please try the new question."
                captcha = MathCaptcha.generate()
                captchaAnswer = ""
                return
            }
        }

        isLoading = true
        defer { isLoading = false }

        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }
            let isEmail = identifier.contains("@")
            let response = try await client.login(
                email: isEmail ? identifier : nil,
                phone: isEmail ? nil : identifier,
                password: password
            )

            AuthRateLimit.reset()
            failedAttempts = 0
            showCaptcha = false

            if response.requires2FA == true, let userId = response.userId {
                ToastCenter.shared.show("Security verification required", tone: .info)
                push(.twoFactor(userId: userId, maskedPhone: response.maskedPhone))
                return
            }

            if let token = response.token, let user = response.user {
                ToastCenter.shared.show("Welcome back!", tone: .success)
                await AuthSession.signInAndHydrate(user: user, token: token)
                onAuthenticated()
            } else {
                errorMessage = "Login failed. Please try again."
            }
        } catch let failure as ApiFailure {
            switch failure.status {
            case 401:
                failedAttempts += 1
                AuthRateLimit.recordFailedAttempt()
                if failedAttempts >= 2 { showCaptcha = true }
                let rl = AuthRateLimit.check()
                if rl.limited {
                    lockoutRemainingMs = rl.remainingMs
                    errorMessage = "Too many failed attempts. Account temporarily locked."
                } else {
                    errorMessage = failure.error
                }
            case 403:
                push(.accountSuspended(
                    reason: failure.suspension?.reason ?? "",
                    reference: failure.suspension?.reference ?? "",
                    suspendedAt: failure.suspension?.suspendedAt
                ))
            case 429:
                // Server lockedUntil is epoch MILLISECONDS (login/route.ts:51).
                lockoutRemainingMs = max(60_000, (failure.lockedUntil ?? 0) - Date().timeIntervalSince1970 * 1000)
                errorMessage = failure.error
            default:
                errorMessage = failure.error
            }
        } catch {
            errorMessage = "Network error. Please check your connection and try again."
        }
    }

    /// social-auth.ts:86-124 — consent → providerId derivation → exchange.
    private func submitSocial(_ provider: String) async {
        errorMessage = nil
        let email = socialEmail.trimmingCharacters(in: .whitespaces)
        let name = socialName.trimmingCharacters(in: .whitespaces)
        guard email.contains("@") else {
            errorMessage = "Enter the account email to continue"
            socialChoice = SocialChoice(id: provider)
            return
        }
        isLoading = true
        defer { isLoading = false }

        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }
            let response = try await client.socialLogin(
                provider: provider,
                providerId: SocialConsent.providerId(provider: provider, email: email),
                email: email,
                name: name
            )
            AuthRateLimit.reset()

            if response.requires2FA == true, let userId = response.userId {
                push(.twoFactor(userId: userId, maskedPhone: response.maskedPhone))
                return
            }
            if let token = response.token, let user = response.user {
                ToastCenter.shared.show("Signed in with \(provider == "google" ? "Google" : "Facebook").", tone: .success)
                await AuthSession.signInAndHydrate(user: user, token: token)
                onAuthenticated()
            } else {
                errorMessage = "Sign-in failed. Please try again."
            }
        } catch let failure as ApiFailure {
            if failure.code == "ACCOUNT_SUSPENDED" {
                push(.accountSuspended(
                    reason: failure.suspension?.reason ?? "",
                    reference: failure.suspension?.reference ?? "",
                    suspendedAt: failure.suspension?.suspendedAt
                ))
            } else {
                errorMessage = failure.error
            }
        } catch {
            errorMessage = "Social sign-in failed. Please try again."
        }
    }

    private func formatted(_ ms: Double) -> String {
        let seconds = Int(max(0, ms) / 1000)
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

/// Sheet item wrapper for the social consent dialog.
struct SocialChoice: Identifiable {
    let id: String
}
