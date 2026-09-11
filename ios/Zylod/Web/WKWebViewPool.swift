import Foundation
import WebKit

// Phase 1 runtime-audit fix (owner findings #1/#2/#4): pooled WKWebView shells.
//
// Previously every pushed WebRoute built a brand-new WKWebView and loaded the
// whole SPA document again — navigation between Tier-3 pages re-downloaded and
// re-hydrated the app each time (slow, unreliable-feeling navigation). The
// pool keeps finished shells alive: a popped destination checks its shell in
// (WebKit automatically throttles a detached view), and the next push checks
// the same shell out and SOFT-NAVIGATES it to the new pageId — no document
// reload.
//
// Tab destinations (Categories/Hot Deals/Profile) do NOT use the pool: TabView
// keeps each tab's shell for the tab's lifetime (owned shells, see
// TabWebViewScreen). The pool serves pushed routes only, so a tab can never
// fight a push over the same WKWebView instance.

@MainActor
final class PooledWebView {
    let webView: WKWebView
    let baseUrl: String
    /// Auth-seed script state installed on the user content controller — a
    /// login/logout between checkouts is re-seeded IN PLACE (WKUserScripts
    /// are removable, unlike Android's document-start API).
    var seedFingerprint: String
    /// Anchor for the restore-in-place fast path: the SPA keeps location in
    /// sync via pushState, so webView.URL is the truth about what is showing.
    var lastURL: String?

    fileprivate init(webView: WKWebView, baseUrl: String, seedFingerprint: String) {
        self.webView = webView
        self.baseUrl = baseUrl
        self.seedFingerprint = seedFingerprint
    }
}

@MainActor
final class WKWebViewPool {
    static let shared = WKWebViewPool()

    private var free: [PooledWebView] = []
    private var busyShells: [PooledWebView] = []
    private let maxFree = 2

    private init() {}

    // MARK: - Shell creation

    private func makeShell(baseUrl: String) -> PooledWebView {
        let seed = SessionManager.seedJavaScript() ?? SessionManager.clearAuthJavaScript
        let webView = ZylodNativeBridge.makeShellWebView(baseUrl: baseUrl)
        return PooledWebView(webView: webView, baseUrl: baseUrl, seedFingerprint: seed)
    }

    // MARK: - Checkout / check-in

    /// Returns a shell for [baseUrl], reusing a compatible free one when the
    /// base URL matches; re-seeds the user scripts in place when the session
    /// token changed since the shell was last used.
    func checkOut(baseUrl: String) -> PooledWebView {
        if let reusable = free.first(where: { $0.baseUrl == baseUrl }) {
            free.removeAll { $0 === reusable }
            reseedIfNeeded(reusable)
            busyShells.append(reusable)
            return reusable
        }
        // Incompatible free shells (server switch) are destroyed outright.
        for stale in free where stale.baseUrl != baseUrl {
            destroy(stale)
        }
        free.removeAll { $0.baseUrl != baseUrl }

        let shell = makeShell(baseUrl: baseUrl)
        busyShells.append(shell)
        return shell
    }

    /// Owned shells (tabs) bypass the pool entirely.
    func makeOwnedShell(baseUrl: String) -> PooledWebView {
        makeShell(baseUrl: baseUrl)
    }

    func checkIn(_ shell: PooledWebView) {
        guard let index = busyShells.firstIndex(where: { $0 === shell }) else { return }
        busyShells.remove(at: index)
        shell.lastURL = shell.webView.url?.absoluteString
        // Detached WKWebViews suspend rendering; timers continue but the page
        // is idle in practice. No public pause API exists on WKWebView.
        shell.webView.removeFromSuperview()
        free.append(shell)
        while free.count > maxFree, let oldest = free.first {
            free.removeFirst()
            destroy(oldest)
        }
    }

    func shell(for webView: WKWebView) -> PooledWebView? {
        busyShells.first(where: { $0.webView === webView })
            ?? free.first(where: { $0.webView === webView })
    }

    private func destroy(_ shell: PooledWebView) {
        shell.webView.removeFromSuperview()
        // WKWebView teardown: stop loading, then drop navigation delegates so
        // late callbacks cannot hit a dead coordinator.
        shell.webView.stopLoading()
        shell.webView.navigationDelegate = nil
        shell.webView.uiDelegate = nil
    }

    /// Re-installs the user scripts when the auth state changed since the
    /// shell was created/last seeded. bootstrap (bridge shim) + chrome
    /// suppression (duplicate bottom-nav fix) + current auth seed.
    func reseedIfNeeded(_ shell: PooledWebView) {
        let current = SessionManager.seedJavaScript() ?? SessionManager.clearAuthJavaScript
        guard current != shell.seedFingerprint else { return }
        ZylodNativeBridge.reinstallUserScripts(on: shell.webView, authScript: current)
        shell.seedFingerprint = current
        // A rotated token invalidates the loaded page's session view.
        shell.lastURL = nil
    }
}
