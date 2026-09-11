import Foundation

// Static document-start + soft-navigation scripts shared by the iOS WKWebView
// shell and the pooled shells (Phase 1 runtime-audit fixes #1/#2/#4 — mirrors
// android session/WebShellScripts.kt).
//
// Chrome suppression — owner audit finding #4: the web app renders its own
// fixed bottom navigation bar (mobile-bottom-nav.tsx), which duplicated the
// system tab bar inside the app. The web side tags that bar with
// `data-zylod-mobile-nav` (and its bottom-inset wrappers with
// `data-zylod-nav-padding`); this injected stylesheet hides them ONLY inside
// the native shells. Safari/browser users never receive the injection.
//
// Soft navigation — findings #1/#2: once the SPA signals `window.__zylodSpaReady`
// (set by the web navigation store right after its popstate listener is
// registered), the shell can drive pageId changes with history.pushState + a
// synthetic popstate — the store's own contract — instead of a full document
// reload. Falls back to a full load when the flag is absent.

enum WebShellScripts {

    static let chromeSuppressionCSS =
        "[data-zylod-mobile-nav]{display:none!important}" +
        "[data-zylod-nav-padding]{padding-bottom:16px!important}"

    /// Injected at document start so the duplicate web chrome never paints.
    static var chromeSuppressionScript: String {
        let css = chromeSuppressionCSS
        return """
        (function(){
          try{
            var css = '\(css)';
            function add(){
              var s = document.createElement('style');
              s.setAttribute('data-zylod-shell-css','');
              s.textContent = css;
              (document.head || document.documentElement).appendChild(s);
            }
            if (document.head || document.documentElement) { add(); }
            else { document.addEventListener('readystatechange', function(){ add(); }); }
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

    /// Returns "ok" after driving the SPA to (pageId, query) client-side, or
    /// "no" when the SPA has not signalled readiness — the caller must then
    /// fall back to a full deep-link load.
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
            return "ok";
          }catch(e){ return "no"; }
        })();
        """
    }
}
