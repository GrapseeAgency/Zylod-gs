import SwiftUI
import WebKit
import SafariServices

// WebView shell for Tier 3 pageIds inside the SwiftUI navigation.
//
// Phase 1 runtime-audit remediation (owner findings #1/#2/#3/#4):
//
//  - Pushed WebRoutes check a POOLED WKWebView out of WKWebViewPool instead of
//    building a new one per push — subsequent Tier-3 navigations drive the
//    already-hydrated SPA client-side (history.pushState + popstate via the
//    web store's own contract) with a full deep-link load only as fallback.
//    Popped destinations check the shell back in (paused, warm cache).
//
//  - Tab destinations (Categories / Hot Deals / Profile) use OWNED shells that
//    live for the tab's lifetime — TabView keeps them, so tab switches stay
//    instant and a tab shell can never collide with a pooled push.
//
//  - Deterministic state machine per screen: loading → success / provenance
//    gate / error+retry. A 20 s watchdog bounds every load; a hung server can
//    never leave a blank or spinning screen indefinitely.
//
//  - Duplicated web bottom navigation is suppressed at document start via the
//    injected stylesheet (WebShellScripts.chromeSuppressionScript); the
//    native tab bar is the only navigation chrome.
//
//  - Shells identify themselves to the web layer as
//    "ZylodiOSNative/<version>" in the user agent.
//
// Round-6 remediation (owner-mandated order F1/F4/F7/F5):
//
//  ── GENERATION HANDLING (F7/F2) ────────────────────────────────────────
//  Every drive bumps the SHELL's navigation generation (not only screen
//  state). The ack closure is REBOUND on every drive and matches against
//  THIS drive's pageId (previously it was pinned at shell creation, so a
//  pooled shell's second navigation compared acks against a superseded
//  pageId). Every async callback — ack, soft-navigate result, probe,
//  didCommit/didFinish/didFail — captures its generation and is dropped when
//  the shell has moved on. A stale callback may never reveal or modify the
//  current screen.
//
//  ── AUTHORITATIVE ACKNOWLEDGEMENT (F4) ─────────────────────────────────
//  pushState "ok" and didFinish are NEVER proof of navigation success. A
//  destination is revealed ONLY after the authoritative verification
//  (WebShellScripts.documentVerifyScript) reports, for the CURRENT
//  generation, that the SPA consumed the page (__zylodSpaReady) AND its live
//  committed state (__zylodCurrentPage + params) equals the requested
//  pageId+params. A matching page-change ack TRIGGERS the verification; a
//  750 ms poll re-runs it; the 20 s watchdog bounds the whole thing.
//
//  ── RUNTIME PROVENANCE (F1/F5) ─────────────────────────────────────────
//  The same verification reads the served bundle's identity
//  (window.__ZylodBundleIdentity) and WebProvenance applies the acceptance
//  policy: missing identity blocks on every configuration (release AND
//  debug); a wrong commit blocks in release and surfaces as a visible
//  diagnostics banner in debug. A wrong/stale/unknown bundle is never
//  silently rendered.
//
//  ── TAB RE-TAP SYNC (F7) ───────────────────────────────────────────────
//  Re-tapping the selected web tab bumps driveTick → the owned shell re-drives
//  to its canonical pageId (live-probe: in-place if already there, else a
//  client-side soft-navigate = pop-the-tab's-web-stack-to-root), matching the
//  UIKit convention implemented for the Home/Cart stacks.
//
// Parity: ZylodNativeBridge script handler, auth seeding (re-seeded in place
// on token rotation), external schemes (tel:/mailto:) and off-origin http(s)
// routed out of the WebView, iOS 14.5+ downloads via WKDownloadDelegate.

struct WebViewScreen: View {
    let pageId: String
    let query: String

    /// Pooled shells serve pushed destinations; owned shells serve tabs.
    /// Defaults to pooled — pushed WebRoutes across the app need no change.
    let ownership: ShellOwnership

    /// Bumped when the user RE-TAPS the tab that owns this screen — re-drives
    /// the owned shell back to its canonical pageId (pop-to-root parity).
    var driveTick: Int = 0

    enum ShellOwnership {
        case pooled
        case owned
    }

    init(pageId: String, query: String, ownership: ShellOwnership = .pooled, driveTick: Int = 0) {
        self.pageId = pageId
        self.query = query
        self.ownership = ownership
        self.driveTick = driveTick
    }

