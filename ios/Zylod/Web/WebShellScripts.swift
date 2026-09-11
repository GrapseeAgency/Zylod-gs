import Foundation

// Static document-start + soft-navigation scripts shared by the iOS WKWebView
// shell and the pooled shells (Phase 1 runtime-audit fixes #1/#2/#4 — mirrors
// android session/WebShellScripts.kt).
//
// Chrome suppression — owner audit findings (rounds 2 and 3): the web app
// renders its own fixed bottom navigation bar (mobile-bottom-nav.tsx). When
// the page is hosted in a shell, EXACTLY ONE navigation system may exist.
// Three independent layers, because a silent failure of one must not break
// the navigation contract:
//
//  1. Primary (post-deploy web bundle): the web side tags that bar with
//     `data-zylod-mobile-nav` (and its bottom-inset wrappers with
//     `data-zylod-nav-padding`) AND self-suppresses via the native-host flag
//     (`window.__ZYL_NATIVE__`, src/lib/native-host.ts).
//
//  2. Fallback (transition shim while the older web bundle is still
//     deployed): the same stylesheet targets the legacy bar by its stable
//     shape — `nav.fixed.bottom-0` — and flattens the legacy wrapper padding
//     class. Verified: the only `nav` element in the web app that is
//     position:fixed at the bottom is the mobile bottom bar (sheets and
//     sticky buy-bars are divs), so the shim cannot hide legitimate web
//     functionality.
//
//  3. Runtime sweep (round-3 fix): an idempotent JS sweep re-asserts the
//     suppression after every SPA DOM mutation (MutationObserver) and — belt
//     and suspenders — CAPTURES clicks on the legacy bar's five buttons and
//     routes them through the native navigation contract
//     (`window.webkit.messageHandlers.ZylodNativeBridge` openPage), so even a
//     visible legacy bar can never perform a divergent SPA navigation.
//
// Browsers never receive the injection.
//
// Soft navigation — findings #1/#2: once the SPA signals `window.__zylodSpaReady`
// (set by the web navigation store right after its popstate listener is
// registered), the shell can drive pageId changes with history.pushState + a
// synthetic popstate — the store's own contract — instead of a full document
// reload. The script VERIFIES the navigation was consumed
// (history.state.page === pageId after the synchronous popstate handler ran);
// a false "ok" previously left the previous page painted under a new native
// route (round-3 finding: taps appeared dead).

enum WebShellScripts {

    static let chromeSuppressionCSS =
        "[data-zylod-mobile-nav]{display:none!important}" +
        "[data-zylod-nav-padding]{padding-bottom:16px!important}" +
        // Transition shim for the not-yet-redeployed web bundle (see KDoc):
        "nav.fixed.bottom-0{display:none!important}" +
        "[class*=\"pb-[calc(64px\"]{padding-bottom:16px!important}"

    /// Legacy bottom bar's fixed button order (mobile-bottom-nav.tsx NAV_ITEMS).
    private static let legacyBarPageIds = ["home", "category-browser", "flash-deals", "cart", "profile"]

