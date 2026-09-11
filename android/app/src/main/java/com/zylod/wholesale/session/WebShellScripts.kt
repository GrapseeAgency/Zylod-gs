package com.zylod.wholesale.session

import android.webkit.WebView
import androidx.webkit.WebViewCompat
import com.zylod.wholesale.ui.web.documentStartOriginRule
import org.json.JSONObject

/**
 * Static document-start + soft-navigation scripts shared by the native
 * WebView shell and the pooled shells (Phase 1 runtime-audit fixes #1/#2).
 *
 * Chrome suppression — owner audit finding #4: the web app renders its own
 * fixed bottom navigation bar (mobile-bottom-nav.tsx), which duplicated the
 * native bottom bar inside the app. Two layers:
 *
 *  1. Primary (post-deploy web bundle): the web side tags that bar with
 *     `data-zylod-mobile-nav` (and its bottom-inset wrappers with
 *     `data-zylod-nav-padding`) AND self-suppresses via the native-host flag
 *     (`window.__ZYL_NATIVE__`, src/lib/native-host.ts) — the web app
 *     recognises the native host and renders no duplicate chrome at all.
 *
 *  2. Fallback (transition shim while the older web bundle is still
 *     deployed): the same stylesheet also targets the legacy bar by its
 *     stable shape — `nav.fixed.bottom-0` — and flattens the legacy wrapper
 *     padding class. Verified: the only `nav` element in the web app that is
 *     position:fixed at the bottom is the mobile bottom bar (sheets and
 *     sticky buy-bars are divs), so the shim cannot hide legitimate web
 *     functionality.
 * Browsers never receive the injection, so no legitimate web functionality
 * changes for web users.
 *
 * Soft navigation — findings #1/#2: once the SPA signals
 * `window.__zylodSpaReady` (set by the web navigation store right after the
 * popstate listener is registered), the shell can drive pageId changes with
 * history.pushState + a synthetic popstate — the store's own contract —
 * instead of a full document reload. Falls back to loadUrl when the flag is
 * absent (SPA not hydrated yet, or a stale cached bundle).
 */
object WebShellScripts {

    private const val CHROME_SUPPRESSION_CSS =
        "[data-zylod-mobile-nav]{display:none!important}" +
            "[data-zylod-nav-padding]{padding-bottom:16px!important}" +
            // Transition shim for the not-yet-redeployed web bundle (see KDoc):
            "nav.fixed.bottom-0{display:none!important}" +
            "[class*=\"pb-[calc(64px\"]{padding-bottom:16px!important}"

    /** Injects the suppression stylesheet as early as possible, zero flash. */
    fun chromeSuppressionScript(): String = """
        window.__ZYL_NATIVE__ = true;
        (function(){
          try{
            var css = '$CHROME_SUPPRESSION_CSS';
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
    """.trimIndent()

    /**
     * Returns "ok" after driving the SPA to (pageId, query) client-side, or
     * "no" when the SPA has not signalled readiness — the caller must then
     * fall back to a full loadUrl of the `?page=` deep link.
     */
    fun softNavigateScript(pageId: String, query: String): String {
        val params = JSONObject()
        if (query.isNotBlank()) {
            query.split('&').forEach { pair ->
                if (pair.isEmpty()) return@forEach
                val eq = pair.indexOf('=')
                val key = if (eq < 0) pair else pair.substring(0, eq)
                val value = if (eq < 0) "" else pair.substring(eq + 1)
                if (key.isNotEmpty()) params.put(key, value)
            }
        }
        val pageIdLiteral = JSONObject.quote(pageId)
        val paramsLiteral = params.toString()
        return """
            (function(){
              try{
                if (window.__zylodSpaReady !== true) return "no";
                var p = $paramsLiteral;
                var qs = new URLSearchParams(p).toString();
                history.pushState(
                  { page: $pageIdLiteral, params: p },
                  "",
                  window.location.pathname + (qs ? "?" + qs : "")
                );
                window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
                return "ok";
              }catch(e){ return "no"; }
            })();
        """.trimIndent()
    }

    /**
     * Installs the static document-start scripts (chrome suppression) for the
     * shell's origin. The auth seed is installed separately via
     * [WebAuthSeeder] because it changes with the session state.
     */
    fun installDocumentStartScripts(webView: WebView, baseUrl: String) {
        val origin = documentStartOriginRule(baseUrl) ?: return
        runCatching {
            WebViewCompat.addDocumentStartJavaScript(webView, chromeSuppressionScript(), setOf(origin))
        }
    }
}