    @State private var shell: PooledWebView?
    @State private var baseUrl: String?
    @State private var loadError: String?
    @State private var isLoading = true
    /// Stale-pixel suppression: true while a route change is in flight; the
    /// previous page's pixels are hidden over the theme background until the
    /// AUTHORITATIVE verification lifts them for the current generation.
    @State private var isTransitioning = false
    @State private var reloadGen = 0
    /// Compose-visible mirror of the shell's navigation generation: body
    /// closures (load events) capture THIS value so superseded events are
    /// generation-checked (F7).
    @State private var currentGen = 0
    /// F1 — provenance gate (non-nil replaces the web content; never silent).
    @State private var provenanceBlocked: String?
    /// F1/F5 — debug-only visible diagnostics for a served-bundle mismatch.
    @State private var debugNote: String?
    /// Verification poll + watchdog, bounded per generation.
    @State private var boundsTask: Task<Void, Never>?

    /// Stable identity of the current navigation target — drives the shell.
    private var navKey: String {
        "\(baseUrl ?? "-")|\(pageId)|\(query)|\(reloadGen)|\(driveTick)"
    }

    var body: some View {
        Group {
            if let message = provenanceBlocked {
                // F1 — the provenance gate REPLACES web content.
                ProvenanceGateView(message: message, onRetry: retry)
            } else if let message = loadError {
                webErrorView(message)
            } else if let shell = shell {
                ZStack {
                    ShellWebView(
                        shell: shell,
                        owned: ownership == .owned,
                        onFailure: { [weak shell] in
                            guard let shell, shell.navGeneration == currentGen else { return }
                            isLoading = false
                            isTransitioning = false
                            loadError = "The server isn't responding. Check your connection and try again."
                        },
                        onDidCommit: { [weak shell] in
                            guard let shell, shell.navGeneration == currentGen else { return }
                            isLoading = true
                        },
                        onDidFinish: { [weak shell] in
                            // NOT a reveal (F4): the authoritative verification
                            // decides (identity + live committed state).
                            guard let shell, shell.navGeneration == currentGen else { return }
                            verifyDocument(shell, generation: currentGen)
                        },
                        onDownload: { [weak shell] in
                            // A navigation that became a download NEVER fires
                            // didFinish — without this the watchdog turned a
                            // successful download into a fake server error.
                            guard let shell, shell.navGeneration == currentGen else { return }
                            isLoading = false
                            isTransitioning = false
                        }
                    )
                    .opacity(isTransitioning ? 0 : 1)
                }
                // No .ignoresSafeArea(.bottom): the WebView must end ABOVE
                // the native tab bar. LOADING OWNERSHIP: NO native spinner
                // while a shell is attached — the WEB's own loading UI is the
                // one loading owner. The pre-attach ProgressView below (no
                // shell yet) is the one native bootstrap surface.
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZylodColor.background)
            }
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .overlay(alignment: .top) {
            // F1/F5 debug visibility: served bundle differs from this build —
            // exact identities on-screen, non-blocking (release blocks).
            if let note = debugNote, WebProvenance.isDebugBuild {
                Text(note)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundColor(ZylodColor.onMuted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 2)
                    .background(ZylodColor.background.opacity(0.85))
            }
        }
        .task {
            await resolveBaseIfNeeded()
        }
        .task(id: navKey) {
            await drive()
        }
        // Tab switches: SwiftUI keeps tab state alive, but callback-driven
        // loads must stay bounded across disappear/reappear — a hang while a
        // tab is off-screen must still resolve into the error state on return.
        .onAppear {
            if isLoading && loadError == nil && provenanceBlocked == nil {
                startBounds(generation: currentGen)
            }
        }
        .onDisappear {
            cancelBounds()
        }
    }

    // MARK: - State machine

    private func resolveBaseIfNeeded() async {
        guard baseUrl == nil, loadError == nil else { return }
        // Cache-first: skip the probe storm when a winner is already known.
        let base: String
        if let cached = ServerConfig.cached() {
            base = cached
        } else {
            base = await ServerConfig.resolve()
        }
        baseUrl = base
    }

