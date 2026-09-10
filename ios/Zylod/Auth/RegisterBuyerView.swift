import SwiftUI

// Faithful port of src/components/pages/register-buyer-page.tsx (§3.4).
// Step 1: validate → POST api/auth/otp/send {phoneOrEmail, purpose:'register'}
// → stash the draft in AppFlow (web: sessionStorage zylod-pending-registration)
// → push OtpVerificationView(.register), which completes
// POST api/auth/register {userType:'buyer', authProvider:'phone_otp', …}.
// Server errors surfaced inline: 409 DUPLICATE_EMAIL/DUPLICATE_PHONE,
// 400 WEAK_PASSWORD, plus the OTP step's 409 "User already exists".

struct RegisterBuyerView: View {
    var push: (AuthRoute) -> Void
    var pop: () -> Void
    var onAuthenticated: () -> Void
    @EnvironmentObject private var flow: AppFlow

    @State private var fullName = ""
    @State private var businessName = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var password = ""
    @State private var usePhone = true
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                VStack(alignment: .leading, spacing: 14) {
                    ZylodTextField(label: "Full Name *", placeholder: "Your full name", text: $fullName, autocapitalization: .words)
                    ZylodTextField(label: "Business Name (Optional)", placeholder: "Your business/shop name", text: $businessName, autocapitalization: .words)
                    channelToggle
                    if usePhone {
                        ZylodTextField(label: "Phone Number *", placeholder: "+880 1700-000000", text: $phone, keyboardType: .phonePad)
                        Text("We'll send a 6-digit OTP to verify your phone number")
                            .font(ZylodFont.scaled(11, relativeTo: .caption))
                            .foregroundColor(ZylodColor.onMuted)
                    } else {
                        ZylodTextField(label: "Email Address *", placeholder: "you@example.com", text: $email, keyboardType: .emailAddress)
                        Text("We'll send a verification code to your email")
                            .font(ZylodFont.scaled(11, relativeTo: .caption))
                            .foregroundColor(ZylodColor.onMuted)
                    }
                    ZylodPasswordField(label: "Password *", placeholder: "Minimum 8 characters", text: $password)
                    if let errorMessage {
                        errorBanner(errorMessage)
                    }
                    ZylodButton(title: "Send OTP & Continue", systemImage: "arrow.right", loading: isLoading) {
                        Task { await submit() }
                    }
                }
                .padding(14)
                .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
                loginLink
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .zylodEntrance()
    }

    private var header: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(ZylodColor.primary)
                    .frame(width: 46, height: 46)
                Image(systemName: "building.2")
                    .font(ZylodFont.scaled(20, relativeTo: .title3))
                    .foregroundColor(ZylodColor.onPrimary)
            }
            Text("Register as Buyer")
                .font(ZylodFont.scaled(22, .bold, relativeTo: .title3))
                .foregroundColor(ZylodColor.onBackground)
            Text("Join Zylod to buy products at wholesale prices")
                .font(ZylodFont.scaled(12, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
        }
    }

    private var channelToggle: some View {
        HStack(spacing: 8) {
            channelButton("Phone", icon: "phone.fill", selected: usePhone) { usePhone = true }
            channelButton("Email", icon: "envelope.fill", selected: !usePhone) { usePhone = false }
        }
    }

    private func channelButton(_ title: String, icon: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                Text(title)
                    .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
            }
            .frame(maxWidth: .infinity, minHeight: 36)
            .foregroundColor(selected ? ZylodColor.onPrimary : ZylodColor.onMuted)
            .background(RoundedRectangle(cornerRadius: 8).fill(selected ? ZylodColor.primary : ZylodColor.muted.opacity(0.5)))
        }
    }

    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(ZylodFont.scaled(12, relativeTo: .footnote))
            .foregroundColor(ZylodColor.destructive)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.destructive.opacity(0.07)))
    }

    private var loginLink: some View {
        HStack(spacing: 4) {
            Text("Already have an account?")
                .foregroundColor(ZylodColor.onMuted)
            Button(action: pop) {
                Text("Log In")
                    .foregroundColor(ZylodColor.primary)
            }
        }
        .font(ZylodFont.scaled(12, relativeTo: .footnote))
    }

    // MARK: - Submit (register-buyer-page.tsx:31-94)

    private func submit() async {
        errorMessage = nil

        let trimmedName = fullName.trimmingCharacters(in: .whitespaces)
        let trimmedPhone = phone.trimmingCharacters(in: .whitespaces)
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces).lowercased()

        if trimmedName.isEmpty { errorMessage = "Please enter your full name"; return }
        if usePhone && trimmedPhone.isEmpty { errorMessage = "Please enter your phone number"; return }
        if !usePhone && trimmedEmail.isEmpty { errorMessage = "Please enter your email address"; return }
        if usePhone && trimmedPhone.filter({ $0.isNumber }).count < 8 {
            errorMessage = "Please enter a valid phone number"
            return
        }
        if !usePhone && !trimmedEmail.contains("@") {
            errorMessage = "Please enter a valid email address"
            return
        }
        if password.isEmpty { errorMessage = "Please enter a password"; return }
        if password.count < 8 { errorMessage = "Password must be at least 8 characters"; return }

        isLoading = true
        defer { isLoading = false }

        do {
            guard let client = await AuthSession.client() else {
                errorMessage = "Invalid server address"
                return
            }
            let target = usePhone ? trimmedPhone : trimmedEmail
            _ = try await client.otpSend(phoneOrEmail: target, purpose: OtpPurpose.register.rawValue)

            // Carry the registration payload through the OTP step (web:
            // sessionStorage zylod-pending-registration — never in the URL).
            flow.pendingRegistration = RegistrationDraft(
                fullName: trimmedName,
                businessName: businessName.trimmingCharacters(in: .whitespaces).isEmpty ? nil : businessName.trimmingCharacters(in: .whitespaces),
                email: usePhone ? nil : trimmedEmail,
                phone: usePhone ? trimmedPhone : nil,
                password: password
            )
            ToastCenter.shared.show("OTP sent successfully!", tone: .success)
            push(.otp(phoneOrEmail: target, purpose: OtpPurpose.register.rawValue))
        } catch let failure as ApiFailure {
            if failure.status == 409 {
                errorMessage = "An account with this contact already exists — try logging in."
            } else {
                errorMessage = failure.error
            }
        } catch {
            errorMessage = "An unexpected error occurred. Please try again."
        }
    }
}
