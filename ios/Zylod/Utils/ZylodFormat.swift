import Foundation

enum ZylodFormat {
    static func bdt(_ value: Double) -> String {
        let symbol = "৳"
        if value.truncatingRemainder(dividingBy: 1) == 0 {
            let grouped = NumberFormatter.localizedString(from: NSNumber(value: value), number: .decimal)
            return symbol + grouped
        }
        return symbol + String(format: "%.2f", value)
    }

    static func compact(_ count: Int) -> String {
        count >= 1000 ? "\(count / 1000)k" : String(count)
    }
}
