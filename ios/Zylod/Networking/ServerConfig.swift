import Foundation
import os

/// Resolves the active backend from the same candidate list the Android shell
/// and WebView probe (build-config specific), caching the winner.
/// Any HTTP response — even 4xx — proves the host is alive.
///
/// F1 — deterministic, AUDITABLE endpoint discovery (Android parity):
///  - every probe is logged (status + whether the responder is a genuine
///    Zylod server) under the ZylodProvenance category;
///  - the selection reason is logged ("first-alive-in-order" is the frozen
///    policy — visibility changes, selection semantics do not);
///  - an endpoint change between resolves is logged prominently — endpoint
///    switching is never silent (owner hard rule).
/// Owner audit:
///     log stream --predicate 'category == "ZylodProvenance"'
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
    private static let logger = Logger(
        subsystem: WebProvenance.logSubsystem,
        category: WebProvenance.logCategory,
    )

    /// Result of probing ONE candidate endpoint.
    struct ProbeResult {
        var alive: Bool
        var httpStatus: Int?
        /// true when the response parses as a Zylod /api/app/version payload.
        var zylodPayload: Bool
    }

    static func cached() -> String? {
        defaults.string(forKey: cacheKey)
    }

    /// Drops the cached winner so the next resolve() re-probes every candidate.
    /// Retry-after-failure must not loop forever on a dead cached host —
    /// parity with android WebScreen retry → ServerConfig.resolve.
    static func invalidateCache() {
        defaults.removeObject(forKey: cacheKey)
    }

    static func resolve() async -> String {
        var alive: [Int: Bool] = [:]
        var results: [Int: ProbeResult] = [:]
        await withTaskGroup(of: (Int, ProbeResult).self) { group in
            for (index, candidate) in candidates.enumerated() {
                group.addTask {
                    let result = await probe(candidate)
                    return (index, result)
                }
            }
            for await (index, result) in group {
                alive[index] = result.alive
                results[index] = result
            }
        }

        // Ordered probe matrix — the owner sees exactly why a host won.
        for (index, candidate) in candidates.enumerated() {
            let result = results[index] ?? ProbeResult(alive: false, httpStatus: nil, zylodPayload: false)
            let status = result.httpStatus.map(String.init) ?? "unreachable"
            logger.info("probe endpoint=\(candidate, privacy: .public) status=\(status, privacy: .public) zylodPayload=\(result.zylodPayload, privacy: .public) alive=\(result.alive, privacy: .public)")
        }

        let chosenIndex = candidates.indices.first { alive[$0] == true }
        let previous = cached()
        let chosen = chosenIndex.map { candidates[$0] }
            ?? previous
            ?? candidates[0]
        let reason: String
        if chosenIndex != nil {
            reason = "first-alive-in-order"
        } else if previous != nil {
            reason = "all-dead-cache-fallback"
        } else {
            reason = "all-dead-default-first"
        }
        if let previous, previous != chosen {
            logger.warning("ENDPOINT CHANGED \(previous, privacy: .public) -> \(chosen, privacy: .public) (reason=\(reason, privacy: .public))")
        }
        logger.info("selected endpoint=\(chosen, privacy: .public) reason=\(reason, privacy: .public)")
        defaults.set(chosen, forKey: cacheKey)
        return chosen
    }

    /// Aliveness stays "any HTTP response" (frozen selection semantics), but
    /// the probe now ALSO fingerprints the responder: a successful
    /// /api/app/version body that parses as the Zylod payload proves the host
    /// is a genuine Zylod server (the payload now carries the served bundle
    /// identity — docs/PROVENANCE.md).
    private static func probe(_ endpoint: String) async -> ProbeResult {
        guard let url = URL(string: endpoint + "/api/app/version") else {
            return ProbeResult(alive: false, httpStatus: nil, zylodPayload: false)
        }
        var request = URLRequest(url: url, timeoutInterval: 6)
        request.setValue("ZylodNative/\(WebProvenance.versionName())", forHTTPHeaderField: "User-Agent")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            var zylodPayload = false
            if let http, (200..<300).contains(http.statusCode) {
                zylodPayload = (try? JSONSerialization.jsonObject(with: data))
                    .flatMap { $0 as? [String: Any] }
                    .map { ($0["success"] as? Bool) == true || $0["bundle"] != nil } ?? false
            }
            return ProbeResult(alive: true, httpStatus: http?.statusCode, zylodPayload: zylodPayload)
        } catch {
            return ProbeResult(alive: false, httpStatus: nil, zylodPayload: false)
        }
    }
}
