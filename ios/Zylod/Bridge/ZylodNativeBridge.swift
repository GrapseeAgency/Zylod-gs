import Foundation
import Network
import UIKit
import LocalAuthentication
import UserNotifications
import WebKit

// §7.1 — ZylodNativeBridge: WKScriptMessageHandler implementing the full
// Android WebAppBridge.kt contract (24 methods + ZylodDownload.save parity)
// under the SAME names the web's native-bridge.ts expects.
//
// Transport: the web calls `window.ZylodNativeBridge.<method>(...)` — that
// object is a shim installed by `bridgeBootstrapJavaScript` at document start
// (WKUserScript). Synchronous getters (isNativeAndroid, isNetworkConnected,
// getAppVersion*, getDeviceId) return values snapshotted into the shim or
// pushed later via evaluateJavaScript; the rest marshal into
// window.webkit.messageHandlers.ZylodNativeBridge.postMessage and native
// answers through one-shot self-deleting `window.__zylod*Callback` functions
// by evaluating "<callbackName>(<args>)" — EXACTLY the Android convention
// (WebAppBridge.kt evaluates "$callbackJsFunction($args)").
//
// Callback-name table (web → native invocation):
//   startBarcodeScanner(cb)                 → cb(success:Bool, code:String?)        __zylodBarcodeCallback
//   startVoiceRecognition(cb)               → cb(success:Bool, textOrError:String?) __zylodVoiceCallback
//   requestNativeNotificationPermission(cb) → cb(granted:Bool)                      __zylodNotifPermCallback
//   requestBiometricAuth(cb)                → cb(success:Bool, error:String?)       (caller-defined, e.g. __biometricCallback)
//   cacheOfflineProducts(json, cb)          → cb(count:Int)                         __zylodOfflineCacheNoop
//   searchOfflineProducts(q, cb)            → cb(jsonString:String)                 (caller-defined; JSON-quoted, Android parity)
//   getOfflineProductCount(cb)              → cb(count:Int)
//   getOfflineQueueCount(cb)                → cb(count:Int)

protocol BridgeHost: AnyObject {
    /// Runs JS in the page's main world (must be called on the main thread).
    func evaluateJavaScript(_ script: String)
    /// Native toast overlay over the WebView.
    func showNativeToast(_ message: String)
    /// Presents a share sheet for downloaded/cached files.
    func presentShareSheet(with items: [Any])
    /// Server-unreachable retry (WebScreen parity: invalidate cache + reload).
    func retryServerConnection()
    /// Presents a view controller (barcode scanner, share sheets).
    func present(_ viewController: UIViewController)
    /// Currently displayed toast message (mirrored from web showToast calls).
    var isNetworkConnected: Bool { get }
}

final class ZylodNativeBridge: NSObject {
    private weak var host: BridgeHost?
    private weak var webView: WKWebView?
    let offlineStore = OfflineStore()
    private let networkMonitor = NetworkPathMonitor()
    private var notificationIds = 5000

    /// Web-initiated navigation hook (`ZylodNativeBridge.openPage`): set by
    /// RootView on appear — routes the request through the SAME tab contract
    /// as the native tab bar (Android NativeNavBus parity). Main-thread only.
    static var onOpenPage: ((String, String) -> Void)?

    init(host: BridgeHost) {
        self.host = host
        super.init()
        networkMonitor.onChange = { [weak self] connected in
            // Android parity: inject the connectivity flag into every live page
            // (WebScreen.kt:283-286 injects on network-state changes).
            self?.host?.evaluateJavaScript("try{window.__zylodNativeNetwork=\(connected ? "true" : "false")}catch(e){}")
            if connected {
                self?.offlineStore.drainQueue()
            }
        }
        networkMonitor.start()
    }

    func attach(webView: WKWebView) {
        self.webView = webView
        offlineStore.onQueueChanged = { [weak self] in
            // Web pages polling getOfflineQueueCount get fresh numbers the
            // next time they ask; nothing to push proactively.
            _ = self
        }
    }

    // MARK: - Shell construction (pooled + owned shells)
    //
    // The former per-call userContentConfiguration() is folded into
    // shellConfiguration() so every shell registers exactly ONE script
    // handler (ZylodNativeBridge.shared) — duplicate registrations on
    // separate controllers would fork the OfflineStore/NetworkMonitor state.

