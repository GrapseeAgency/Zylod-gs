# QUARANTINED — native Home (SwiftUI)

**Status: TERMINATED — DO NOT REACTIVATE WITHOUT A NEW OWNER DIRECTIVE.**

The owner terminated the native Home implementation after repeated real-device
audit failures ("HARD ARCHITECTURE DIRECTIVE — HOME NATIVE IMPLEMENTATION IS
TERMINATED"):

- `home` is owned by the **WEBVIEW** on BOTH platforms
  (`RouteOwnership.ownerOf("home") == .webview`).
- Exactly ONE Home: `Home tab → native application shell → WebView → ?page=home`.
- The Home tab root in `Nav/RootView.swift` renders the OWNED
  `TabWebViewScreen(pageId: "home")` under the full provenance contract
  (verified endpoint → verified bundle identity → `?page=home` →
  SPA-confirmed `pageId=home` → reveal).

These files were moved here **by `git mv`** (full history preserved) OUT of
`ios/Zylod/Home/`, which places them outside the XcodeGen target sources
(`project.yml` globs only `Zylod/**`) — they are NEVER compiled into the app
and cannot become active again through any scheme or configuration.

- `HomeView.swift` — the former SwiftUI Home.
- `HomeViewModel.swift` — the former Home data flow.

No optimisation, patching, profiling or rework of this code is authorised.
Restoring it requires moving it back under `ios/Zylod/Home/`, re-adding the
`home → .native` row in `RouteOwnership.swift`, and an explicit owner
directive reversing the termination.
