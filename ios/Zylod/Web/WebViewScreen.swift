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
//  - Deterministic state machine per screen: loading → success / error+retry.
//    A 20 s watchdog bounds every load; a hung server can never leave a blank
//    or spinning screen indefinitely (previously a hang showed a blank screen
//    with no recovery).
//
//  - Duplicated web bottom navigation is suppressed at document start via the
//    injected stylesheet (WebShellScripts.chromeSuppressionScript); the
//    native tab bar is the only navigation chrome.
//
//  - Shells identify themselves to the web layer as
//    "ZylodiOSNative/<version>" in the user agent.
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

    enum ShellOwnership {
        case pooled
        case owned
    }

    init(pageId: String, query: String, ownership: ShellOwnership = .pooled) {
        self.pageId = pageId
        self.query = query
        self.ownership = ownership
    }

    @State private var shell: PooledWebView?
    @State private var baseUrl: String?
    @State private var loadError: String?
    @State private var isLoading = true
    /// Stale-pixel suppression (round-4: "never display stale content from
    /// the previous route"): true while a route change is in flight; the
    /// previous page's pixels are hidden over the theme background until the
    /// SPA confirms the new page (ack / soft-navigate ok / didFinish).
    @State private var isTransitioning = false
    @State private var reloadGen = 0
    @State private var watchdog: Task<Void, Never>?

    /// Stable identity of the current navigation target — drives the shell.
    private var navKey: String {
        "\(baseUrl ?? "-")|\(pageId)|\(query)|\(reloadGen)"
    }

    var body: some View {
        Group {
            if let message = loadError {
                webErrorView(message)
            } else if let shell = shell {
                ZStack {
                    ShellWebView(
                        shell: shell,
                        owned: ownership == .owned,
                        onFailure: {
                            isLoading = false
                            isTransitioning = false
                            cancelWatchdog()
                            loadError = "The server isn't responding. Check your connection and try again."
                        },
                        onDidCommit: {
                            isLoading = true
                        },
                        onDidFinish: {
                            isLoading = false
                            isTransitioning = false
                            cancelWatchdog()
                        },
                        onDownload: {
                            // A navigation that became a download NEVER fires
                            // didFinish — without this the watchdog turned a
                            // successful download into a fake server error.
                            isLoading = false
                            isTransitioning = false
                            cancelWatchdog()
                        }
                    )
                    .opacity(isTransitioning ? 0 : 1)
                }
                // No .ignoresSafeArea(.bottom): the WebView must end ABOVE
                // the native tab bar. The previous underlap painted the
                // page's last rows behind the translucent tab bar AND let
                // the web page's own bottom chrome occupy the same region
                // as the tab bar (owner round-3 finding: duplicate/merged
                // bottom chrome; category rows unreachable under the bar).
                //
                // LOADING OWNERSHIP (round-4): NO native spinner while a
                // shell is attached — the WEB's own loading UI is the one
                // loading owner for this surface (a native ProgressView over
                // the SPA's spinner was the visible "two loading systems"
                // defect). The shell only suppresses the PREVIOUS page's
                // stale pixels during a route change. The pre-attach
                // ProgressView below (no shell yet) is the one native
                // bootstrap surface — no web content exists to compete with.
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZylodColor.background)
            }
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .task {
            await resolveBaseIfNeeded()
        }
        .task(id: navKey) {
            await drive()
        }
        // Tab switches: SwiftUI keeps tab state alive, but callbacks-driven
        // loads must stay bounded across disappear/reappear — a hang while a
        // tab is off-screen must still resolve into the error state on return.
        .onAppear {
            if isLoading && loadError == nil { startWatchdog() }
        }
        .onDisappear {
            cancelWatchdog()
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
        guard loadError == nil else { return }
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
            // PAGE-CHANGE ACK (round-4): the SPA reports every committed
            // page change; a matching ack means the new page is consumed —
            // lift stale suppression. Advisory (older bundles emit none);
            // the soft-navigate result and didFinish remain guarantees.
            newShell.onPageChanged = { [weak newShell] acked in
                guard newShell != nil else { return }
                if acked == pageId {
                    isLoading = false
                    isTransitioning = false
                }
            }
            shell = newShell
        }
        guard let active = shell else { return }

        // ── Drive by LIVE TRUTH, not bookkeeping (round-4) ──────────────
        // "restore-in-place" is decided by probing the SPA's LIVE page
        // state (window.__zylodCurrentPage + params). lastURL-style
        // bookkeeping recorded what the shell was last TOLD — any
        // SPA-initiated navigation drifted it, and a drifted re-attach is
        // exactly how a Profile route painted Home content.
        if active.webView.url != nil {
            isLoading = true
            isTransitioning = true
            startWatchdog()

            let live = await Self.probeLivePage(active)
            if let live = live, live.page == pageId,
               live.params == RouteOwnership.queryParams(query) {
                // Live truth: the shell IS the requested page already
                // (Back onto a previously visited web route) — zero work.
                active.lastURL = target.absoluteString
                isLoading = false
                isTransitioning = false
                cancelWatchdog()
                return
            }

            // Fast path: client-side pageId navigation on the hydrated SPA.
            let ok = await Self.softNavigate(active, pageId: pageId, query: query)
            if ok {
                active.lastURL = target.absoluteString
                isLoading = false
                isTransitioning = false
                cancelWatchdog()
                return
            }
        } else {
            isLoading = true
            isTransitioning = true
            startWatchdog()
        }

        // Fallback: full deep-link load (?page= contract, D10 value encoding).
        // didFinish lifts isLoading + isTransitioning (ack may lift earlier).
        active.webView.load(URLRequest(url: target))
        active.lastURL = target.absoluteString
    }

    private func retry() {
        // Fresh resolve on retry: a dead cached host must not be retried forever.
        ServerConfig.invalidateCache()
        loadError = nil
        isLoading = true
        isTransitioning = false
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

    // MARK: - Watchdog (finding #3: no indefinite loading)

    private func startWatchdog() {
        watchdog?.cancel()
        watchdog = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 20_000_000_000)
            guard !Task.isCancelled else { return }
            isLoading = false
            loadError = "The server isn't responding. Check your connection and try again."
        }
    }

    private func cancelWatchdog() {
        watchdog?.cancel()
        watchdog = nil
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

    private static func softNavigate(_ shell: PooledWebView, pageId: String, query: String) async -> Bool {
        await withCheckedContinuation { continuation in
            let box = ResumeOnce(continuation: continuation)
            shell.webView.evaluateJavaScript(
                WebShellScripts.softNavigateScript(pageId: pageId, query: query)
            ) { result, _ in
                box.resume(returning: (result as? String) == "ok")
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
    /// params, mirrored by the web navigation store). nil = SPA not booted
    /// (fresh shell / stale bundle) — the caller drives the SPA instead.
    private static func probeLivePage(_ shell: PooledWebView) async -> (page: String, params: [String: String])? {
        await withCheckedContinuation { continuation in
            let box = ResumeOnce(continuation: continuation)
            shell.webView.evaluateJavaScript(WebShellScripts.livePageProbeScript) { result, _ in
                guard let dict = result as? [String: Any],
                      let page = dict["page"] as? String else {
                    box.resume(returning: nil)
                    return
                }
                let params = (dict["params"] as? [String: Any])?
                    .compactMapValues { $0 as? String } ?? [:]
                box.resume(returning: (page: page, params: params))
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

/// Tab destinations — owned shell, loaded once, kept for the tab lifetime.
struct TabWebViewScreen: View {
    let pageId: String
    let query: String

    var body: some View {
        WebViewScreen(pageId: pageId, query: query, ownership: .owned)
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
        // recovery path (Android onReceivedHttpError parity — audit finding
        // #1). Subresource failures are ignored (graceful degradation).
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
