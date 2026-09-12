# QUARANTINED — native Home (Compose)

**Status: TERMINATED — DO NOT REACTIVATE WITHOUT A NEW OWNER DIRECTIVE.**

The owner terminated the native Home implementation after repeated real-device
audit failures ("HARD ARCHITECTURE DIRECTIVE — HOME NATIVE IMPLEMENTATION IS
TERMINATED"):

- `home` is owned by the **WEBVIEW** on BOTH platforms
  (`RouteOwnership.ownerOf("home") == WEBVIEW`).
- Exactly ONE Home: `Home tab → native application shell → WebView → ?page=home`.
- The home tab root in `ui/nav/ZylodRoot.kt` renders
  `WebScreen(pageId = "home")` under the full provenance contract
  (verified endpoint → verified bundle identity → `?page=home` →
  SPA-confirmed `pageId=home` → reveal).

These files were moved here **by `git mv`** (full history preserved) OUT of
`app/src/main/java/com/zylod/wholesale/ui/home/`, which places them outside
every Gradle source set — they are NEVER compiled, NEVER packaged, and cannot
become active again through any build type or flavor.

- `HomeScreen.kt` — the former Compose Home (package header kept as-is).
- `HomeViewModel.kt` — the former Home data flow.

No optimisation, patching, profiling or rework of this code is authorised.
Restoring it requires moving it back under `app/src/main/java/…/ui/home/`,
re-adding the `home → NATIVE` row in `RouteOwnership.kt`, and an explicit
owner directive reversing the termination.
