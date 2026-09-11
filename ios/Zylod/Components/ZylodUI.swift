import SwiftUI

// Shared small components for the Phase 1 native screens. Every primitive is
// token-driven (ZylodColor / ZylodFont.scaled) — no hardcoded Color.white etc.
// (Phase 0 D-fix rule), all text scales with Dynamic Type.

// MARK: - Entrance animation (web canonical: opacity 0→1, y 20→0)

struct EntranceModifier: ViewModifier {
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 20)
            .onAppear {
                withAnimation(.easeOut(duration: 0.5)) { shown = true }
            }
    }
}

extension View {
    /// Canonical web page-entrance animation (framer-motion fadeUp, 299 files).
    func zylodEntrance() -> some View {
        modifier(EntranceModifier())
    }
}

// MARK: - Buttons

/// Primary filled button (web `button` default variant: h-12/52px, primary bg).
struct ZylodButton: View {
    let title: String
    var systemImage: String? = nil
    var loading = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button {
            guard enabled, !loading else { return }
            action()
        } label: {
            HStack(spacing: 8) {
                if loading {
                    ProgressView()
                        .tint(ZylodColor.onPrimary)
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                }
                Text(title)
                    .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
            }
            .frame(maxWidth: .infinity, minHeight: 50)
        }
        .foregroundColor(enabled && !loading ? ZylodColor.onPrimary : ZylodColor.onPrimary.opacity(0.6))
        .background(RoundedRectangle(cornerRadius: 10).fill(enabled ? ZylodColor.primary : ZylodColor.primary.opacity(0.5)))
        .disabled(!enabled || loading)
    }
}

/// Outlined button (web `outline` variant).
struct ZylodOutlineButton: View {
    let title: String
    var systemImage: String? = nil
    var tint: Color = ZylodColor.primary
    var loading = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button {
            guard enabled, !loading else { return }
            action()
        } label: {
            HStack(spacing: 6) {
                if loading {
                    ProgressView()
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(ZylodFont.scaled(13, .semibold, relativeTo: .body))
                }
                Text(title)
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .body))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 46)
        }
        .foregroundColor(tint)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(tint, lineWidth: 1))
        .disabled(!enabled || loading)
    }
}

// MARK: - Text fields

/// Labeled input mirroring the web Input + Label pair.
struct ZylodTextField: View {
    let label: String
    var placeholder: String = ""
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: UITextAutocapitalizationType = .none
    var errorText: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .autocapitalization(autocapitalization)
                .disableAutocorrection(true)
                .font(ZylodFont.scaled(14, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
                .padding(.horizontal, 12)
                .frame(minHeight: 46)
                .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.background))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(errorText == nil ? ZylodColor.input : ZylodColor.destructive, lineWidth: 1))
            if let errorText {
                Text(errorText)
                    .font(ZylodFont.scaled(11, relativeTo: .caption))
                    .foregroundColor(ZylodColor.destructive)
            }
        }
    }
}

/// Secure input with show/hide toggle (web password field).
struct ZylodPasswordField: View {
    let label: String
    var placeholder: String = ""
    @Binding var text: String
    @State private var visible = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                .foregroundColor(ZylodColor.onBackground)
            HStack(spacing: 8) {
                if visible {
                    TextField(placeholder, text: $text)
                        .font(ZylodFont.scaled(14, relativeTo: .body))
                        .foregroundColor(ZylodColor.onBackground)
                        .disableAutocorrection(true)
                } else {
                    SecureField(placeholder, text: $text)
                        .font(ZylodFont.scaled(14, relativeTo: .body))
                        .foregroundColor(ZylodColor.onBackground)
                        .disableAutocorrection(true)
                }
                Button {
                    visible.toggle()
                } label: {
                    Image(systemName: visible ? "eye.slash" : "eye")
                        .font(ZylodFont.scaled(13, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onMuted)
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 46)
            .background(RoundedRectangle(cornerRadius: 8).fill(ZylodColor.background))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.input, lineWidth: 1))
        }
    }
}

// MARK: - Toast (sonner equivalent)

/// Toast model + overlay: top-positioned card mirroring sonner's rich colors,
/// used by the auth screens and by the native bridge's showToast.
final class ToastCenter: ObservableObject {
    static let shared = ToastCenter()
    @Published var message: String?
    @Published var tone: Tone = .info
    @Published var visible = false
    private var hideTask: Task<Void, Never>?

    enum Tone { case info, success, error }

    @MainActor
    func show(_ message: String, tone: Tone = .info, seconds: Double = 2.6) {
        self.message = message
        self.tone = tone
        withAnimation(.easeOut(duration: 0.25)) { visible = true }
        hideTask?.cancel()
        hideTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.25)) { self?.visible = false }
        }
    }
}

struct ToastOverlay: View {
    @ObservedObject private var center = ToastCenter.shared