    @MainActor
    private func drive() async {
        guard loadError == nil, provenanceBlocked == nil else { return }
        guard let base = baseUrl else { return } // resolve task keeps driving via navKey
        guard let target = Self.targetURL(base: base, pageId: pageId, query: query) else {
            isLoading = false
            isTransitioning = false
            loadError = "Invalid server address."
            return
        }

        // Server switched underneath an existing shell → replace it.
        if let current = shell, current.baseUrl != base {
            if ownership == .pooled {
                WKWebViewPool.shared.checkIn(current)
            }
            shell = nil
        }

        if shell == nil {
            let newShell = ownership == .pooled
                ? WKWebViewPool.shared.checkOut(baseUrl: base)
                : WKWebViewPool.shared.makeOwnedShell(baseUrl: base)
            WKWebViewPool.shared.reseedIfNeeded(newShell)
            shell = newShell
        }
        guard let active = shell else { return }

        // ── F7: a NEW generation starts on EVERY drive ──────────────────
        let gen = active.bumpGeneration()
        currentGen = gen

        // The ack closure is REBOUND on every drive and matches THIS drive's
        // pageId; a matching ack TRIGGERS the authoritative verification —
        // it is never the proof itself (F4).
        active.onPageChanged = { [weak active] acked in
            guard let active, active.navGeneration == gen else { return }
            if acked == pageId {
                verifyDocument(active, generation: gen)
            }
        }

        isLoading = true
        isTransitioning = true
        provenanceBlocked = nil
        debugNote = nil
        startBounds(generation: gen)

        // ── Drive by LIVE TRUTH, not bookkeeping ─────────────────────────
        if active.webView.url != nil {
            let live = await Self.probeLivePage(active, generation: gen)
            guard active.navGeneration == gen else { return }
            if let live = live, live.page == pageId,
               live.params == RouteOwnership.queryParams(query) {
                // Live truth: the shell IS the requested page already
                // (Back onto a previously visited web route / tab re-tap on
                // its canonical page) — still revealed through the
                // authoritative verification (identity + live state).
                active.lastURL = target.absoluteString
                verifyDocument(active, generation: gen)
                return
            }

            // Fast path: client-side pageId navigation on the hydrated SPA.
            let ok = await Self.softNavigate(active, pageId: pageId, query: query, generation: gen)
            guard active.navGeneration == gen else { return }
            if ok {
                active.lastURL = target.absoluteString
                // NO reveal (F4): the ack/poll-driven verification lifts
                // suppression when the SPA's committed state matches.
                return
            }
        }

        // Fallback: full deep-link load (?page= contract, D10 value encoding).
        // didFinish triggers the authoritative verification — never an
        // unconditional reveal.
        active.webView.load(URLRequest(url: target))
        active.lastURL = target.absoluteString
    }

    private func retry() {
        // Fresh resolve on retry: a dead cached host must not be retried forever.
        ServerConfig.invalidateCache()
        loadError = nil
        provenanceBlocked = nil
        debugNote = nil
        isLoading = true
        isTransitioning = false
        cancelBounds()
        if let current = shell {
            if ownership == .pooled {
                WKWebViewPool.shared.checkIn(current)
            } else {
                current.webView.stopLoading()
            }
            shell = nil
        }
        baseUrl = nil
        reloadGen += 1 // re-drives resolve + navigation via navKey
    }

    // MARK: - Authoritative verification (F1 + F4)

    /// Reads identity + contract readiness + live committed page state in ONE
    /// round trip; generation-checked before AND after the JS round trip.
    @MainActor
    private func verifyDocument(_ shell: PooledWebView, generation gen: Int) {
        guard shell.navGeneration == gen else { return }
        shell.webView.evaluateJavaScript(WebShellScripts.documentVerifyScript) { [weak shell] result, _ in
            guard let shell else { return }
            Task { @MainActor in
                guard shell.navGeneration == gen else { return }
                applyVerification(shell, generation: gen, result: result)
            }
        }
    }

