import Foundation
import os

// F1/F5 — RUNTIME PROVENANCE (iOS mirror of android session/WebProvenance.kt).
//
// Owner's binding remediation order:
//  F1 "The installed IPA must be able to answer: exact build → exact web
//      source → exact web bundle commit. A wrong/stale/unknown bundle must
//      never be silently accepted."
//  F5 "Add the bundle commit/version marker and make it visible in
//      diagnostics/logging so a future owner audit can immediately prove
//      which web bundle the device is executing."
//
// Every web bundle build bakes its identity into
// `window.__ZylodBundleIdentity` (scripts/generate-bundle-identity.mjs) and
// GET /api/app/version. After every document load the shell reads that
// identity via WebShellScripts.documentVerifyScript, compares it with the
// commit THIS native build was produced from (CFBundleShortVersionString
// suffix, stamped by CI), and applies the acceptance policy below.
//
// Owner audit is one command:
//     log stream --predicate 'category == "ZylodProvenance"'
//
// Acceptance policy (F1: no silent acceptance):
//  - identity MISSING  → blocking on EVERY configuration (unknown bundle is
//    never rendered as if it were the app);
//  - identity MISMATCH → blocking in release; in DEBUG the exact served
//    identity stays visible in diagnostics (debug builds may use development
//    endpoints, but the selected endpoint and the exact served bundle
//    identity must be visible — surfaced, never silent).

enum WebProvenance {

    /// The ONE log category for every provenance line (F5).
    static let logCategory = "ZylodProvenance"
    static let logSubsystem = "com.zylod.wholesale"

    private static let logger = Logger(subsystem: logSubsystem, category: logCategory)

    /// Identity reported by the served web bundle.
    struct BundleIdentity: Equatable {
        var commit: String
        var shortCommit: String
        var version: String
        var builtAt: String
    }

    enum Verdict: Equatable {
        /// Served bundle matches this build (or the build declares no commit).
        case ok(BundleIdentity)
        /// A known bundle, but not the one this native build was made from.
        case mismatch(identity: BundleIdentity, expectedCommit: String)
        /// No identity at all — stub/foreign/stale bundle. Never accepted.
        case missing
    }

    /// The commit this native build was produced from (CI stamps
    /// CFBundleShortVersionString = "2.4.5-<sha7>" in the artifact).
    static func expectedCommit() -> String? {
        let name = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? ""
        let parts = name.split(separator: "-", maxSplits: 1)
        guard parts.count == 2 else { return nil }
        let suffix = String(parts[1])
        return suffix.isEmpty ? nil : suffix
    }

    static var isDebugBuild: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    static func logAppIdentity(candidates: [String]) {
        let type = isDebugBuild ? "debug" : "release"
        logger.info("app=\(Self.versionName()) buildType=\(type, privacy: .public) expectedCommit=\(Self.expectedCommit() ?? "undeclared", privacy: .public) endpoints=\(candidates.joined(separator: ","), privacy: .public)")
    }

    static func versionName() -> String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "2.4.5"
    }

    /// Parses the verify probe's identity object ({commit, shortCommit,
    /// version, builtAt}) — nil when the bundle exposes no usable identity.
    static func parseIdentity(_ raw: Any?) -> BundleIdentity? {
        guard let dict = raw as? [String: Any] else { return nil }
        guard let commit = dict["commit"] as? String, !commit.isEmpty, commit != "null" else { return nil }
        let short = (dict["shortCommit"] as? String) ?? String(commit.prefix(7))
        return BundleIdentity(
            commit: commit,
            shortCommit: short.isEmpty ? String(commit.prefix(7)) : short,
            version: (dict["version"] as? String) ?? "",
            builtAt: (dict["builtAt"] as? String) ?? "",
        )
    }

    /// THE acceptance policy. In debug builds a mismatch is visible (not
    /// blocking); release enforces the exact bundle.
    static func evaluate(_ identity: BundleIdentity?) -> Verdict {
        guard let id = identity else { return .missing }
        guard let expected = expectedCommit() else { return .ok(id) }
        if id.commit.hasPrefix(expected) || expected == id.shortCommit {
            return .ok(id)
        }
        return .mismatch(identity: id, expectedCommit: expected)
    }

    static func blocking(_ verdict: Verdict) -> Bool {
        switch verdict {
        case .ok: return false
        case .mismatch: return !isDebugBuild
        case .missing: return true
        }
    }

    static func logServed(endpoint: String, verdict: Verdict) {
        switch verdict {
        case let .ok(id):
            logger.info("served endpoint=\(endpoint, privacy: .public) bundle=\(id.shortCommit, privacy: .public) version=\(id.version, privacy: .public) builtAt=\(id.builtAt, privacy: .public) verdict=OK")
        case let .mismatch(id, expected):
            if isDebugBuild {
                logger.warning("served endpoint=\(endpoint, privacy: .public) bundle=\(id.shortCommit, privacy: .public) expected=\(expected, privacy: .public) verdict=MISMATCH action=VISIBLE-IN-DIAGNOSTICS(non-blocking)")
            } else {
                logger.error("served endpoint=\(endpoint, privacy: .public) bundle=\(id.shortCommit, privacy: .public) expected=\(expected, privacy: .public) verdict=MISMATCH action=BLOCKED")
            }
        case .missing:
            logger.error("served endpoint=\(endpoint, privacy: .public) bundle=NONE verdict=UNKNOWN action=BLOCKED (a wrong/stale/unknown bundle is never silently accepted)")
        }
    }
}