    var body: some View {
        VStack {
            if center.visible, let message = center.message {
                HStack(spacing: 8) {
                    Image(systemName: icon)
                        .font(ZylodFont.scaled(13, .semibold, relativeTo: .body))
                        .foregroundColor(tintColor)
                    Text(message)
                        .font(ZylodFont.scaled(12, .medium, relativeTo: .footnote))
                        .foregroundColor(ZylodColor.onBackground)
                        .multilineTextAlignment(.leading)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.card).shadow(color: .black.opacity(0.18), radius: 8, y: 2))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(center.tone == .error ? ZylodColor.destructive.opacity(0.5) : ZylodColor.border, lineWidth: 1))
                .padding(.horizontal, 24)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
        }
        .padding(.top, 8)
        .allowsHitTesting(false)
    }

    private var icon: String {
        switch center.tone {
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        case .info: return "info.circle.fill"
        }
    }

    private var tintColor: Color {
        switch center.tone {
        case .success: return ZylodColor.success
        case .error: return ZylodColor.destructive
        case .info: return ZylodColor.primary
        }
    }
}

// MARK: - Section card

struct SectionCard<Content: View>: View {
    let title: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let title {
                Text(title)
                    .font(ZylodFont.scaled(11, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onMuted)
                    .textCase(.uppercase)
            }
            content
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(ZylodColor.card))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
    }
}

// MARK: - Tier price table (PDP + cart)

/// Tiered pricing row (PDP + cart). Codable because CartItemData (Codable)
/// embeds [TierRow]; Equatable because CartItemData declares Equatable.
struct TierRow: Identifiable, Codable, Equatable {
    let minQty: Int
    let maxQty: Int?
    let pricePerUnit: Double
    var id: String { "\(minQty)-\(maxQty.map(String.init) ?? "plus")" }
}

/// Tiered pricing table (mobile-product-detail-page.tsx) with qty-based
/// highlight and discount pill.
struct TierPriceTable: View {
    let unit: String
    let basePrice: Double
    let tiers: [TierRow]
    let quantity: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tiered Pricing")
                .font(ZylodFont.scaled(11, .semibold, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .textCase(.uppercase)
            VStack(spacing: 0) {
                HStack {
                    Text("Quantity")
                        .font(ZylodFont.scaled(11, .medium, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                    Spacer()
                    Text("Price / \(unit)")
                        .font(ZylodFont.scaled(11, .medium, relativeTo: .caption))
                        .foregroundColor(ZylodColor.onMuted)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(ZylodColor.muted.opacity(0.5))
                ForEach(tiers) { tier in
                    HStack {
                        Text("\(tier.minQty)\(tier.maxQty.map { "-\($0)" } ?? "+") \(unit)")
                            .font(ZylodFont.scaled(12, relativeTo: .footnote))
                            .foregroundColor(ZylodColor.onBackground)
                        Spacer()
                        Text(ZylodFormat.bdt(tier.pricePerUnit))
                            .font(ZylodFont.scaled(12, .semibold, relativeTo: .footnote))
                            .foregroundColor(ZylodColor.onBackground)
                        let discount = basePrice > 0 ? Int((1 - tier.pricePerUnit / basePrice) * 100) : 0
                        if discount > 0 {
                            Text("\(discount)% OFF")
                                .font(ZylodFont.scaled(9, .medium, relativeTo: .caption2))
                                .foregroundColor(ZylodColor.success)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(ZylodColor.success.opacity(0.12)))
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
                    .background(isActive(tier) ? ZylodColor.primary.opacity(0.06) : ZylodColor.card)
                    .overlay(Rectangle().frame(height: 1).foregroundColor(ZylodColor.border.opacity(0.4)), alignment: .top)
                }
            }
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(ZylodColor.border.opacity(0.6), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private func isActive(_ tier: TierRow) -> Bool {
        quantity >= tier.minQty && (tier.maxQty == nil || quantity <= (tier.maxQty ?? Int.max))
    }
}

// MARK: - OTP input boxes

/// 6-box OTP input (web input-otp port). A transparent backing field collects
/// keystrokes and paste; boxes render the digits.
struct OtpInputBoxes: View {
    @Binding var code: String
    var error = false
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            // Hidden collector: grabs keyboard focus, filters to digits, caps at 6.
            TextField("", text: $code)
                .focused($focused)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .foregroundColor(.clear)
                .accentColor(.clear)
                .onChange(of: code) { newValue in
                    let digits = newValue.filter { $0.isNumber }
                    if digits != newValue || digits.count > 6 {
                        code = String(digits.prefix(6))
                    }
                }
        }
        .frame(width: 0, height: 0)
        .background(
            HStack(spacing: 8) {
                ForEach(0..<6, id: \.self) { index in
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(ZylodColor.card)
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(borderColor(for: index), lineWidth: 1)
                        Text(digit(at: index))
                            .font(ZylodFont.scaled(20, .semibold, relativeTo: .title2))
                            .foregroundColor(ZylodColor.onBackground)
                    }
                    .frame(width: 46, height: 52)
                    .onTapGesture { focused = true }
                }
            }
        )
        .onAppear { focused = true }
    }

    private func borderColor(for index: Int) -> Color {
        if error { return ZylodColor.destructive }
        if index == code.count && focused { return ZylodColor.primary }
        return ZylodColor.input
    }

    private func digit(at index: Int) -> String {
        guard index < code.count else { return "" }
        let i = code.index(code.startIndex, offsetBy: index)
        return String(code[i])
    }
}

// MARK: - Stars

struct StarRating: View {
    let value: Double
    var size: CGFloat = 12

    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { index in
                Image(systemName: Double(index) < value.rounded(.down) ? "star.fill" : "star")
                    .font(ZylodFont.scaled(size, relativeTo: .caption2))
                    .foregroundColor(Double(index) < value ? Color(hex: 0xFBBF24) : ZylodColor.border)
            }
        }
    }
}

// MARK: - Remote image (relative /uploads paths resolved against server)

/// Shared image pipeline (Phase 1 remediation, finding #3 — image decoding):
/// NSCache-backed memory tier + shared URLSession with a disk URLCache +
/// ImageIO downsampling. Previously every remote image was fetched and
/// decoded at FULL resolution on every appearance — the single biggest
/// scroll-jank source in Home/Cart/PDP galleries (parity with the Android
/// Coil pipeline configured in ZylodApp.createImageLoader).
enum ZylodImagePipeline {
    private static let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 400
        // COST LIMIT (round-3 Home-scroll finding): a 900px decode is ~3.2MB;
        // 400 uncapped entries could hold >1GB before eviction, so a long
        // fling evicted mid-scroll and re-downloaded/re-decoded the SAME
        // images. A 96MB ceiling (~30 grid images) keeps eviction rare and
        // predictable under memory pressure.
        c.totalCostLimit = 96 * 1024 * 1024
        return c
    }()

    private static let session: URLSession = {
        let conf = URLSessionConfiguration.default
        conf.urlCache = URLCache(
            memoryCapacity: 32 * 1024 * 1024,
            diskCapacity: 128 * 1024 * 1024,
            directory: nil
        )
        conf.requestCachePolicy = .returnCacheDataElseLoad
        conf.timeoutIntervalForRequest = 20
        return URLSession(configuration: conf)
    }()

    static func image(for url: URL, maxPixel: CGFloat = 600) async -> UIImage? {
        let key = "\(url.absoluteString)#\(Int(maxPixel))" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        guard let (data, response) = try? await session.data(from: url),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode),
              let decoded = downsampled(data: data, maxPixel: maxPixel)
        else { return nil }
        cache.setObject(decoded, forKey: key, cost: decoded.estimatedByteCost)
        return decoded
    }

