import SwiftUI
import WebKit

// WebView shell for Tier 3 pageIds inside the SwiftUI navigation, mirroring
// android ui/web/WebScreen.kt: loads the SPA deep-link URL (?page=<id>) on the
// active server so state stays uniform with the web app.

struct WebViewScreen: View {
    let pageId: String
    let query: String
    @State private var url: URL?

    var body: some View {
        Group {
            if let url {
                WebWebView(url: url)
                    .ignoresSafeArea(edges: .bottom)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(ZylodColor.background)
            }
        }
        .task {
            guard url == nil else { return }
            let base = await ServerConfig.resolve()
            let trimmed = base.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            var target = trimmed + "/?page=" + pageId
            if !query.isEmpty {
                target += "&" + query
            }
            url = URL(string: target)
        }
    }
}

private struct WebWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
