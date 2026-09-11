import SwiftUI
import UIKit

// Frozen design tokens from /design-tokens.md (source: src/app/globals.css).
// Light values were converted from oklch; dark values are the "Hot Deals"
// hex palette. Dynamic colors follow the system theme, matching next-themes
// enableSystem on the web.

extension UIColor {
    convenience init(zylodHex: UInt32) {
        self.init(
            red: CGFloat((zylodHex >> 16) & 0xFF) / 255,
            green: CGFloat((zylodHex >> 8) & 0xFF) / 255,
            blue: CGFloat(zylodHex & 0xFF) / 255,
            alpha: 1
        )
    }
}

enum ZylodColor {
    static func dynamic(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(zylodHex: dark) : UIColor(zylodHex: light)
        })
    }

    static let background = dynamic(0xFBFAF9, 0x121212)
    static let onBackground = dynamic(0x1C130C, 0xF5F5F5)
    static let card = dynamic(0xFEFDFC, 0x1E1E1E)
    static let popover = dynamic(0xFEFDFC, 0x1E1E1E)
    static let onPopover = dynamic(0x1C130C, 0xF5F5F5)
    static let primary = dynamic(0xC90019, 0xC8102E)
    static let onPrimary = dynamic(0xFEF7F2, 0xFFFFFF)
    static let secondary = dynamic(0xF7F0EB, 0x262626)
    static let onSecondary = dynamic(0x291F18, 0xE5E5E5)
    static let muted = dynamic(0xF5EFEA, 0x262626)
    static let onMuted = dynamic(0x6C6158, 0x9CA3AF)
    static let accent = dynamic(0xFEDBD7, 0x331B20)
    static let onAccent = dynamic(0x2B1E1D, 0xFF8FA0)
    static let destructive = dynamic(0xE7000B, 0xFF6467)
    static let border = dynamic(0xE6E0DB, 0x2E2E2E)
    static let input = dynamic(0xE6E0DB, 0x2E2E2E)
    static let ring = dynamic(0xC90019, 0xC8102E)
    static let success = dynamic(0x008C41, 0x00A045)
    static let onSuccess = dynamic(0xF3FBF5, 0xEAF1EB)
    static let warning = dynamic(0xDFA11A, 0xF0B135)
    static let onWarning = dynamic(0x2E1E01, 0x2E1E01)
}

// Quick-Access chip spec (mobile-promo-icon-grid.tsx) — icon tints and the
// pastel 135° gradients are kept verbatim in both themes (documented web
// artifact; dark-mode fix is a pending web-cleanup item).
enum ZylodChip {
    static let red = [Color(hex: 0xFFEBEE), Color(hex: 0xFFCDD2)]
    static let orange = [Color(hex: 0xFFF3E0), Color(hex: 0xFFE0B2)]
    static let blue = [Color(hex: 0xE3F2FD), Color(hex: 0xBBDEFB)]
    static let green = [Color(hex: 0xE8F5E9), Color(hex: 0xC8E6C9)]
    static let purple = [Color(hex: 0xF3E5F5), Color(hex: 0xE1BEE7)]
    static let teal = [Color(hex: 0xE0F2F1), Color(hex: 0xB2DFDB)]
    static let grey = [Color(hex: 0xECEFF1), Color(hex: 0xCFD8DC)]
}

extension Color {
    init(hex: UInt32) {
        self = Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Token type scale (design-tokens.md §5) rendered with the SYSTEM font and
/// scaled by the user's Dynamic Type setting via UIFontMetrics (D5 fix).
/// Sizes match the frozen spec exactly at the default text size.
enum ZylodFont {
    /// UIFontMetrics re-queries the system content size category on EVERY
    /// call — during fast scrolls that ran thousands of times per second
    /// across every Text in Home/Cart/PDP (audit finding #3). The scaled
    /// value only changes when the point size changes or the user changes
    /// their Dynamic Type setting, so it is cached and invalidated on the
    /// content-size-change notification.
    private static var cache: [CGFloat: CGFloat] = [:]

    private static let resetObserver: NSObjectProtocol = NotificationCenter.default.addObserver(
        forName: UIContentSizeCategory.didChangeNotification,
        object: nil,
        queue: .main
    ) { _ in cache.removeAll() }

    static func scaled(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .system(size: scaledSize(size), weight: weight)
    }

    private static func scaledSize(_ size: CGFloat) -> CGFloat {
        if let hit = cache[size] { return hit }
        let scaled = UIFontMetrics(forTextStyle: .body).scaledValue(for: size)
        cache[size] = scaled
        return scaled
    }
}
