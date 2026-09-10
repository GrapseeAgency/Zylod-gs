import SwiftUI
import WebKit
import SafariServices

// WebView shell for Tier 3 pageIds inside the SwiftUI navigation, mirroring
// android ui/web/WebScreen.kt: loads the SPA deep-link URL (?page=<id>) on the
// active server so state stays uniform with the web app.
//
// D4 remediation: cache-first server resolution (no re-probe storm per tab),
// WKNavigationDelegate error handling with an explicit retry state, and a
// bounded state machine (invalid URL can no longer spin forever).
//
// Phase 1 (§7.1/§7.4): the WKWebViewConfiguration carries the ZylodNativeBridge
// script handler + document-start user scripts (bridge shim, connectivity
// snapshot, b2b-auth-storage seeding), external schemes (tel:/mailto:) and
// off-origin http(s) are routed out of the WebView, and iOS 17+ downloads go
// through WKDownloadDelegate.

struct WebViewScreen: View {
    let pageId: String
    let query: String

    @State private var loadedUrl: URL?
    @State private var loadError: String?

    var body: some View {
        Group {
            if let message = loadError {
                webErrorView(message)
            } else if let url = loadedUrl {
                WebWebView(url: url, onFailure: {
                    loadError = "The server isn't responding. Check your connection and try again."
                })
                .ignoresSafeArea(edges: .bottom)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZylodColor.background)
            }
        }
        .background(ZylodColor.background)
        .overlay(ToastOverlay())
        .task {
            await resolveAndLoad()
        }
    }

    private func resolveAndLoad() async {
        guard loadedUrl == nil, loadError == nil else { return }
        // Cache-first: skip the probe storm when a winner is already known
        // (parity with android WebScreen.kt:30-36).
        let base: String
        if let cached = ServerConfig.cached() {
            base = cached
        } else {
            base = await ServerConfig.resolve()
        }
        let trimmed = base.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        // ?page=<id> contract; the id and every query VALUE are percent-encoded
        // (D10 parity with android WebScreen.encodeQueryValues).
        let encodedPageId = pageId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? pageId
        var target = trimmed + "/?page=" + encodedPageId
        if !query.isEmpty {
            target += "&" + Self.encodeQueryValues(query)
        }
        if let url = URL(string: target) {
            loadedUrl = url
        } else {
            loadError = "Invalid server address."
        }
    }

    private func retry() {
        // Fresh resolve on retry: a dead cached host must not be retried
        // forever (parity with android WebScreen retry → ServerConfig.resolve).
        ServerConfig.invalidateCache()
        loadError = nil
        loadedUrl = nil // forces a fresh WKWebView with a fresh navigation
        Task { await resolveAndLoad() }
    }

    /// Encodes every VALUE segment of a preassembled query string (keeps '&'
    /// and '=') — mirrors android ui/web/WebScreen.encodeQueryValues.
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

private struct WebWebView: UIViewRepresentable {
    let url: URL
    let onFailure: () -> Void

    static let bridge = ZylodNativeBridge(host: BridgeCoordinatorHolder.shared)

    func makeUIView(context: Context) -> WKWebView {
        let configuration = Self.bridge.userContentConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsLinkPreview = false
        context.coordinator.onFailure = onFailure
        context.coordinator.webView = webView
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        Self.bridge.attach(webView: webView)
        // Download plumbing: WKWebView has no downloadDelegate member — when a
        // navigation becomes a download (`.download` policy below), the WKWebView
        // asks its WKNavigationDelegate for a delegate via the `didBecome` hooks,
        // implemented on BridgeCoordinator below (iOS 14.5+ API, target is 16).
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onFailure = onFailure
    }

    func makeCoordinator() -> BridgeCoordinator {
        BridgeCoordinatorHolder.shared
    }
}

/// The bridge host and the navigation delegate are the same object — the
/// bridge needs the WKWebView's evaluateJavaScript, and the coordinator needs
/// the bridge for downloads. One shared instance keeps the singleton WebKit
/// surface (script handlers register per-configuration, so sharing the
/// coordinator object is safe).
final class BridgeCoordinatorHolder {
    static let shared = BridgeCoordinator()
}

final class BridgeCoordinator: NSObject, BridgeHost {
    weak var webView: WKWebView?
    var onFailure: (() -> Void)?

    // MARK: BridgeHost

    func evaluateJavaScript(_ script: String) {
        DispatchQueue.main.async {
            self.webView?.evaluateJavaScript(script, completionHandler: nil)
        }
    }

    func showNativeToast(_ message: String) {
        // ToastCenter.show is @MainActor; this host method is called from the
        // (nonisolated) WKScriptMessageHandler path, so hop to main explicitly.
        DispatchQueue.main.async { ToastCenter.shared.show(message) }
    }

    func presentShareSheet(with items: [Any]) {
        guard let top = Self.topViewController() else { return }
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = top.view
        top.present(controller, animated: true)
    }

    func present(_ viewController: UIViewController) {
        guard let top = Self.topViewController() else { return }
        top.present(viewController, animated: true)
    }

    var isNetworkConnected: Bool { true }

    func retryServerConnection() {
        // Android WebScreen retry parity: fresh resolve + full reload.
        ServerConfig.invalidateCache()
        guard let webView else { return }
        if let url = webView.url {
            webView.load(URLRequest(url: url))
        } else {
            webView.reload()
        }
    }

    // MARK: Helpers

    static func topViewController() -> UIViewController? {
        guard var top = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow })?.rootViewController else { return nil }
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
    }
}

extension BridgeCoordinator: WKNavigationDelegate, WKUIDelegate {

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
                decisionHandler(.download)
                return
            }
        }
        decisionHandler(.allow)
    }

    /// A navigation the user asked to download (`.download` policy) is handed
    /// back here — supply the delegate that decides the destination file URL.
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) -> WKDownloadDelegate? {
        ZylodDownloadDelegate.shared
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) -> WKDownloadDelegate? {
        ZylodDownloadDelegate.shared
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
