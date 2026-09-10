import SwiftUI

// §3.6 — reset-password: POST api/auth/reset-password {token, password,
// confirmPassword} (reset-password/route.ts). The server's "Invalid or expired
// reset token" (route.ts:34) surfaces inline with a path back to a fresh
// reset request. Show/hide fields + a strength hint per the web page's
// password meter. Success lands back on login behind an explicit CTA
// (web navigates to the login page on success — the native pop target is the
// auth stack root, reached via the button below).

struct ResetPasswordView: View {
    let token: String
    var push: (AuthRoute) -> Void
    var pop: () -> Void

    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var success = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(ZylodColor.primary.opacity(0.09))
                            .frame(width: 104, height: 104)
                        Image(systemName: "key.fill")
                            .font(ZylodFont.scaled(34, relativeTo: .largeTitle))
                            .foregroundColor(ZylodColor.primary)
                    }
                    Text("Set New Password")
                        .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                        .foregroundColor(ZylodColor.onBackground)
                    Text("Choose a strong password of at least 8 characters.")
                        .font(ZylodFont.scaled(13, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                        .multilineTextAlignment(.center)
                }
                if success {
                    successCard
                } else {
                    formCard
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .zylodEntrance()
    }

    private var successCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(ZylodFont.scaled(34, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.success)
            Text("Password updated successfully")
                .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
            Text("Use your new password next time you sign in.")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            ZylodButton(title: "Back to Login") {
                pop()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
    }

    private var formCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZylodPasswordField(label: "New Password", placeholder: "Minimum 8 characters", text: $password)
            strengthHint
            ZylodPasswordField(label: "Confirm Password", placeholder: "Repeat the password", text: $confirmPassword)
            if let errorMessage {
                Text(errorMessage)
                    .font(ZylodFont.scaled(12, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.destructive)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
            }
            ZylodButton(title: "Reset Password", systemImage: "arrow.right", loading: isLoading) {
                Task { await submit() }
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
    }

    // MARK: Strength hint (web password meter parity — length + class mix)

    private var strengthHint: some View {
        let strength = Self.strength(of: password)
        return VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    Capsule()
                        .fill(index < strength.score ? strength.color : ZylodColor.border.opacity(0.5))
                        .frame(height: 4)
                }
                Text(strength.score == 0 ? "Enter a password" : strength.label)
                    .font(ZylodFont.scaled(10, .medium, relativeTo: .caption2))
                    .foregroundColor(strength.score >= 2 ? ZylodColor.success : (strength.score == 1 ? ZylodColor.warning : ZylodColor.onMuted))
            }
            if strength.score < 2, !password.isEmpty {
                Text("Use 8+ characters with a mix of letters, numbers, and symbols.")
                    .font(ZylodFont.scaled(10, relativeTo: .caption2))
                    .foregroundColor(ZylodColor.onMuted)
            }
        }
    }

    private static func strength(of password: String) -> (score: Int, label: String, color: Color) {
        guard !password.isEmpty else { return (0, "", ZylodColor.border) }
        var classes = 0
        if password.range(of: "[a-z]", options: .regularExpression) != nil { classes += 1 }
        if password.range(of: "[A-Z]", options: .regularExpression) != nil { classes += 1 }
        if password.range(of: "[0-9]", options: .regularExpression) != nil { classes += 1 }
        if password.range(of: "[^a-zA-Z0-9]", options: .regularExpression) != nil { classes += 1 }
        if password.count >= 12, classes >= 3 { return (3, "Strong", ZylodColor.success) }
        if password.count >= 8, classes >= 2 { return (2, "Good", ZylodColor.success) }
        return (1, "Weak", ZylodColor.warning)
    }

    // MARK: Submit (reset-password/route.ts contract)

    private func submit() async {
        errorMessage = nil
        guard !password.isEmpty, !confirmPassword.isEmpty else {
            errorMessage = "All fields are required"
            return
        }
        guard password == confirmPassword else {
            errorMessage = "Passwords do not match"
            return
        }
        guard password.count >= 8 else {
            errorMessage = "Password must be at least 8 characters"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }
            let response = try await client.resetPassword(token: token, password: password, confirmPassword: confirmPassword)
            if response.success == true {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                ToastCenter.shared.show("Password updated — sign in with your new password", tone: .success)
                success = true
            } else {
                errorMessage = response.message ?? "Reset failed. Please try again."
            }
        } catch let failure as ApiFailure {
            // Expired/invalid token (400) — surface with the recovery path.
            if failure.status == 400 {
                errorMessage = "\(failure.error) — request a new code and try again."
            } else {
                errorMessage = failure.error
            }
        } catch {
            errorMessage = "Network error. Please check your connection and try again."
        }
    }
}
