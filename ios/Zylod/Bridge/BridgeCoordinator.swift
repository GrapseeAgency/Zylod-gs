import Foundation
import UIKit
import WebKit
import SafariServices

// The bridge host and the script-message target are the same object — the
// bridge needs the WKWebView's evaluateJavaScript. Phase 1 audit refactor:
// the WKNavigationDelegate/WKUIDelegate duties that used to live here moved
// to the per-checkout ShellNavCoordinator (Web/WebViewScreen.swift) so each
// hosted screen gets its own load events (loading state, failure retry) —
// the old shared-delegate design could not express per-screen state.

final class BridgeCoordinatorHolder {
    static let shared = BridgeCoordinator()
}

final class BridgeCoordinator: NSObject, BridgeHost {
    weak var webView: WKWebView?

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