    @MainActor
    private func applyVerification(_ shell: PooledWebView, generation gen: Int, result: Any?) {
        let state = Self.parseVerifyResult(result)
        let verdict = WebProvenance.evaluate(state.identity)
        WebProvenance.logServed(endpoint: shell.baseUrl, verdict: verdict)
        shell.recordIdentity(state.identity)

        if WebProvenance.blocking(verdict) {
            // F1: a wrong/stale/unknown bundle is NEVER silently rendered.
            let message: String
            switch verdict {
            case let .mismatch(id, expected):
                message = "The server at \(shell.baseUrl) is serving web bundle \(id.shortCommit), but this app was built from \(expected)."
            case .missing, .ok:
                message = "The server at \(shell.baseUrl) did not identify itself as a Zylod web bundle (no bundle identity found)."
            }
            isLoading = false
            isTransitioning = false
            provenanceBlocked = message
            return
        }

        if case let .mismatch(id, expected) = verdict {
            // DEBUG-only: visible diagnostics, non-blocking.
            debugNote = "DEV bundle \(id.shortCommit) @ \(shell.baseUrl) (app: \(expected))"
        } else {
            debugNote = nil
        }

        // F4 reveal rule — actual committed pageId+params for THIS generation.
        if state.spaReady, state.page == pageId,
           state.params == RouteOwnership.queryParams(query) {
            isLoading = false
            isTransitioning = false
        }
        // else: keep suppressed — the ack/poll loop re-verifies until the
        // watchdog turns a stuck load into an explicit error + retry.
    }

    private static func parseVerifyResult(_ raw: Any?) -> (
        identity: WebProvenance.BundleIdentity?,
        spaReady: Bool,
        page: String?,
        params: [String: String]
    ) {
        guard let json = raw as? String,
              let data = json.data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return (nil, false, nil, [:])
        }
        let identity = WebProvenance.parseIdentity(obj["identity"])
        let spaReady = (obj["spaReady"] as? Bool) == true
        let page = obj["page"] as? String
        let params = (obj["params"] as? [String: Any])?.compactMapValues { $0 as? String } ?? [:]
        return (identity, spaReady, page, params)
    }

    // MARK: - Verification poll + watchdog (bounded, per generation)

    /// Every 750 ms the authoritative verification re-runs for the CURRENT
    /// generation until the screen settles — a missed ack delays a reveal,
    /// never hangs one. 20 s without settling = explicit error + retry.
    private func startBounds(generation gen: Int) {
        boundsTask?.cancel()
        boundsTask = Task { @MainActor in
            var waited = 0
            while waited < 20_000 {
                try? await Task.sleep(nanoseconds: 750_000_000)
                guard !Task.isCancelled else { return }
                guard let shell = shell, shell.navGeneration == gen else { return }
                if !isLoading && !isTransitioning { return }
                if loadError != nil || provenanceBlocked != nil { return }
                verifyDocument(shell, generation: gen)
                waited += 750
            }
            guard shell?.navGeneration == gen else { return }
            if isLoading || isTransitioning {
                isLoading = false
                isTransitioning = false
                loadError = "The server isn't responding. Check your connection and try again."
            }
        }
    }

    private func cancelBounds() {
        boundsTask?.cancel()
        boundsTask = nil
    }

    // MARK: - Helpers

    static func targetURL(base: String, pageId: String, query: String) -> URL? {
        let trimmed = base.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        // ?page=<id> contract; the id and every query VALUE are percent-encoded
        // (D10 parity with android WebScreen.encodeQueryValues).
        let encodedPageId = pageId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? pageId
        var target = trimmed + "/?page=" + encodedPageId
        if !query.isEmpty {
            target += "&" + encodeQueryValues(query)
        }
        return URL(string: target)
    }

    private static func encodeQueryValues(_ query: String) -> String {
        query.split(separator: "&", omittingEmptySubsequences: false).map { pair -> String in
            if let eq = pair.firstIndex(of: "=") {
                let rawValue = String(pair[pair.index(after: eq)...])
                let encoded = rawValue.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? rawValue
                return String(pair[pair.startIndex...eq]) + encoded
            }
            let raw = String(pair)
            return raw.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? raw
        }.joined(separator: "&")
    }

    /// Generation-guarded: a soft-navigate result from a superseded generation
    /// resumes "no" (the caller has already re-driven a newer generation).
    private static func softNavigate(_ shell: PooledWebView, pageId: String, query: String, generation: Int) async -> Bool {
        await withCheckedContinuation { continuation in
            let box = ResumeOnce(continuation: continuation)
            shell.webView.evaluateJavaScript(
                WebShellScripts.softNavigateScript(pageId: pageId, query: query)
            ) { result, _ in
                Task { @MainActor in
                    guard shell.navGeneration == generation else {
                        box.resume(returning: false)
                        return
                    }
                    box.resume(returning: (result as? String) == "ok")
                }
            }
            // The evaluateJavaScript completion is not guaranteed if the shell
            // is torn down mid-call — the timeout guarantees the continuation
            // resumes (no leaked task), and the caller falls back to a load.
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                box.resume(returning: false)
            }
        }
    }

    /// Reads the SPA's LIVE page state (`window.__zylodCurrentPage` +
    /// params, mirrored by the web navigation store). Generation-guarded —
    /// nil = SPA not booted or the probe belongs to a superseded drive.
    private static func probeLivePage(_ shell: PooledWebView, generation: Int) async -> (page: String, params: [String: String])? {
        await withCheckedContinuation { continuation in
            let box = ResumeOnce(continuation: continuation)
            shell.webView.evaluateJavaScript(WebShellScripts.livePageProbeScript) { result, _ in
                Task { @MainActor in
                    guard shell.navGeneration == generation else {
                        box.resume(returning: nil)
                        return
                    }
                    guard let dict = result as? [String: Any],
                          let page = dict["page"] as? String else {
                        box.resume(returning: nil)
                        return
                    }
                    let params = (dict["params"] as? [String: Any])?
                        .compactMapValues { $0 as? String } ?? [:]
                    box.resume(returning: (page: page, params: params))
                }
            }
            Task { @MainActor in
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                box.resume(returning: nil)
            }
        }
    }

    private func webErrorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "cloud.off")
                .font(ZylodFont.scaled(44, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.onMuted)
            Text("Can't reach Zylod")
                .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
            Text(message)
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            Button(action: retry) {
                Text("Retry")
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onPrimary)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(ZylodColor.primary))
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// F1 provenance gate — replaces web content when the served bundle fails the
/// acceptance policy. Shows the EXACT divergence so the failure is diagnosable
/// from the screen itself (never a silent blank or a wrong page).
private struct ProvenanceGateView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.shield")
                .font(ZylodFont.scaled(44, relativeTo: .largeTitle))
                .foregroundColor(ZylodColor.onMuted)
            Text("Web bundle verification failed")
                .font(ZylodFont.scaled(14, .semibold, relativeTo: .body))
                .foregroundColor(ZylodColor.onBackground)
            Text(message)
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            Text("The app refused to display an unverified web bundle. Redeploy the matching web bundle and retry.")
                .font(ZylodFont.scaled(11, relativeTo: .caption))
                .foregroundColor(ZylodColor.onMuted)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text("Retry")
                    .font(ZylodFont.scaled(13, .semibold, relativeTo: .footnote))
                    .foregroundColor(ZylodColor.onPrimary)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(ZylodColor.primary))
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ZylodColor.background)
    }
}

