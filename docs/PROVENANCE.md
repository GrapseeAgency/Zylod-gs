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
| Endpoint selection | `ServerConfig` probe matrix (Android `data/api/ServerConfig.kt`, iOS `Networking/ServerConfig.swift`) — every candidate, its HTTP status, whether it is a genuine Zylod server (reports a bundle identity), WHICH bundle commit it serves, and the selection reason, logged per resolve; the first GENUINE endpoint in the frozen order wins (a bundle-less responder can never beat a genuine server). Endpoint changes are logged as `ENDPOINT CHANGED`. |
| Served web bundle | `window.__ZylodBundleIdentity` — `{commit, shortCommit, version, builtAt}` baked into every web build by `scripts/generate-bundle-identity.mjs`, injected inline in `<head>` (src/app/layout.tsx) before any hydration, and reported by `GET /api/app/version` (`bundle` field). |
| Acceptance | `WebProvenance` (Android `session/WebProvenance.kt`, iOS `Web/WebProvenance.swift`): identity MISSING → blocked on every build type; identity MISMATCH → blocked in release, visible diagnostics banner in debug. The web content is revealed only after the authoritative verification confirms identity + contract + live committed pageId/params for the current navigation generation. |

## 2. One-command audits

Android (installed APK on a device):

    adb logcat -s ZylodProvenance

Expected lines per launch/navigation:

    app=2.4.5-<sha7> buildType=debug|release expectedCommit=<sha7> endpoints=...
    probe endpoint=<url> status=<code|unreachable> zylodPayload=true|false alive=true|false
    probe endpoint=<url> status=<code|unreachable> zylodPayload=true|false servedBundle=<sha7|none> alive=true|false
    selected endpoint=<url> reason=first-genuine-zylod-in-order
    selected endpoint=<url> reason=first-alive-in-order
    served endpoint=<url> bundle=<sha7> version=2.4.5 builtAt=<iso> verdict=OK
    served endpoint=<url> bundle=NONE verdict=UNKNOWN action=BLOCKED        ← unknown bundle refused
    served endpoint=<url> bundle=<sha7> expected=<sha7> verdict=MISMATCH action=BLOCKED ← release
    served endpoint=<url> bundle=<sha7> expected=<sha7> verdict=MISMATCH action=VISIBLE-IN-DIAGNOSTICS(non-blocking) ← debug

(The newer, richer line shapes — `probe ... servedBundle=<sha7|none>` and
`selected ... reason=first-genuine-zylod-in-order` — supersede the older
`probe`/`selected` shapes shown beside them.)

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

## 6. Web bundle deployment — the deterministic chain (owner order)

The provenance gate is only as good as the deployment feeding it. The binding
chain is:

    Git commit X
      → Android/iOS CI builds the native shells from X (expectedCommit = short(X))
      → the web bundle served to those shells is generated from X
        (scripts/generate-bundle-identity.mjs runs at every dev/build start and
        bakes HEAD's identity into window.__ZylodBundleIdentity and the
        GET /api/app/version `bundle` field)
      → discovery selects the first endpoint whose /api/app/version reports a
        genuine Zylod bundle identity (ServerConfig, both platforms)
      → the per-load gate verifies identity + contract before revealing pixels

Rules enforced by this chain:

1. `src/generated/bundle-identity.ts` is GITIGNORED (never committed): a
   committed identity snapshot is always stale. The file on disk is produced
   from the actual HEAD at serve/build time; `predev`/`prebuild` regenerate it.
2. A production deploy (zylod.com) must build the web bundle from the SAME
   commit as the native release:
       ZYLOD_WEB_COMMIT=<full sha> ZYLOD_WEB_VERSION=2.4.5 \
       ZYLOD_WEB_BUILT_AT=$(date -u +%FT%TZ) node scripts/generate-bundle-identity.mjs
   Until zylod.com serves such a bundle, the release gate blocks it
   (verdict=UNKNOWN action=BLOCKED) — fail-closed by design. The debug
   deployment (next rule) is the auditable path meanwhile.
3. Discovery NEVER treats "any HTTP response" as success: an endpoint without
   a bundle identity (redirect stub, captive portal, 404) is logged and
   skipped — it can never beat a genuine server further down the list.
   Selection reasons: `first-genuine-zylod-in-order` (normal operation),
   `no-genuine-endpoint-first-alive(gate-will-refuse)` (all candidates
   bundle-less — the gate then refuses, visibly),
   `all-dead-cache-fallback` / `all-dead-default-first`.
4. /api/app/version serves the bundle identity UNCONDITIONALLY — a database
   outage degrades the update payload (`data.degraded=true`) but never the
   `bundle` field, so a DB outage can never make the genuine server
   undiscoverable.
5. The debug deployment endpoint is the ngrok static domain in the debug
   SERVER_ENDPOINTS list (both platforms). It must serve the bundle built from
   the SAME commit the installed APK was built from; the match (or any
   divergence) is visible via `adb logcat -s ZylodProvenance`.
