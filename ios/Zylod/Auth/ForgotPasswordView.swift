import SwiftUI

// §3.6 — forgot-password flow: contact entry → OTP (purpose reset_password) →
// resetToken → ResetPasswordView. The OTP-based reset path is the server-real
// contract (otp/send accepts purpose 'reset_password'; otp/verify mints a
// single-use resetToken, otp/verify/route.ts:54-82).

struct ForgotPasswordView: View {
    var push: (AuthRoute) -> Void
    var pop: () -> Void

    @State private var contact = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(ZylodColor.primary.opacity(0.09))
                            .frame(width: 104, height: 104)
                        Image(systemName: "lock.rotation")
                            .font(ZylodFont.scaled(36, relativeTo: .largeTitle))
                            .foregroundColor(ZylodColor.primary)
                    }
                    Text("Forgot Password")
                        .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                        .foregroundColor(ZylodColor.onBackground)
                    Text("Enter your registered email or phone number and we'll send a 6-digit verification code.")
                        .font(ZylodFont.scaled(13, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                        .multilineTextAlignment(.center)
                }
                VStack(alignment: .leading, spacing: 14) {
                    ZylodTextField(label: "Email or Phone Number", placeholder: "name@company.com", text: $contact, keyboardType: .emailAddress)
                    if let errorMessage {
                        Text(errorMessage)
                            .font(ZylodFont.scaled(12, relativeTo: .footnote))
                            .foregroundColor(ZylodColor.destructive)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
                    }
                    ZylodButton(title: "Send Verification Code", systemImage: "arrow.right", loading: isLoading) {
                        Task { await submit() }
                    }
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
                HStack(spacing: 4) {
                    Text("Remembered it?")
                        .foregroundColor(ZylodColor.onMuted)
                    Button(action: pop) {
                        Text("Back to Login")
                            .foregroundColor(ZylodColor.primary)
                    }
                }
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .zylodEntrance()
    }

    private func submit() async {
        errorMessage = nil
        let target = contact.trimmingCharacters(in: .whitespaces)
        guard !target.isEmpty else {
            errorMessage = "Please enter your email or phone number"
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }
            _ = try await client.otpSend(phoneOrEmail: target, purpose: OtpPurpose.resetPassword.rawValue)
            ToastCenter.shared.show("Verification code sent", tone: .success)
            push(.otp(phoneOrEmail: target, purpose: OtpPurpose.resetPassword.rawValue))
        } catch let failure as ApiFailure {
            errorMessage = failure.error
        } catch {
            errorMessage = "Network error. Please check your connection and try again."
        }
    }
}

// §3.6 — ResetPasswordView lives in Auth/ResetPasswordView.swift (its own
// screen file, matching the Phase 1 layout).