    /// Injected at document start so the duplicate web chrome never paints
    /// and the web app can recognise the native host before its first render.
    static var chromeSuppressionScript: String {
        let css = chromeSuppressionCSS
        let pageIdsLiteral = legacyBarPageIds.map { jsStringLiteral($0) }.joined(separator: ",")
        return """
        window.__ZYL_NATIVE__ = true;
        (function(){
          try{
            if (window.__ZYL_SHELL_SUPPRESS__) return;
            window.__ZYL_SHELL_SUPPRESS__ = true;
            var css = '\(css)';
            function addStyle(){
              if (document.getElementById('zylod-shell-css')) return;
              var s = document.createElement('style');
              s.id = 'zylod-shell-css';
              s.textContent = css;
              (document.head || document.documentElement).appendChild(s);
            }
            addStyle();
            document.addEventListener('readystatechange', addStyle);
            // Runtime sweep: re-assert suppression after SPA mutations, and
            // capture clicks on the legacy bar so a tap can only ever reach
            // the native navigation contract (never a divergent SPA nav).
            var PAGE_IDS = [\(pageIdsLiteral)];
            function sweep(){
              try{
                addStyle();
                var bars = document.querySelectorAll('nav[data-zylod-mobile-nav], nav.fixed.bottom-0');
                for (var i = 0; i < bars.length; i++){
                  var bar = bars[i];
                  if (bar.getAttribute('data-zylod-shell-nav') === '1') continue;
                  bar.setAttribute('data-zylod-shell-nav', '1');
                  bar.addEventListener('click', function(e){
                    try{
                      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
                      if (!btn) return;
                      var host = btn.parentElement;
                      var idx = host ? Array.prototype.indexOf.call(host.children, btn) : -1;
                      var pageId = (idx >= 0 && idx < PAGE_IDS.length) ? PAGE_IDS[idx] : null;
                      if (!pageId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      openViaNativeBridge(pageId);
                    }catch(err){}
                  }, true);
                }
              }catch(e){}
            }
            function openViaNativeBridge(pageId){
              try{
                if (window.ZylodNativeBridge && typeof window.ZylodNativeBridge.openPage === 'function'){
                  window.ZylodNativeBridge.openPage(pageId, '');
                } else if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ZylodNativeBridge){
                  window.webkit.messageHandlers.ZylodNativeBridge.postMessage({ type: 'openPage', pageId: pageId, params: '' });
                }
              }catch(e){}
            }
            if (window.MutationObserver){
              new MutationObserver(sweep).observe(document.documentElement, {childList:true, subtree:true});
            }
            document.addEventListener('DOMContentLoaded', sweep);
            window.addEventListener('load', sweep);
          }catch(e){}
        })();
        """
    }

    /// JS-escapes a string into a double-quoted JS string literal.
    static func jsStringLiteral(_ value: String) -> String {
        var escaped = value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "'", with: "\\'")
        // Control characters that would break the literal.
        let controls: [Character] = ["\0", "\u{08}", "\u{0B}", "\u{0C}", "\u{1B}"]
        for c in controls {
            escaped = escaped.replacingOccurrences(of: String(c), with: "")
        }
        return "\"\(escaped)\""
    }

    /// Returns "ok" after driving the SPA to (pageId, query) client-side AND
    /// verifying the store consumed it (history.state.page === pageId), or
    /// "no" when the SPA has not signalled readiness / the contract drifted —
    /// the caller must then fall back to a full deep-link load.
    static func softNavigateScript(pageId: String, query: String) -> String {
        var pairs: [String] = []
        if !query.isEmpty {
            for pair in query.split(separator: "&", omittingEmptySubsequences: true) {
                let raw = String(pair)
                let eq = raw.firstIndex(of: "=")
                let key = eq.map { String(raw[raw.startIndex..<$0]) } ?? raw
                let value = eq.map { String(raw[raw.index(after: $0)...]) } ?? ""
                if !key.isEmpty {
                    pairs.append("\(jsStringLiteral(key)): \(jsStringLiteral(value))")
                }
            }
        }
        let paramsLiteral = "{\(pairs.joined(separator: ", "))}"
        let pageIdLiteral = jsStringLiteral(pageId)
        return """
        (function(){
          try{
            if (window.__zylodSpaReady !== true) return "no";
            var p = \(paramsLiteral);
            var qs = new URLSearchParams(p).toString();
            history.pushState(
              { page: \(pageIdLiteral), params: p },
              "",
              window.location.pathname + (qs ? "?" + qs : "")
            );
            window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
            var st = history.state;
            if (!st || st.page !== \(pageIdLiteral)) return "no";
            return "ok";
          }catch(e){ return "no"; }
        })();
        """
    }
}