    /// Builds a fully-configured shell WebView: bridge configuration,
    /// gesture settings and the native-host user-agent marker.
    static func makeShellWebView(baseUrl: String) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: shellConfiguration())
        // One navigation system: the NavigationStack owns back (system back
        // button + edge-swipe pop). Enabling WKWebView's back-forward gesture
        // here made the edge swipe drive the SPA's pushState history INSIDE a
        // pushed screen while the same swipe popped the native screen — two
        // competing back semantics with gesture contention.
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        return webView
    }

    /// All shells share ONE WebContent process pool: JS heaps, caches and
    /// the renderer warm up once instead of up to five times (audit finding
    /// #3 — WebView creation/destruction and JS execution cost).
    private static let sharedProcessPool = WKProcessPool()

    /// The one shell configuration: all three document-start scripts (bridge
    /// shim, current auth seed, chrome suppression) + native UA marker.
    static func shellConfiguration() -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.processPool = sharedProcessPool
        // Append-only UA token — web code can detect the native host without
        // breaking the default Safari UA string.
        configuration.applicationNameForUserAgent = "ZylodiOSNative/\(versionName)"
        configuration.userContentController = userContentController()
        return configuration
    }

    private static func userContentController() -> WKUserContentController {
        let controller = WKUserContentController()

        // 1. Snapshot + shim (document start, main world). The shim defines
        //    window.ZylodNativeBridge BEFORE any page script runs.
        let bootstrap = bridgeBootstrapJavaScript(
            versionName: versionName,
            versionCode: versionCode,
            deviceId: deviceId
        )
        controller.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // 2. §7.4 auth seeding — token present → seed b2b-auth-storage;
        //    token absent → remove any stale copy (logout propagation).
        let authScript = SessionManager.seedJavaScript() ?? SessionManager.clearAuthJavaScript
        controller.addUserScript(WKUserScript(source: authScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        // 3. Duplicate-chrome suppression (Phase 1 audit fix #4) — hides the
        //    web app's own bottom navigation bar inside the shell.
        controller.addUserScript(WKUserScript(source: WebShellScripts.chromeSuppressionScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        controller.add(Self.shared, name: "ZylodNativeBridge")
        return controller
    }

    /// The single script-message handler shared by every shell. One instance
    /// owns the one OfflineStore + NetworkPathMonitor — creating more would
    /// duplicate monitors and queues.
    static let shared = ZylodNativeBridge(host: BridgeCoordinatorHolder.shared)

    /// In-place re-seed after a token change (pooled shell reuse): user
    /// scripts are REMOVABLE on iOS (unlike Android's document-start API),
    /// so the full set is rebuilt with the current auth script.
    static func reinstallUserScripts(on webView: WKWebView, authScript: String) {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()

        let bootstrap = bridgeBootstrapJavaScript(
            versionName: versionName,
            versionCode: versionCode,
            deviceId: deviceId
        )
        controller.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.addUserScript(WKUserScript(source: authScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.addUserScript(WKUserScript(source: WebShellScripts.chromeSuppressionScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    // MARK: - Version / device

    static var versionName: String {
        let base = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "2.4.5"
        return base
    }

    static var versionCode: Int {
        // parity with Android BuildConfig.VERSION_CODE (245)
        Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "245") ?? 245
    }

    /// Stable per-install identifier (Android: persisted UUID in prefs).
    static var deviceId: String {
        let defaults = UserDefaults.standard
        let key = "zylod_device_id"
        if let existing = defaults.string(forKey: key), !existing.isEmpty { return existing }
        if let vendor = UIDevice.current.identifierForVendor?.uuidString {
            defaults.set(vendor, forKey: key)
            return vendor
        }
        let generated = UUID().uuidString
        defaults.set(generated, forKey: key)
        return generated
    }

    // MARK: - The injected bootstrap

    static func bridgeBootstrapJavaScript(versionName: String, versionCode: Int, deviceId: String) -> String {
        let safeDeviceId = SessionManager.jsStringLiteral(deviceId)
        let safeVersionName = SessionManager.jsStringLiteral(versionName)
        return """
        (function(){
          if (window.ZylodNativeBridge) return;
          window.__zylodNativeNetwork = true;
          window.__zylodVersionName = \(safeVersionName);
          window.__zylodVersionCode = \(versionCode);
          window.__zylodDeviceId = \(safeDeviceId);
          var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ZylodNativeBridge;
          function post(payload){ if (handler) { try { handler.postMessage(payload); } catch (e) {} } }
          var bridge = {
            isNativeAndroid: function(){ return true; },
            isNetworkConnected: function(){
              return (typeof window.__zylodNativeNetwork === 'boolean') ? window.__zylodNativeNetwork : (navigator.onLine !== false);
            },
            getAppVersionName: function(){ return window.__zylodVersionName || ''; },
            getAppVersionCode: function(){ return window.__zylodVersionCode || 0; },
            getDeviceId: function(){ return window.__zylodDeviceId || ''; },
            copyToClipboard: function(text){ post({method:'copyToClipboard', text: String(text == null ? '' : text)}); return true; },
            setAuthToken: function(token){ post({method:'setAuthToken', token: String(token == null ? '' : token)}); },
            retryServerConnection: function(){ post({method:'retryServerConnection'}); },
            clearLocalAppCache: function(){ post({method:'clearLocalAppCache'}); },
            showToast: function(message){ post({method:'showToast', message: String(message == null ? '' : message)}); },
            triggerHaptic: function(type){ post({method:'triggerHaptic', type: String(type || 'IMPACT')}); },
            triggerHapticFeedback: function(){ post({method:'triggerHaptic', type: 'IMPACT'}); },
            loadLiveUrl: function(url){ post({method:'loadLiveUrl', url: String(url || '')}); },
            cacheOfflineProducts: function(productsJson, callback){ post({method:'cacheOfflineProducts', productsJson: String(productsJson || '[]'), callback: String(callback || '')}); },
            searchOfflineProducts: function(query, callback){ post({method:'searchOfflineProducts', query: String(query || ''), callback: String(callback || '')}); },
            getOfflineProductCount: function(callback){ post({method:'getOfflineProductCount', callback: String(callback || '')}); },
            getOfflineQueueCount: function(callback){ post({method:'getOfflineQueueCount', callback: String(callback || '')}); },
            enqueueOfflineAction: function(actionType, entityType, payloadJson){ post({method:'enqueueOfflineAction', actionType: String(actionType || ''), entityType: String(entityType || ''), payloadJson: String(payloadJson || '{}')}); },
            startBarcodeScanner: function(callback){ post({method:'startBarcodeScanner', callback: String(callback || '')}); },
            startVoiceRecognition: function(callback){ post({method:'startVoiceRecognition', callback: String(callback || '')}); },
            requestNativeNotificationPermission: function(callback){ post({method:'requestNativeNotificationPermission', callback: String(callback || '')}); },
            requestBiometricAuth: function(callback){ post({method:'requestBiometricAuth', callback: String(callback || '')}); },
            authenticateWithBiometrics: function(title, callback){ post({method:'requestBiometricAuth', callback: String(callback || '')}); },
            showNativeNotification: function(title, body, channelId){ post({method:'showNativeNotification', title: String(title || ''), body: String(body || ''), channelId: String(channelId || '')}); },
            // Android DownloadBridge.save(dataUrl, filename, mime) parity.
            save: function(dataUrl, filename, mime){ post({method:'downloadSave', dataUrl: String(dataUrl || ''), filename: String(filename || 'zylod_download'), mime: String(mime || 'application/octet-stream')}); },
            // Native navigation contract (Android WebAppBridge.openPage parity):
            // a hosted page asks the SHELL to change screens — never a divergent
            // SPA navigation inside the WebView.
            openPage: function(pageId, params){ post({method:'openPage', pageId: String(pageId || ''), params: String(params || '')}); },
            // Web→native PAGE-CHANGE ack (Android WebAppBridge.onPageChanged
            // parity, round-4): the SPA's navigation store reports every
            // committed page change so the shell's knowledge stays live truth.
            onPageChanged: function(pageId){ post({method:'pageChanged', pageId: String(pageId || '')}); }
          };
          window.ZylodNativeBridge = bridge;
          window.ZylodDownload = { save: bridge.save };
        })();
        """
    }

    // MARK: - Callback helpers (Android WebAppBridge evaluateJavascript parity)

    private func invokeCallback(_ name: String, _ args: String) {
        guard !name.isEmpty else { return }
        host?.evaluateJavaScript("try{\(name)(\(args));}catch(e){}")
    }

    private func jsQuote(_ value: String) -> String {
        guard let data = try? JSONEncoder().encode(value),
              let quoted = String(data: data, encoding: .utf8) else { return "\"\"" }
        return quoted
    }

    // MARK: - Message dispatch

    private func dispatch(method: String, message: [String: Any]) {
        switch method {
        // Native navigation FIRST — must never queue behind disk work.
        case "openPage":
            let pageId = message["pageId"] as? String ?? ""
            let params = message["params"] as? String ?? ""
            DispatchQueue.main.async {
                ZylodNativeBridge.onOpenPage?(pageId, params)
            }
        case "pageChanged":
            // Round-4 ack: deliver to the ATTACHED shell's screen. Main-actor
            // hop — WKWebViewPool/PooledWebView are MainActor-bound.
            let pageId = message["pageId"] as? String ?? ""
            let attached = self.webView
            Task { @MainActor in
                guard let attached else { return }
                WKWebViewPool.shared.shell(for: attached)?.onPageChanged?(pageId)
            }
        case "copyToClipboard":
            let text = message["text"] as? String ?? ""
            UIPasteboard.general.string = text
        case "setAuthToken":
            // web→native mirror (native-bridge.syncNativeAuthToken). Empty
            // string clears — Android parity (WebAppBridge.kt:100-117).
            let token = (message["token"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if token.isEmpty {
                SessionManager.setToken(nil)
            } else {
                SessionManager.setToken(token)
            }
        case "retryServerConnection":
            host?.retryServerConnection()
        case "clearLocalAppCache":
            clearLocalAppCache()
            host?.showNativeToast("Local storage & product cache cleared.")
        case "showToast":
            host?.showNativeToast(message["message"] as? String ?? "")
        case "triggerHaptic":
            Self.triggerHaptic(message["type"] as? String ?? "IMPACT")
        case "loadLiveUrl":
            if let url = URL(string: message["url"] as? String ?? "") {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        case "cacheOfflineProducts":
            let json = message["productsJson"] as? String ?? "[]"
            let callback = message["callback"] as? String ?? ""
            // OFF-MAIN: OfflineStore methods do synchronous disk I/O
            // (ioQueue.sync + JSONSerialization) — running them on the main
            // thread from the script-message path dropped frames whenever a
            // page cached/searched products while a list scrolled (round-3
            // Category-scroll finding). invokeCallback hops back to main.
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self else { return }
                let count = self.offlineStore.cacheProducts(json: json)
                self.invokeCallback(callback, String(count))
            }
        case "searchOfflineProducts":
            let query = message["query"] as? String ?? ""
            let callback = message["callback"] as? String ?? ""
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self else { return }
                let results = self.offlineStore.search(query: query)
                let payload = (try? JSONEncoder().encode(results)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
                // Android passes the JSON array as a quoted string argument.
                self.invokeCallback(callback, self.jsQuote(payload))
            }
        case "getOfflineProductCount":
            let callback = message["callback"] as? String ?? ""
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self else { return }
                self.invokeCallback(callback, String(self.offlineStore.productCount()))
            }
        case "getOfflineQueueCount":
            let callback = message["callback"] as? String ?? ""
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self else { return }
                self.invokeCallback(callback, String(self.offlineStore.queueCount()))
            }
        case "enqueueOfflineAction":
            let actionType = message["actionType"] as? String ?? ""
            let entityType = message["entityType"] as? String ?? ""
            let payloadJson = message["payloadJson"] as? String ?? "{}"
            DispatchQueue.global(qos: .utility).async { [weak self] in
                guard let self else { return }
                self.offlineStore.enqueue(actionType: actionType, entityType: entityType, payloadJson: payloadJson)
                self.offlineStore.drainQueue()
                self.host?.showNativeToast("Operation saved offline. Will sync when connected.")
            }
        case "startBarcodeScanner":
            startBarcodeScanner(callback: message["callback"] as? String ?? "")
        case "startVoiceRecognition":
            VoiceRecognitionController.shared.run { [weak self] success, textOrError in
                let arg = success ? (self?.jsQuote(textOrError ?? "") ?? "\"\"") : (self?.jsQuote(textOrError ?? "Voice recognition failed") ?? "\"\"")
                self?.invokeCallback(message["callback"] as? String ?? "", "\(success ? "true" : "false"), \(arg)")
            }
        case "requestNativeNotificationPermission":
            requestNotificationPermission { granted in
                self.invokeCallback(message["callback"] as? String ?? "", granted ? "true" : "false")
            }
        case "requestBiometricAuth":
            requestBiometricAuth { success, errorText in
                let arg = errorText == nil ? "null" : self.jsQuote(errorText ?? "")
                self.invokeCallback(message["callback"] as? String ?? "", "\(success ? "true" : "false"), \(arg)")
            }
        case "showNativeNotification":
            showNotification(
                title: message["title"] as? String ?? "",
                body: message["body"] as? String ?? "",
                channelId: message["channelId"] as? String
            )
        case "downloadSave":
            DownloadHandler.saveDataUrl(
                dataUrl: message["dataUrl"] as? String ?? "",
                filename: message["filename"] as? String ?? "zylod_download",
                mime: message["mime"] as? String ?? "application/octet-stream"
            ) { [weak self] url in
                if let url {
                    self?.host?.showNativeToast("Saved to Files")
                    self?.host?.presentShareSheet(with: [url])
                } else {
                    self?.host?.showNativeToast("Could not save the file")
                }
            }
        default:
            break
        }
    }

    // MARK: - Capability implementations

    static func triggerHaptic(_ type: String) {
        // Web vibrate patterns: default [40,60,40], chime [30], urgent [80,50,80].
        switch type.uppercased() {
        case "SUCCESS", "CONFIRM":
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case "ERROR":
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        case "WARNING":
            UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "LIGHT":
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "MEDIUM":
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case "HEAVY":
            UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        default:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    private func clearLocalAppCache() {
        URLCache.shared.removeAllCachedResponses()
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeLocalStorage],
            modifiedSince: .distantPast
        ) { }
        offlineStore.clearProducts()
    }

    private func startBarcodeScanner(callback: String) {
        guard #available(iOS 16.0, *) else {
            invokeCallback(callback, "false, \(jsQuote("Barcode scanning requires iOS 16 or newer"))")
            return
        }
        guard let host else {
            invokeCallback(callback, "false, \(jsQuote("Scanner unavailable"))")
            return
        }
        DispatchQueue.main.async {
            let scanner = BarcodeScannerViewController { success, code in
                self.invokeCallback(callback, "\(success ? "true" : "false"), \(code.map { self.jsQuote($0) } ?? "null")")
            }
            host.present(scanner)
        }
    }

    private func requestNotificationPermission(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async { completion(granted) }
        }
    }

    private func requestBiometricAuth(completion: @escaping (Bool, String?) -> Void) {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"
        var evaluationError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &evaluationError) else {
            completion(false, evaluationError?.localizedDescription ?? "Biometric authentication is not available on this device")
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Confirm identity with Face ID, Touch ID, or your passcode"
        ) { success, error in
            DispatchQueue.main.async {
                if success {
                    completion(true, nil)
                } else {
                    completion(false, error?.localizedDescription ?? "Authentication failed")
                }
            }
        }
    }

    private func showNotification(title: String, body: String, channelId: String?) {
        // channelId → thread identifier (Android channels parity).
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.threadIdentifier = channelId ?? "orders"
        let request = UNNotificationRequest(
            identifier: "zylod-\(notificationIds)",
            content: content,
            trigger: nil
        )
        notificationIds += 1
        UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
    }
}

// MARK: - WKScriptMessageHandler

extension ZylodNativeBridge: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "ZylodNativeBridge",
              let body = message.body as? [String: Any],
              let method = body["method"] as? String else { return }
        // Route async replies back to the SENDING shell (pooled + owned shells
        // are alive simultaneously — see BridgeCoordinator.evaluateTarget).
        (host as? BridgeCoordinator)?.evaluateTarget = message.webView
        dispatch(method: method, message: body)
    }
}

// MARK: - NWPathMonitor wrapper

final class NetworkPathMonitor {
    private let monitor = NWPathMonitor()
    var onChange: ((Bool) -> Void)?
    private(set) var isConnected = true

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let connected = path.status == .satisfied
            guard let self, connected != self.isConnected else { return }
            self.isConnected = connected
            self.onChange?(connected)
        }
        monitor.start(queue: DispatchQueue(label: "com.zylod.networkmonitor"))
    }

    func stop() {
        monitor.cancel()
    }
}
