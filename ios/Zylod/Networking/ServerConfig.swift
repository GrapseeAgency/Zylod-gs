import Foundation
import os

/// Resolves the active backend from the same candidate list the Android shell
/// and WebView probe (build-config specific), caching the winner.
///
/// F1 — deterministic, AUDITABLE endpoint discovery (Android parity; owner
/// deployment order: discovery is "acceptable only when the selected server
/// actually serves the matching web bundle"):
///  - every candidate is probed on /api/app/version; the probe records the
///    HTTP status, whether the responder is a GENUINE Zylod server (a 2xx
///    body that reports a bundle identity — docs/PROVENANCE.md §3) and WHICH
///    bundle commit it serves;
///  - SELECTION: the first candidate IN THE FROZEN ORDER that is genuine
///    wins. A host that answers but serves no Zylod bundle identity (redirect
///    stub, captive portal, 404) is skipped and logged — it can no longer
///    beat a genuine server further down the list. Only when NO candidate is
///    genuine does discovery fall back (first-alive → cache → first), with
///    the reason logged and the provenance gate expected to refuse the
///    non-Zylod responder;
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
        /// true when the responder is a genuine Zylod server: 2xx /api/app/version body reporting a bundle identity.
        var zylodPayload: Bool
        /// The bundle commit the endpoint reports (diagnostics; "" when absent).
        var servedCommit: String
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
        var results: [Int: ProbeResult] = [:]
        await withTaskGroup(of: (Int, ProbeResult).self) { group in
            for (index, candidate) in candidates.enumerated() {
                group.addTask {
                    let result = await probe(candidate)
                    return (index, result)
                }
            }
            for await (index, result) in group {
                results[index] = result
            }
        }

        // Ordered probe matrix — the owner sees exactly why a host won.
        for (index, candidate) in candidates.enumerated() {
            let result = results[index] ?? ProbeResult(
                alive: false, httpStatus: nil, zylodPayload: false, servedCommit: "")
            let status = result.httpStatus.map(String.init) ?? "unreachable"
            let served = result.servedCommit.isEmpty ? "none" : String(result.servedCommit.prefix(7))
            logger.info("probe endpoint=\(candidate, privacy: .public) status=\(status, privacy: .public) zylodPayload=\(result.zylodPayload, privacy: .public) servedBundle=\(served, privacy: .public) alive=\(result.alive, privacy: .public)")
        }

        // SELECTION (owner deployment order): the first GENUINE Zylod server
        // in the frozen candidate order wins; a bundle-less responder can
        // never beat a genuine server further down the list.
        let genuineIndex = candidates.indices.first { results[$0]?.zylodPayload == true }
        let firstAliveIndex = candidates.indices.first { results[$0]?.alive == true }
        let previous = cached()
        let chosen = genuineIndex.map { candidates[$0] }
            ?? firstAliveIndex.map { candidates[$0] }
            ?? previous
            ?? candidates[0]
        let reason: String
        if genuineIndex != nil {
            reason = "first-genuine-zylod-in-order"
        } else if firstAliveIndex != nil {
            reason = "no-genuine-endpoint-first-alive(gate-will-refuse)"
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

    /// A candidate is GENUINE when /api/app/version answers 2xx with a JSON
    /// body that reports a non-empty bundle commit (PROVENANCE.md §3 — a
    /// genuine Zylod server always identifies the web bundle it serves).
    private static func probe(_ endpoint: String) async -> ProbeResult {
        guard let url = URL(string: endpoint + "/api/app/version") else {
            return ProbeResult(alive: false, httpStatus: nil, zylodPayload: false, servedCommit: "")
        }
        var request = URLRequest(url: url, timeoutInterval: 6)
        request.setValue("ZylodNative/\(WebProvenance.versionName())", forHTTPHeaderField: "User-Agent")
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            var servedCommit = ""
            if let http, (200..<300).contains(http.statusCode) {
                let json = (try? JSONSerialization.jsonObject(with: data)).flatMap { $0 as? [String: Any] }
                servedCommit = ((json?["bundle"] as? [String: Any])?["commit"] as? String ?? "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
            return ProbeResult(
                alive: true,
                httpStatus: http?.statusCode,
                zylodPayload: !servedCommit.isEmpty,
                servedCommit: servedCommit,
            )
        } catch {
            return ProbeResult(alive: false, httpStatus: nil, zylodPayload: false, servedCommit: "")
        }
    }
}