/// Tab destinations — owned shell, loaded once, kept for the tab lifetime.
/// `driveTick` re-drives the shell to its canonical pageId on re-taps.
struct TabWebViewScreen: View {
    let pageId: String
    let query: String
    var driveTick: Int = 0

    var body: some View {
        WebViewScreen(pageId: pageId, query: query, ownership: .owned, driveTick: driveTick)
    }
}

// MARK: - Representable

/// Bridge singleton shared by every shell (the script handler registers per
/// configuration; the bridge routes evaluateJavaScript at the last-attached
/// view — updateUIView re-attaches the visible screen).
enum ShellWebViewCenter {
    static let bridge = ZylodNativeBridge.shared
}

private struct ShellWebView: UIViewRepresentable {
    let shell: PooledWebView
    let owned: Bool
    var onFailure: () -> Void
    var onDidCommit: () -> Void
    var onDidFinish: () -> Void
    var onDownload: () -> Void

    func makeUIView(context: Context) -> WKWebView {
        let webView = shell.webView
        webView.removeFromSuperview()
        context.coordinator.shell = shell
        context.coordinator.owned = owned
        context.coordinator.onFailure = onFailure
        context.coordinator.onDidCommit = onDidCommit
        context.coordinator.onDidFinish = onDidFinish
        context.coordinator.onDownload = onDownload
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        ShellWebViewCenter.bridge.attach(webView: webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onFailure = onFailure
        context.coordinator.onDidCommit = onDidCommit
        context.coordinator.onDidFinish = onDidFinish
        context.coordinator.onDownload = onDownload
        // The visible screen is always the bridge's evaluation target.
        ShellWebViewCenter.bridge.attach(webView: webView)
    }

    /// True representable lifetime: popped destinations check their pooled
    /// shell in HERE (TabView switches keep the representable alive, so a
    /// tab switch never pauses a shell that SwiftUI will keep showing).
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        if coordinator.owned {
            uiView.navigationDelegate = nil
            uiView.uiDelegate = nil
        } else if let shell = coordinator.shell {
            WKWebViewPool.shared.checkIn(shell)
        }
    }

