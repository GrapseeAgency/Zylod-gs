# Zylod — Audit Workflow & Phase Control (persistent project state)

This file is the cross-session contract for the GitHub-driven build/audit loop.
Every agent session must read it (plus `android/ARCHITECTURE.md`,
`design-tokens.md`, and the phase audit docs) before touching code.

## 1. The loop (only development process)

```
agent implements → commit + push to main → GitHub Actions builds APK
→ owner installs artifact → owner audits on device → owner reports findings
→ agent fixes ONLY reported findings → new build → re-audit → next phase gate
```

- A feature is **never** accepted because it compiles. The installed build is the acceptance target.
- Every push to `main` produces, per platform:
  - `Zylod-debug-apk-<full-commit-sha>` (Android Actions run)
  - `Zylod-ios-simulator-<full-commit-sha>` (iOS Actions run, macOS runner)
- CI builds stamp the short SHA into the version strings so installed builds are
  traceable on-device: Android **Settings → Apps → Zylod → Version** shows
  `2.4.5-<sha7>` (or `adb shell dumpsys package com.zylod.wholesale.debug |
  grep versionName`); the iOS simulator app's Info.plist
  `CFBundleShortVersionString` carries the same `2.4.5-<sha7>`.
  Local/`gradlew` builds stay plain `2.4.5`.

## 2. Installing & verifying a build (owner)

### Android
1. Open the run: `https://github.com/GrapseeAgency/Zylod-gs/actions` → newest green
   **android-build** run (each run page shows its commit).
2. Download artifact **Zylod-debug-apk-\<sha\>** from the run's Artifacts section
   (requires GitHub login). Unzip → `app-debug.apk` + `build-info.txt`.
3. `build-info.txt` states the exact commit and links the source commit page.
4. Transfer `app-debug.apk` to the phone → open it → allow "install unknown apps"
   for the app you opened it with.
5. Package id is `com.zylod.wholesale.debug` — installs **alongside** any release
   Zylod app, launcher label "Zylod".
6. Verify on-device: Settings → Apps → **Zylod** (debug) → Version must read
   `2.4.5-<short-sha>` matching the run's commit. That string is the proof of origin.

### iOS
1. Newest green **ios-build** run → download **Zylod-ios-simulator-\<sha\>**;
   unzip → `Zylod.app` + `build-info.txt` (commit + run URL inside).
2. Run it in the iOS Simulator on a Mac: `xcrun simctl install booted Zylod.app`
   then `xcrun simctl launch booted com.zylod.wholesale.debug` (or drag onto a
   running Simulator window). Verify `CFBundleShortVersionString` =
   `2.4.5-<short-sha>` in the app bundle's Info.plist.
3. Real-device install (audit on an iPhone) requires Apple signing: set repo
   secrets `APPLE_CERT_P12_BASE64`, `APPLE_CERT_PASSWORD`, and a provisioning
   profile; a signed-IPA job will be added to ios-build.yml once provided.

## 3. Hard rules

- Phase boundaries are hard gates — no next phase, extra screens, architecture
  changes, or drive-by refactors without explicit owner instruction.
- Never remove/disable/replace/mock existing functionality, routes, DB logic,
  WebView shell, native infrastructure, or backend contracts to make a task easier.
- Never rewrite history, force-push, or delete branches.
- Never commit credentials (`.env`, keystores, tokens) — all gitignored.
- Frozen scope lives in `android/ARCHITECTURE.md` §3; design truth in
  `design-tokens.md`; known debts in the phase audit docs.

## 4. Phase ledger

| Phase | Status | Commit / run | Known limitations |
|---|---|---|---|
| 0 — foundations (Android) | **built, awaiting device audit** | latest `Zylod-debug-apk-<sha>` | sticky-search + cart badge deferred to Phase 1; WebView tab unverified against live backend |
| 0 — foundations (iOS) | **built, awaiting simulator audit** | latest `Zylod-ios-simulator-<sha>` | CI-compiled only (no local macOS); simulator artifact until Apple signing secrets provided; Home animations/skeleton polish deferred |
| 1 — auth + PDP + cart native (both platforms) | **blocked** on owner audit of both Phase 0 builds | — | — |

## 5. Current build pointer (update on every accepted phase)

- Repo: `https://github.com/GrapseeAgency/Zylod-gs` (branch `main`)
- Latest workflow run: https://github.com/GrapseeAgency/Zylod-gs/actions
- Artifact to install: newest `Zylod-debug-apk-<sha>` (see §2 for verification)
