import SwiftUI

// §3.7 Two-factor challenge — port of src/components/pages/two-factor-auth-page.tsx
// (login-branch subset: POST api/auth/2fa/verify {userId, code, method}).
// The web page also owns 2FA setup (QR + otpauth key) and SMS switching for
// logged-in users; the Phase 1 native scope is the login challenge only —
// method is fixed to 'authenticator' (brief + LoginResponse branch §3.2).
//
// Success: AuthSession.signInAndHydrate(token+user) → onAuthenticated (§3.2
// hand-off). Cancel: pop back to LoginView.

struct TwoFactorView: View {
    let userId: String
    let maskedPhone: String?
    var pop: () -> Void
    var onAuthenticated: () -> Void

    @State private var code = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var hasAutoSubmitted = false
    @State private var verifyTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                hero
                subtitle
                OtpInputBoxes(code: $code, error: errorMessage != nil)
                if let errorMessage {
                    errorBanner(errorMessage)
                }
                ZylodButton(title: "Verify", systemImage: "shield.lefthalf.filled", loading: isLoading, enabled: code.count == 6) {
                    verifyTask?.cancel()
                    verifyTask = Task { await verify() }
                }
                Button(action: pop) {
                    Text("Cancel and return to login")
                        .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                }
                securityNotice
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .onChange(of: code) { newValue in
            // Auto-verify when the 6th digit lands (web 400ms debounce).
            if newValue.count == 6, !hasAutoSubmitted, !isLoading {
                hasAutoSubmitted = true
                verifyTask?.cancel()
                verifyTask = Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    guard !Task.isCancelled else { return }
                    await verify()
                }
            }
        }
        .onDisappear { verifyTask?.cancel() }
        .zylodEntrance()
    }

    private var hero: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(ZylodColor.primary.opacity(0.09))
                    .frame(width: 104, height: 104)
                Image(systemName: "shield.lefthalf.filled")
                    .font(ZylodFont.scaled(38, relativeTo: .largeTitle))
                    .foregroundColor(ZylodColor.primary)
            }
            Text("Two-Factor Authentication")
                .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                .foregroundColor(ZylodColor.onBackground)
        }
    }

    private var subtitle: some View {
        Text(subtitleText)
            .font(ZylodFont.scaled(14, relativeTo: .body))
            .foregroundColor(ZylodColor.onMuted)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 8)
    }

    private var subtitleText: String {
        if let maskedPhone, !maskedPhone.isEmpty {
            return "Your account is protected with an authenticator app. You can also receive codes by SMS at \(maskedPhone). Enter the current 6-digit code to continue."
        }
        return "Enter the 6-digit code from your authenticator app to finish signing in."
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            .foregroundColor(ZylodColor.destructive)
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
    }

    private var securityNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield")
                .font(ZylodFont.scaled(14, relativeTo: .body))
                .foregroundColor(ZylodColor.onMuted)
            Text("Codes rotate every 30 seconds. If yours was rejected, wait for the next code and try again.")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.muted.opacity(0.4)))
    }

    // MARK: Verify (two-factor-auth-page.tsx handleVerify:144-228)

    private func verify() async {
        guard code.count == 6 else {
            errorMessage = "Please enter all 6 digits"
            hasAutoSubmitted = false
            return
        }
        guard !userId.isEmpty else {
            errorMessage = "Missing challenge context. Please sign in again."
            hasAutoSubmitted = false
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                hasAutoSubmitted = false
                return
            }
            let response = try await client.twoFactorVerify(userId: userId, code: code, method: "authenticator")
            if let token = response.token, response.user != nil {
                ToastCenter.shared.show("Two-factor verification complete", tone: .success)
                await AuthSession.signInAndHydrate(user: response.user, token: token)
                onAuthenticated()
            } else {
                errorMessage = response.message ?? "Verification failed. Please try again."
                code = ""
                hasAutoSubmitted = false
            }
        } catch let failure as ApiFailure {
            errorMessage = failure.error
            code = ""
            hasAutoSubmitted = false
        } catch {
            errorMessage = "Network error. Please check your connection and try again."
            code = ""
            hasAutoSubmitted = false
        }
    }
}
