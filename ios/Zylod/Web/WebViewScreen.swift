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

    private enum Phase {
        case resolving
        case loading(URL)
        case failed(String)
    }

    @State private var phase: Phase = .resolving
    @State private var reloadToken = 0

    var body: some View {
        Group {
            switch phase {
            case .resolving:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZylodColor.background)
            case .loading(let url):
                WebWebView(url: url, reloadToken: reloadToken, onFailure: {
                    phase = .failed("The server isn't responding. Check your connection and try again.")
                })
                .ignoresSafeArea(edges: .bottom)
            case .failed(let message):
                webErrorView(message)
            }
        }
        .background(ZylodColor.background)
        // Runs on appear (token = 0) and again whenever retry() bumps the
        // token — the single driver of resolveAndLoad (no double-resolve).
        .task(id: reloadToken) {
            await resolveAndLoad()
        }
    }

    private func resolveAndLoad() async {
        guard case .resolving = phase else { return }
        // Cache-first: skip the probe storm when a winner is already known
        // (parity with android WebScreen.kt:30-36).
        let base = ServerConfig.cached() ?? await ServerConfig.resolve()
        let trimmed = base.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        // ?page=<id> contract; the id is percent-encoded (D10 parity).
        var target = trimmed + "/?page=" + (pageId.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? pageId)
        if !query.isEmpty {
            target += "&" + query
        }
        if let url = URL(string: target) {
            phase = .loading(url)
        } else {
            phase = .failed("Invalid server address.")
        }
    }

    private func retry() {
        phase = .resolving
        reloadToken += 1 // triggers .task(id:) → resolveAndLoad
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
    let reloadToken: Int
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
        // reloadToken changes only on retry-after-failure, which always passes
        // through a fresh .loading(URL) — reload just the changed navigation.
        if context.coordinator.lastToken != reloadToken {
            context.coordinator.lastToken = reloadToken
            webView.reload()
        }
    }

    func makeCoordinator() -> NavigationCoordinator {
        NavigationCoordinator()
    }

    final class NavigationCoordinator: NSObject, WKNavigationDelegate {
        var onFailure: (() -> Void)?
        var lastToken = 0

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            onFailure?()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            onFailure?()
        }
    }
}
