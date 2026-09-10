import SwiftUI

// Faithful port of src/components/pages/otp-verification-page.tsx (§3.3).
// Purpose-aware (login | register | reset_password) with completion handoffs.
// The 6-box OTP input auto-verifies when the 6th digit lands (web 400ms
// debounce). Resend honors the 58s countdown; devCode is NEVER displayed
// (Phase 1 rule — the web surfaces it, native does not).

struct OtpVerificationView: View {
    let phoneOrEmail: String
    let purpose: OtpPurpose
    var push: (AuthRoute) -> Void
    var pop: () -> Void
    var onAuthenticated: () -> Void
    @EnvironmentObject private var flow: AppFlow

    @State private var code = ""
    @State private var isLoading = false
    @State private var isResending = false
    @State private var errorMessage: String?
    @State private var hasAutoSubmitted = false
    @State private var remaining = 58
    @State private var verifyTask: Task<Void, Never>?

    private let countdown = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                hero
                subtitle
                OtpInputBoxes(code: $code, error: errorMessage != nil)
                if let errorMessage {
                    errorBanner(errorMessage)
                }
                resendSection
                ZylodButton(title: "Verify & Continue", systemImage: "arrow.right", loading: isLoading, enabled: code.count == 6) {
                    verifyTask?.cancel()
                    verifyTask = Task { await verify(code) }
                }
                securityNotice
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .onReceive(countdown) { _ in
            guard remaining > 0 else { return }
            remaining -= 1
        }
        .onChange(of: code) { newValue in
            // Auto-verify when all 6 digits are entered (web useEffect debounce).
            if newValue.count == 6, !hasAutoSubmitted, !isLoading {
                hasAutoSubmitted = true
                verifyTask?.cancel()
                verifyTask = Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    guard !Task.isCancelled else { return }
                    await verify(newValue)
                }
            }
        }
        .onDisappear {
            verifyTask?.cancel()
        }
        .zylodEntrance()
    }

    // MARK: Sections

    private var hero: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(ZylodColor.primary.opacity(0.09))
                    .frame(width: 104, height: 104)
                Image(systemName: purpose == .resetPassword ? "envelope.fill" : "smartphone")
                    .font(ZylodFont.scaled(38, relativeTo: .largeTitle))
                    .foregroundColor(ZylodColor.primary)
            }
            Text("Verify Your Identity")
                .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                .foregroundColor(ZylodColor.onBackground)
        }
    }

    private var subtitle: some View {
        Group {
            if phoneOrEmail.isEmpty {
                Text("We've sent a code \(purposeLabel) to your registered contact. Please enter the 6-digit code below to continue.")
            } else {
                Text("We've sent a code \(purposeLabel) to \(Self.maskTarget(phoneOrEmail)). Please enter the 6-digit code below to continue.")
            }
        }
        .font(ZylodFont.scaled(14, relativeTo: .body))
        .foregroundColor(ZylodColor.onMuted)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)
    }

    private var purposeLabel: String {
        switch purpose {
        case .login: return "to sign in to your account"
        case .register: return "to complete your registration"
        case .resetPassword: return "to reset your password"
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            .foregroundColor(ZylodColor.destructive)
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
    }

    private var resendSection: some View {
        HStack(spacing: 4) {
            Text("Didn't receive the code?")
                .foregroundColor(ZylodColor.onMuted)
            if remaining > 0 {
                Text("Resend in \(String(format: "%02d:%02d", remaining / 60, remaining % 60))")
                    .foregroundColor(ZylodColor.primary)
            } else {
                Button {
                    Task { await resend() }
                } label: {
                    Text(isResending ? "Sending..." : "Resend Code")
                        .foregroundColor(ZylodColor.primary)
                }
            }
        }
        .font(ZylodFont.scaled(12, relativeTo: .footnote))
    }

    private var securityNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "shield.lefthalf.filled")
                .font(ZylodFont.scaled(14, relativeTo: .body))
                .foregroundColor(ZylodColor.onMuted)
            Text("Zylod will never ask for your account password or other sensitive details via SMS or email.")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.muted.opacity(0.4)))
    }

    // MARK: - Verify (otp-verification-page.tsx handleVerify:50-208)

    private func verify(_ otpValue: String) async {
        guard otpValue.count == 6 else {
            errorMessage = "Please enter all 6 digits"
            hasAutoSubmitted = false
            return
        }
        guard !phoneOrEmail.isEmpty else {
            errorMessage = "Missing verification target. Please restart the flow."
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
            // Server contract: {phoneOrEmail, code} — otp/verify/route.ts:8.
            let data = try await client.otpVerify(phoneOrEmail: phoneOrEmail, code: otpValue)

            switch purpose {
            case .login:
                if let token = data.token, data.user != nil {
                    await AuthSession.signInAndHydrate(user: data.user, token: token)
                    ToastCenter.shared.show("Welcome back!", tone: .success)
                    onAuthenticated()
                } else {
                    errorMessage = data.message ?? "Verification failed."
                    hasAutoSubmitted = false
                }
            case .register:
                // OTP verified → create the real account from the pending payload.
                await completeRegistration()
            case .resetPassword:
                if let resetToken = data.resetToken {
                    push(.resetPassword(token: resetToken))
                } else {
                    errorMessage = "Reset session expired. Please request a new link."
                    hasAutoSubmitted = false
                }
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

    /// register branch: pending draft → POST api/auth/register
    /// {…draft, authProvider:'phone_otp', isPhoneVerified/isEmailVerified}.
    private func completeRegistration() async {
        guard let pending = flow.pendingRegistration else {
            errorMessage = "Registration session lost. Please start again."
            hasAutoSubmitted = false
            return
        }
        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                hasAutoSubmitted = false
                return
            }
            let isEmailChannel = phoneOrEmail.contains("@")
            let response = try await client.register(.init(
                userType: "buyer",
                email: pending.email,
                phone: pending.phone,
                password: pending.password,
                authProvider: "phone_otp",
                fullName: pending.fullName,
                businessName: pending.businessName,
                businessType: nil,
                city: nil,
                nidNumber: nil,
                nidFrontImageUrl: nil,
                nidBackImageUrl: nil,
                tradeLicenseNumber: nil,
                tradeLicenseImageUrl: nil,
                tinNumber: nil,
                bankName: nil,
                bankAccountName: nil,
                bankAccountNumber: nil,
                branch: nil,
                isPhoneVerified: !isEmailChannel,
                isEmailVerified: isEmailChannel
            ))

            flow.pendingRegistration = nil

            if let token = response.token, response.user != nil {
                AuthSession.profileFromRegistration(
                    user: response.user,
                    token: token,
                    fullName: pending.fullName,
                    businessName: pending.businessName,
                    completionPct: 20
                )
                ToastCenter.shared.show("Account created successfully!", tone: .success)
                onAuthenticated()
            } else {
                errorMessage = "Account creation failed"
                hasAutoSubmitted = false
            }
        } catch let failure as ApiFailure {
            errorMessage = failure.error
            hasAutoSubmitted = false
        } catch {
            errorMessage = "Account creation failed. Please try again."
            hasAutoSubmitted = false
        }
    }

    // MARK: - Resend

    private func resend() async {
        guard remaining <= 0 else { return }
        isResending = true
        defer { isResending = false }
        do {
            guard let client = await AuthSession.client() else {
                ToastCenter.shared.show("Invalid server address", tone: .error)
                return
            }
            _ = try await client.otpSend(phoneOrEmail: phoneOrEmail, purpose: purpose.rawValue)
            ToastCenter.shared.show("A new verification code has been sent!", tone: .success)
            code = ""
            hasAutoSubmitted = false
            remaining = 58
        } catch let failure as ApiFailure {
            ToastCenter.shared.show(failure.error, tone: .error)
        } catch {
            ToastCenter.shared.show("Network error. Please try again.", tone: .error)
        }
    }

    /// Web maskTarget (otp-verification-page.tsx:20-28).
    static func maskTarget(_ target: String) -> String {
        guard !target.isEmpty else { return "" }
        if target.contains("@"), let at = target.firstIndex(of: "@") {
            let name = String(target[target.startIndex..<at])
            let domain = String(target[target.index(after: at)...])
            let shown = name.prefix(2)
            let dots = String(repeating: "•", count: max(name.count - 2, 2))
            return "\(shown)\(dots)@\(domain)"
        }
        let head = target.prefix(6)
        let tail = target.suffix(4)
        let dots = String(repeating: "•", count: max(target.count - 10, 3))
        return "\(head)\(dots)\(tail)"
    }
}
