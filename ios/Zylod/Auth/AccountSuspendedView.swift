import SwiftUI

// §3.6/§10 — suspended-account screen, native per the Phase-1 ship-shape
// decision (spec §10: "recommended: native account-suspended (login branch
// renders it)"). Structure mirrors src/components/pages/account-suspended-page.tsx:
// hero icon → headline → reason/status card → reference footer. The web's
// appeal button (POST api/support/contact) is a Phase 2 support-suite item —
// surfaced instead as an honest note; Sign out clears the session and returns
// to Login.

struct AccountSuspendedView: View {
    let reason: String
    let reference: String
    let suspendedAt: String?
    var pop: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                headline
                infoCard
                signOutSection
                footer
            }
            .padding(.bottom, 28)
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .scrollDismissesKeyboard(.interactively)
        .zylodEntrance()
    }

    private var hero: some View {
        ZStack {
            Circle()
                .fill(ZylodColor.destructive.opacity(0.1))
                .frame(width: 112, height: 112)
            Image(systemName: "exclamationmark.triangle.fill")
                .font(ZylodFont.scaled(52, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.primary)
        }
        .padding(.top, 40)
        .padding(.bottom, 16)
    }

    private var headline: some View {
        VStack(spacing: 6) {
            Text("Your account has been temporarily suspended")
                .font(ZylodFont.scaled(22, .semibold, relativeTo: .title2))
                .foregroundColor(ZylodColor.onBackground)
                .multilineTextAlignment(.center)
            Text("Account functions (buying, selling, and messaging) are restricted while our compliance team completes a manual review.")
                .font(ZylodFont.scaled(13, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 18)
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(ZylodFont.scaled(16, relativeTo: .body))
                    .foregroundColor(ZylodColor.primary)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Reason for Suspension")
                        .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                    Text(reason.isEmpty ? "Our security compliance team needs to review recent activity on your account before it can be restored." : reason)
                        .font(ZylodFont.scaled(12, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                        .lineSpacing(2)
                }
            }
            .padding(16)

            Rectangle().fill(ZylodColor.border.opacity(0.6)).frame(height: 1)

            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "clock")
                    .font(ZylodFont.scaled(16, relativeTo: .body))
                    .foregroundColor(ZylodColor.primary)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Current Status")
                        .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                    Text("Typically resolved within 24-48 business hours. Updates are sent to your registered email as the review progresses.")
                        .font(ZylodFont.scaled(12, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                        .lineSpacing(2)
                }
            }
            .padding(16)
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
        .padding(.horizontal, 16)
    }

    private var signOutSection: some View {
        VStack(spacing: 10) {
            ZylodButton(title: "Sign Out", systemImage: "rectangle.portrait.and.arrow.right") {
                SessionManager.signOut()
                ToastCenter.shared.show("Signed out", tone: .info)
                pop()
            }
            .padding(.horizontal, 16)
            Text("Sign out to return to the login screen.")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
        .padding(.top, 22)
    }

    private var footer: some View {
        VStack(spacing: 4) {
            if !reference.isEmpty {
                Text("Reference Ticket: #\(reference.hasPrefix("BD-") ? reference : "BD-\(reference)")")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            if let suspendedAt, !suspendedAt.isEmpty {
                Text("Suspended \(Self.formatted(suspendedAt))")
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.onMuted)
            }
            Text("© \(Self.year) Zylod Global Marketplace")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
        }
        .padding(.top, 18)
    }

    // MARK: Helpers

    private static var year: String {
        String(Calendar.current.component(.year, from: Date()))
    }

    /// suspension.suspendedAt is an ISO timestamp from the login 403 body —
    /// render en-GB date style like the web's toLocaleDateString calls.
    private static func formatted(_ raw: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: raw)
            ?? ISO8601DateFormatter().date(from: raw)
        guard let date else { return raw }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}
