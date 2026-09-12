# Runtime Provenance — Audit Guide (F1/F5)

Owner remediation order F1 requires the installed APK/IPA to answer, from the
device alone:

    exact build → exact web source → exact web bundle commit

F5 requires that answer to be permanently visible in diagnostics. This document
is the audit procedure.

## 1. The provenance chain

| Link | Source |
|---|---|
| Native build | `versionName` / `CFBundleShortVersionString` = `2.4.5-<short-sha>` (CI stamps `-PcommitSuffix` / PlistBuddy). Visible on-device in Settings → Apps. |
| Endpoint selection | `ServerConfig` probe matrix (Android `data/api/ServerConfig.kt`, iOS `Networking/ServerConfig.swift`) — every candidate, its HTTP status, whether it is a genuine Zylod server, and the selection reason, logged per resolve. Endpoint changes are logged as `ENDPOINT CHANGED`. |
| Served web bundle | `window.__ZylodBundleIdentity` — `{commit, shortCommit, version, builtAt}` baked into every web build by `scripts/generate-bundle-identity.mjs`, injected inline in `<head>` (src/app/layout.tsx) before any hydration, and reported by `GET /api/app/version` (`bundle` field). |
| Acceptance | `WebProvenance` (Android `session/WebProvenance.kt`, iOS `Web/WebProvenance.swift`): identity MISSING → blocked on every build type; identity MISMATCH → blocked in release, visible diagnostics banner in debug. The web content is revealed only after the authoritative verification confirms identity + contract + live committed pageId/params for the current navigation generation. |

## 2. One-command audits

Android (installed APK on a device):

    adb logcat -s ZylodProvenance

Expected lines per launch/navigation:

    app=2.4.5-<sha7> buildType=debug|release expectedCommit=<sha7> endpoints=...
    probe endpoint=<url> status=<code|unreachable> zylodPayload=true|false alive=true|false
    selected endpoint=<url> reason=first-alive-in-order
    served endpoint=<url> bundle=<sha7> version=2.4.5 builtAt=<iso> verdict=OK
    served endpoint=<url> bundle=NONE verdict=UNKNOWN action=BLOCKED        ← unknown bundle refused
    served endpoint=<url> bundle=<sha7> expected=<sha7> verdict=MISMATCH action=BLOCKED ← release
    served endpoint=<url> bundle=<sha7> expected=<sha7> verdict=MISMATCH action=VISIBLE-IN-DIAGNOSTICS(non-blocking) ← debug

iOS (simulator/device):

    log stream --predicate 'category == "ZylodProvenance"'

(any `log`/Console.app filter on subsystem `com.zylod.wholesale`, category
`ZylodProvenance`; identical line formats).

## 3. HTTP check (what a genuine server reports)

    curl -s https://<endpoint>/api/app/version | head -c 400

A genuine Zylod server answers `"success": true` **and** reports the bundle it
serves:

    {"success":true,"bundle":{"commit":"<full-sha>","shortCommit":"<sha7>","version":"2.4.5","builtAt":"<iso>"},...}

A redirect stub, captive portal or foreign server has no `bundle` — the shells
log `zylodPayload=false` and, if such a host wins discovery, the WebView gate
refuses to render it (`verdict=UNKNOWN action=BLOCKED`) instead of silently
showing whatever HTML the host returned.

## 4. Verifying a CI artifact is the audited commit

1. CI appends the artifact name with the full SHA: `Zylod-debug-apk-<sha>`,
   `Zylod-ios-simulator-<sha>`.
2. APK: `versionName` in `output-metadata.json` (in the artifact, and visible
   on-device) is `2.4.5-<sha7>`; parse the binary AndroidManifest string pool
   for `2.4.5-<sha7>` to confirm.
3. IPA/simulator `.app`: `CFBundleShortVersionString` in Info.plist is
   `2.4.5-<sha7>` (CI stamps it post-build; the running app reads it back as
   its `expectedCommit`).
4. Deploy the WEB bundle from the SAME commit: the deployed bundle's
   `__ZylodBundleIdentity.shortCommit` must equal the app's `expectedCommit`.
   `verdict=OK` in the logs is the proof the device executed the intended
   bundle.

## 5. Acceptance policy (binding, owner order F1)

- **Missing identity** (stub/foreign/stale pre-provenance bundle): blocked on
  debug AND release builds — the provenance gate replaces the content.
- **Wrong commit**: blocked in release. In debug the exact divergence
  (`DEV bundle <served> @ <endpoint> (app: <expected>)`) stays visible at the
  top of the surface — dev endpoints legitimately serve arbitrary working-tree
  commits, and the owner's order requires the selected endpoint and served
  identity to be *visible* there, never silent.
- The gate message carries the exact divergence (endpoint, served identity,
  expected commit) so the failure is diagnosable from the screen itself.
