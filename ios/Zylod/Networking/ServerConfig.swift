import Foundation

/// Resolves the active backend from the same candidate list the Android shell
/// and WebView probe (build-config specific), caching the winner.
/// Any HTTP response — even 4xx — proves the host is alive.
enum ServerConfig {
    static let candidates: [String] = {
        #if DEBUG
        return [
            "http://192.168.43.79:3000",
            "http://10.0.2.2:3000",
            "http://localhost:3000",
            "https://jugular-winnings-backfield.ngrok-free.dev",
            "https://zylod.com",
        ]
        #else
        return ["https://zylod.com"]
        #endif
    }()

    private static let defaults = UserDefaults.standard
    private static let cacheKey = "native_base_url"

    static func cached() -> String? {
        defaults.string(forKey: cacheKey)
    }

    static func resolve() async -> String {
        var alive: [Int: Bool] = [:]
        await withTaskGroup(of: (Int, Bool).self) { group in
            for (index, candidate) in candidates.enumerated() {
                group.addTask {
                    let ok = await probe(candidate)
                    return (index, ok)
                }
            }
            for await (index, ok) in group {
                alive[index] = ok
            }
        }
        let chosen = candidates.indices
            .first { alive[$0] == true }
            .map { candidates[$0] }
            ?? cached()
            ?? candidates[0]
        defaults.set(chosen, forKey: cacheKey)
        return chosen
    }

    private static func probe(_ endpoint: String) async -> Bool {
        guard let url = URL(string: endpoint + "/api/app/version") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 6)
        request.setValue("ZylodNative/2.5.0", forHTTPHeaderField: "User-Agent")
        do {
            _ = try await URLSession.shared.data(for: request)
            return true
        } catch {
            return false
        }
    }
}
