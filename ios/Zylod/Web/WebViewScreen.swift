import SwiftUI
import WebKit

// WebView shell for Tier 3 pageIds inside the SwiftUI navigation, mirroring
// android ui/web/WebScreen.kt: loads the SPA deep-link URL (?page=<id>) on the
// active server so state stays uniform with the web app.
//
// D4 remediation: cache-first server resolution (no re-probe storm per tab),
// WKNavigationDelegate error handling with an explicit retry state, and a
// bounded state machine (invalid URL can no longer spin forever).

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
        // ?page=<id> contract; the id is percent-encoded (D10 parity).
        let encodedPageId = pageId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? pageId
        var target = trimmed + "/?page=" + encodedPageId
        if !query.isEmpty {
            target += "&" + query
        }
        if let url = URL(string: target) {
            loadedUrl = url
        } else {
            loadError = "Invalid server address."
        }
    }

    private func retry() {
        loadError = nil
        loadedUrl = nil // forces a fresh WKWebView with a fresh navigation
        Task { await resolveAndLoad() }
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

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = true
        context.coordinator.onFailure = onFailure
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onFailure = onFailure
    }

    func makeCoordinator() -> NavigationCoordinator {
        NavigationCoordinator()
    }

    final class NavigationCoordinator: NSObject, WKNavigationDelegate {
        var onFailure: (() -> Void)?

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            onFailure?()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            onFailure?()
        }
    }
}