    func makeCoordinator() -> ShellNavCoordinator {
        ShellNavCoordinator()
    }
}

/// Per-checkout navigation/UI delegate. The shared bridge host stays the
/// script-message target; this object owns per-screen load events and the
/// external-navigation/download policies.
final class ShellNavCoordinator: NSObject {
    weak var shell: PooledWebView?
    var owned = false
    var onFailure: (() -> Void)?
    var onDidCommit: (() -> Void)?
    var onDidFinish: (() -> Void)?
    var onDownload: (() -> Void)?
}

extension ShellNavCoordinator: WKNavigationDelegate, WKUIDelegate {

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        onDidCommit?()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onDidFinish?()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard !error.isCancelledNavigation else { return }
        onFailure?()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard !error.isCancelledNavigation else { return }
        onFailure?()
    }

    /// decidePolicyFor: external schemes → OS; off-origin http(s) → external
    /// browser (web .target=_blank parity); requested downloads → WKDownload;
    /// everything else loads in place.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, preferences: WKWebpagePreferences, decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if #available(iOS 14.5, *) {
            if navigationAction.shouldPerformDownload {
                onDownload?()
                decisionHandler(.download, preferences)
                return
            }
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow, preferences)
            return
        }
        let scheme = url.scheme?.lowercased() ?? ""

        if ["tel", "mailto", "sms", "whatsapp", "itms-apps"].contains(scheme) {
            decisionHandler(.cancel, preferences)
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            return
        }

        if navigationAction.targetFrame == nil, scheme == "http" || scheme == "https" {
            // Off-origin / new-window navigation (Android WebScreen parity:
            // external browser or in-app SFSafariViewController).
            if let active = ServerConfig.cached(),
               url.absoluteString.hasPrefix(active.trimmingCharacters(in: CharacterSet(charactersIn: "/"))) {
                decisionHandler(.allow, preferences)
                return
            }
            decisionHandler(.cancel, preferences)
            let safari = SFSafariViewController(url: url)
            if let top = BridgeCoordinator.topViewController() {
                top.present(safari, animated: true)
            } else {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            return
        }

        decisionHandler(.allow, preferences)
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if #available(iOS 14.5, *) {
            if navigationResponse.canShowMIMEType == false {
                onDownload?()
                decisionHandler(.download)
                return
            }
        }
        // Main-frame HTTP failure (500/404/…): WKWebView treats an error
        // document as a SUCCESSFUL navigation, so without this gate the page
        // "finishes" and the screen shows a dead error document with no
        // recovery path (Android onReceivedHttpError parity). Subresource
        // failures are ignored (graceful degradation).
        if navigationResponse.isForMainFrame,
           let http = navigationResponse.response as? HTTPURLResponse,
           http.statusCode >= 400 {
            decisionHandler(.cancel)
            onFailure?()
            return
        }
        decisionHandler(.allow)
    }

    /// A navigation the user asked to download (`.download` policy) is handed
    /// back here — supply the delegate that decides the destination file URL.
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) -> WKDownloadDelegate? {
        onDownload?()
        return ZylodDownloadDelegate.shared
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) -> WKDownloadDelegate? {
        onDownload?()
        return ZylodDownloadDelegate.shared
    }
}

// WKNavigationDelegate failures must ignore user/system cancellations
// (WKError surfacing NSURLErrorCancelled -999); without this guard every
// back-swipe would flip the shell into the retry state.
private extension Error {
    var isCancelledNavigation: Bool {
        (self as NSError).code == NSURLErrorCancelled
    }
}

/// Resumes a typed continuation exactly once — the JS callback and the
/// timeout race for it, and whichever loses must be a no-op.
private final class ResumeOnce<T> {
    private var continuation: CheckedContinuation<T, Never>?

    init(continuation: CheckedContinuation<T, Never>) {
        self.continuation = continuation
    }

    func resume(returning value: T) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}