    /// Decode at display size (ImageIO thumbnail) instead of the full bitmap —
    /// a 1600px product photo decodes to ~900px at a fraction of the memory
    /// and without the main-thread decode spike.
    private static func downsampled(data: Data, maxPixel: CGFloat) -> UIImage? {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions) else { return nil }
        let thumbnailOptions = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ] as CFDictionary
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

private extension UIImage {
    /// Approximate decoded bitmap size for NSCache cost accounting.
    var estimatedByteCost: Int {
        guard let cg = cgImage else { return 1 }
        return cg.bytesPerRow * cg.height
    }
}

struct RemoteImageView: View {
    let rawPath: String?
    let serverUrl: String
    var cornerRadius: CGFloat = 0
    var placeholderSize: CGFloat = 20

    private var resolved: URL? {
        guard let raw = rawPath, !raw.isEmpty, !raw.hasPrefix("/placeholder") else { return nil }
        if raw.hasPrefix("http") { return URL(string: raw) }
        guard !serverUrl.isEmpty else { return nil }
        return URL(string: serverUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + raw)
    }

    @State private var image: UIImage?

    var body: some View {
        ZStack {
            ZylodColor.muted
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Image(systemName: "shippingbox")
                    .font(ZylodFont.scaled(placeholderSize, relativeTo: .body))
                    .foregroundColor(ZylodColor.onMuted)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .task(id: resolved) {
            guard let url = resolved else {
                image = nil
                return
            }
            image = await ZylodImagePipeline.image(for: url)
        }
    }
}

// MARK: - Shimmer skeleton

/// Skeleton with a 1.6s sweep (loading-skeletons.tsx parity, §4.2).
struct SkeletonBlock: View {
    var height: CGFloat
    var cornerRadius: CGFloat = 8
    @State private var phase: CGFloat = -1

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(ZylodColor.muted.opacity(0.7))
            .frame(height: height)
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [.clear, ZylodColor.card.opacity(0.85), .clear],
                        startPoint: .leading, endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.7)
                    .offset(x: phase * geo.size.width * 1.7)
                }
            )
            .clipped()
            .onAppear {
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}
