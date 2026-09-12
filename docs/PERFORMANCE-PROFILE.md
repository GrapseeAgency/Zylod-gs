# Native Home vs WebView Home — Performance Profile (Phase 1, Round 4)

> **⚠ SUPERSEDED BY OWNER DIRECTIVE — native-Home TERMINATED.** The native
> Home implementation was terminated after repeated real-device audit
> failures; `home → WEBVIEW` on BOTH platforms (see `android/ARCHITECTURE.md`
> §1.1 and both `RouteOwnership` tables). All `native:home` measurement
> below is historical — the Compose HomeScreen no longer exists in the
> active graph (quarantined: `android/quarantine/native-home/`,
> `ios/Quarantined/`) and its `native:home` surface tag is retired. The
> `web:<pageId>` harness (including `web:home`) remains active and unchanged
> for WebView Home measurement. No C/C++/Rust was introduced at any point.

**Owner mandate (round-4 audit):** *"Do NOT introduce C/C++/Rust simply because
the current native path feels slower. First measure the actual native Home and
determine why it underperforms the existing WebView implementation… If the
existing web implementation demonstrably performs better for a particular
surface, document that fact rather than pretending the native version is
faster. But before considering WebView as the permanent implementation of a
Tier-1 native screen, prove that the native implementation has actually been
profiled and optimised correctly."*

This document is the measurement protocol + current static findings. **No
performance claim below is presented as measured on hardware until an owner
run of §2 produces the numbers.** The in-app harness ships in this build so
the comparison is one logcat session away.

---

## 1. What ships in this build (the harness)

### 1.1 Per-surface frame/jank profiler (`JankProfiler`, DEBUG builds only)

- Platform **FrameMetrics** pipeline (`Window.setOnFrameMetricsAvailableListener`,
  the same source `dumpsys gfxinfo` samples) — objective OS numbers, not
  subjective feel.
- Surfaces are tagged by the app itself:
  - `native:home` — Compose `HomeScreen`
  - `web:<pageId>` — WebView-hosted SPA pages (`WebScreen`)
- Both paths are captured by the **same window-level pipeline on the same
  device in the same session** — an apples-to-apples frame-production
  comparison.
- Every tag switch dumps the finished surface:
  `frames, jank% (>1 vsync), frozen (>3 vsync), p50/p90/p95/p99, worst`.
- Release APKs carry zero overhead (`BuildConfig.DEBUG` gate).

### 1.2 Image pipeline timing (`TimedAsyncImage`)

Grid/thumbnail requests slower than **64 ms** (start → success) are logged
with their URL — surfacing network + decode cost hidden inside "scrolling
feels slow" (DEBUG only).

### 1.3 Web-side parity

The WebView path is the browser engine's own renderer; its frames flow
through the same window pipeline, so `web:home` numbers need no extra
instrumentation.

---

## 2. Owner measurement protocol (real device, ~5 minutes)

1. Install the **debug** APK artifact from this commit's CI run
   (`app-debug.apk` — the profiler is release-disabled by design).
2. `adb logcat -c && adb logcat -s ZylodPerf`
3. **Native Home:** open the app → Home → fling the product grid down and
   back up ×3. Then tap any tab (the tag switch dumps `native:home`).
4. **WebView Home (comparison surface):** in a browser or via a Tier-3 web
   page, scroll the SPA home the same way (or run the SPA standalone:
   `?page=home` in the shell is native-home-free by design — use
   `web:category-browser` as the web smoothness baseline the audit already
   acknowledged as smooth).
5. Read the dumps:
   `native:home: frames=… jank=…% frozen=… p50=… p90=… p95=… p99=… worst=…`
6. Repeat on the release APK for the end-to-end feel (numbers come from the
   debug run; the release run validates the subjective claim).

**Decision rule (per owner):** if `native:home` jank%/p95 is materially worse
than the web surface's on the same device, the *web implementation is
demonstrably better today* — that fact goes in this file, and the native
implementation gets optimized against the measured bottleneck before any
tier decision changes. Tier-1 Home stays native unless the owner rules
otherwise (NATIVE_PRODUCT_SPECIFICATION remains authoritative).

---

## 3. Static analysis findings (facts from the code, awaiting numbers)

These are the structural differences between the two paths that plausibly
explain "the native Home path behaves differently" — each is checkable
against the §2 numbers:

| # | Finding | Mechanism | Status |
|---|---------|-----------|--------|
| S1 | **No Baseline Profile** | The WebView path rides a long-warmed V8 + the SPA's AOT-ish minified bundle. Compose Home executes AOT-*less*: first-run JIT compilation of the Compose runtime + app code lands exactly in the first scroll sessions, producing early-fling jank that the web path never pays. Fix = baseline profile module (macrobenchmark) — **proposed next step, needs owner-approved build infra** (a new CI job + `androidx.profileinstaller`). | Confirmed missing (build.gradle.kts has no profileinstaller/baselineprofile) |
| S2 | **Crossfade on every grid image** (`crossfade(200)` app-wide) | During fling, each image fades in over 200 ms → extra RenderThread work per cell vs the web `<img>` pop-in. If §2 shows elevated p90 during image-heavy fling, disabling crossfade for grid cells is the counterfactual test. | Confirmed (ZylodApp.newImageLoader) |
| S3 | **First-frame composition cost** | Home composes ~40 composables + 5 parallel API calls before first content; the shell also installs document-start scripts etc. on the web path. Cold-start cost — measurable as the first frames after `surface → native:home`. | Confirmed structurally |
| S4 | **Item-diff allocation per recomposition** | Row keys derive via `rows[rowIdx].joinToString("\|")` — a string alloc per row per diff. Already mitigated (round 3: stable keys + contentType + `@Immutable` DTOs make cards skippable). Expected minor. | Mitigated; measure residual |
| S5 | **Image decode defaults** | Coil decodes at the composable's constrained size (5:6 grid cell) — no full-size decode. Memory cache 20%, disk 64 MB. Reasonable; §1.2 catches outliers. | OK by construction |
| S6 | **WebView path advantages are real** | V8 warms once per process pool, the SPA home was tuned over months, and Chrome's renderer has years of scroll optimization. **If §2 shows the web path smoother, that is the documented expectation, not a surprise** — and per the owner's rule it must be written down here with numbers rather than argued away. | Acknowledged |

### Explicitly NOT done this round (per mandate)

- No C/C++/Rust, no "native rewrite of the renderer".
- No replacement of native Home with WebView to make the audit pass.
- No unverifiable "we optimized scrolling" claims. The harness + this
  protocol ARE the deliverable; the numbers are one device session away.

## 4. Next optimization steps (post-measurement, in impact order)

1. **Baseline profile** for Compose runtime + Home screen paths (targets S1,
   typically the largest single win for first-run fling jank).
2. Grid crossfade counterfactual (S2) — flip behind a debug flag, re-measure.
3. If p99 spikes correlate with `image slow:` logs — prefetch next-page
   thumbnails during `loadMore` (Coil `prefetch`), decode off the UI thread
   path.
4. Re-run §2 after each change; append the before/after table to this file.

*Every future "native Home is fast enough" statement must cite a §2 table.*
