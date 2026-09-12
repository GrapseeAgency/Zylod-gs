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
    /// Anchor for the restore-in-place fast path (informational — the DECISION
    /// comes from the live-state probe; see WebViewScreen.drive).
    var lastURL: String?
    /// Web→native PAGE-CHANGE ack. The hosting WebViewScreen reassigns this on
    /// EVERY drive (F7 generation handling — a closure pinned at shell creation
    /// would compare acks against a superseded pageId) and runs the
    /// authoritative document verification — the ack only triggers it (F4).
    var onPageChanged: ((String) -> Void)?

    /// F7 — navigation generation for THIS shell instance. Bumped by the
    /// hosting WebViewScreen at the start of every drive; every async callback
    /// (ack, soft-navigate result, probe result, load events) captures the
    /// generation it belongs to and is dropped unless the shell is still in
    /// that exact generation — a stale callback from a superseded navigation
    /// or a reused pooled shell may never reveal or modify the current screen.
    private(set) var navGeneration: Int = 0

    /// F1 — the bundle identity the CURRENT document reported (nil until a
    /// document verifies). Diagnostic surface for provenance audit.
    private(set) var servedIdentity: WebProvenance.BundleIdentity?

    fileprivate init(webView: WKWebView, baseUrl: String, seedFingerprint: String) {
        self.webView = webView
        self.baseUrl = baseUrl
        self.seedFingerprint = seedFingerprint
    }

    /// Starts a new navigation generation; returns the new value.
    func bumpGeneration() -> Int {
        navGeneration += 1
        return navGeneration
    }

    /// Records the identity reported by the currently-loaded document.
    func recordIdentity(_ identity: WebProvenance.BundleIdentity?) {
        servedIdentity = identity
    }
}

@MainActor
final class WKWebViewPool {
    static let shared = WKWebViewPool()

    private var free: [PooledWebView] = []
    private var busyShells: [PooledWebView] = []
    /// F7 — OWNED shells (tab destinations) are NOT checked out of the pool,
    /// but their acks must still route. They register here so `shell(for:)`
    /// finds them; without this, an owned tab shell's page-change acks were
    /// silently DROPPED (shell(for:) searched busy+free only).
    private var ownedShells: [PooledWebView] = []
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

    /// Owned shells (tabs) bypass the pool checkout/check-in entirely but
    /// register for ack routing.
    func makeOwnedShell(baseUrl: String) -> PooledWebView {
        let shell = makeShell(baseUrl: baseUrl)
        ownedShells.append(shell)
        return shell
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

    /// F7 — resolves the shell that owns EXACTLY this WebView instance,
    /// across BUSY (pooled) and OWNED (tab) shells. Detached (free) shells
    /// have no reachable handle — callbacks after check-in are dropped at
    /// the source. No global "last attached" lookup.
    func shell(for webView: WKWebView) -> PooledWebView? {
        busyShells.first(where: { $0.webView === webView })
            ?? ownedShells.first(where: { $0.webView === webView })
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
