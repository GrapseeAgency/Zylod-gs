import SwiftUI

// Faithful port of src/components/pages/welcome-page.tsx (§3.1).
// Structure: brand header → value-prop slides (3, swipeable, page indicator
// dots) → CTAs.
//
// Documented deviation (per the Phase 1 brief + spec §3.1): the web page's
// controls are Next/Skip only, while the frozen screen spec mandates a CTA
// pair → register-buyer / login plus "Continue as guest". The CTA pair wins
// (it is the contract), slide copy/indicator/illustrations are verbatim.

struct WelcomeSlide: Identifiable {
    let id: Int
    let title: String
    let description: String
    let symbol: String
}

private let slides: [WelcomeSlide] = [
    WelcomeSlide(
        id: 1,
        title: "Source Global",
        description: "Access millions of high-quality products from certified manufacturers worldwide with zero friction.",
        symbol: "ferry.fill"
    ),
    WelcomeSlide(
        id: 2,
        title: "Trade Securely",
        description: "Every transaction is protected with escrow payments, verified suppliers, and end-to-end encryption.",
        symbol: "shield.fill"
    ),
    WelcomeSlide(
        id: 3,
        title: "Scale Faster",
        description: "From bulk orders to custom manufacturing, streamline your wholesale operations on one platform.",
        symbol: "chart.line.uptrend.xyaxis"
    ),
]

struct WelcomeView: View {
    var onLogin: () -> Void
    var onRegisterBuyer: () -> Void
    var onRegisterSupplier: () -> Void
    var onGuest: () -> Void

    @State private var currentSlide = 0

    var body: some View {
        VStack(spacing: 0) {
            // Brand header
            Text("Zylod")
                .font(ZylodFont.scaled(24, .bold, relativeTo: .title2))
                .foregroundColor(ZylodColor.primary)
                .tracking(-0.3)
                .padding(.top, 56)
                .padding(.bottom, 8)

            // Swipeable slide area
            TabView(selection: $currentSlide) {
                ForEach(Array(slides.enumerated()), id: \.element.id) { index, slide in
                    slideContent(slide)
                        .tag(index)
                        .padding(.horizontal, 24)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeOut(duration: 0.35), value: currentSlide)

            // Page indicator dots (active dot widens — web PaginationDots)
            HStack(spacing: 8) {
                ForEach(0..<slides.count, id: \.self) { index in
                    Capsule()
                        .fill(index == currentSlide ? ZylodColor.primary : ZylodColor.border)
                        .frame(width: index == currentSlide ? 28 : 8, height: 8)
                        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: currentSlide)
                }
            }
            .padding(.bottom, 20)

            // CTA pair (spec §3.1) + guest entry
            VStack(spacing: 12) {
                ZylodButton(title: "Create Buyer Account", systemImage: "arrow.right") {
                    onRegisterBuyer()
                }
                ZylodOutlineButton(title: "Log In") {
                    onLogin()
                }
                Button(action: onGuest) {
                    Text("Continue as guest")
                        .font(ZylodFont.scaled(13, .medium, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ZylodColor.background)
        .zylodEntrance()
    }

    private func slideContent(_ slide: WelcomeSlide) -> some View {
        VStack(spacing: 24) {
            illustrationCircle(slide)
                .frame(maxWidth: 300)
                .aspectRatio(1, contentMode: .fit)
            VStack(spacing: 10) {
                Text(slide.title)
                    .font(ZylodFont.scaled(26, .bold, relativeTo: .title2))
                    .foregroundColor(ZylodColor.onBackground)
                    .multilineTextAlignment(.center)
                Text(slide.description)
                    .font(ZylodFont.scaled(15, relativeTo: .body))
                    .foregroundColor(ZylodColor.onMuted)
                    .multilineTextAlignment(.center)
                    .lineLimit(4)
                    .padding(.horizontal, 8)
            }
        }
    }

    /// Pastel gradient circle + inner ring (web IllustrationCircle; the pastel
    /// palette is kept verbatim in both themes like ZylodChip — §4.1).
    private func illustrationCircle(_ slide: WelcomeSlide) -> some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Color(hex: 0xFDE8EC), Color(hex: 0xFFF0F3), Color(hex: 0xF8F9FA)],
                        startPoint: .topLeading, endPoint: .bottomTrailing
                    )
                )
            Circle()
                .strokeBorder(ZylodColor.primary.opacity(0.1), lineWidth: 1)
                .padding(12)
            Image(systemName: slide.symbol)
                .font(ZylodFont.scaled(72, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.primary)
        }
        .shadow(color: .black.opacity(0.06), radius: 12, y: 6)
    }
}
