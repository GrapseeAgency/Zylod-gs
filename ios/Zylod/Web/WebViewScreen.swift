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
                            cancelWatchdog()
                            loadError = "The server isn't responding. Check your connection and try again."
                        },
                        onDidCommit: {
                            isLoading = true
                        },
                        onDidFinish: {
                            isLoading = false
                            cancelWatchdog()
                        },
                        onDownload: {
                            // A navigation that became a download NEVER fires
                            // didFinish — without this the watchdog turned a
                            // successful download into a fake server error.
                            isLoading = false
                            cancelWatchdog()
                        }
                    )
                    .ignoresSafeArea(edges: .bottom)
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(ZylodColor.background.opacity(0.001))
                    }
                }
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
            shell = ownership == .pooled
                ? WKWebViewPool.shared.checkOut(baseUrl: base)
                : WKWebViewPool.shared.makeOwnedShell(baseUrl: base)
            WKWebViewPool.shared.reseedIfNeeded(shell!)
        }
        guard let active = shell else { return }

        // Restore-in-place: the shell is already showing exactly this page
        // (e.g. Back onto a previously visited web route) — zero work.
        if loadError == nil, active.lastURL == target.absoluteString {
            isLoading = false
            cancelWatchdog()
            return
        }

        isLoading = true
        startWatchdog()

        // Fast path: client-side pageId navigation on the hydrated SPA.
        if active.webView.url != nil {
            let ok = await Self.softNavigate(active, pageId: pageId, query: query)
            if ok {
                active.lastURL = target.absoluteString
                isLoading = false
                cancelWatchdog()
                return
            }
        }

        // Fallback: full deep-link load (?page= contract, D10 value encoding).
        active.webView.load(URLRequest(url: target))
        active.lastURL = target.absoluteString
    }

    private func retry() {
        // Fresh resolve on retry: a dead cached host must not be retried forever.
        ServerConfig.invalidateCache()
        loadError = nil
        isLoading = true
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

/// Resumes the softNavigate continuation exactly once — the JS callback and
/// the 5 s timeout race for it, and whichever loses must be a no-op.
private final class ResumeOnce {
    private var continuation: CheckedContinuation<Bool, Never>?

    init(continuation: CheckedContinuation<Bool, Never>) {
        self.continuation = continuation
    }

    func resume(returning value: Bool) {
        continuation?.resume(returning: value)
        continuation = nil
    }
}
