package com.zylod.wholesale.session

import android.webkit.WebView
import androidx.webkit.WebViewCompat
import com.zylod.wholesale.ui.web.documentStartOriginRule
import org.json.JSONObject

/**
 * Static document-start + soft-navigation scripts shared by the native
 * WebView shell and the pooled shells (Phase 1 runtime-audit fixes #1/#2).
 *
 * Chrome suppression — owner audit findings (rounds 2 and 3): the web app
 * renders its own fixed bottom navigation bar (mobile-bottom-nav.tsx). When
 * the page is hosted in a shell, EXACTLY ONE navigation system may exist.
 * Three independent layers, because a silent failure of one must not break
 * the navigation contract:
 *
 *  1. Primary (post-deploy web bundle): the web side tags that bar with
 *     `data-zylod-mobile-nav` (and its bottom-inset wrappers with
 *     `data-zylod-nav-padding`) AND self-suppresses via the native-host flag
 *     (`window.__ZYL_NATIVE__`, src/lib/native-host.ts) — the web app
 *     recognises the native host and renders no duplicate chrome at all.
 *
 *  2. Fallback (transition shim while the older web bundle is still
 *     deployed): the same stylesheet targets the legacy bar by its stable
 *     shape — `nav.fixed.bottom-0` — and flattens the legacy wrapper padding
 *     class. Verified: the only `nav` element in the web app that is
 *     position:fixed at the bottom is the mobile bottom bar (sheets and
 *     sticky buy-bars are divs), so the shim cannot hide legitimate web
 *     functionality.
 *
 *  3. Runtime sweep (round-3 fix — the audit device kept the legacy bar
 *     visible because `addDocumentStartJavaScript` can be unsupported by the
 *     WebView provider, which failed silently): an idempotent JS sweep hides
 *     the bar again after every DOM mutation (MutationObserver) and — belt
 *     and suspenders — CAPTURES clicks on the legacy bar's five buttons and
 *     routes them to the native navigation bridge
 *     (`window.ZylodNativeBridge.openPage(pageId)`), so even a visible
 *     legacy bar can never perform a divergent SPA navigation.
 *
 * Browsers never receive the injection, so no legitimate web functionality
 * changes for web users.
 *
 * Soft navigation — findings #1/#2: once the SPA signals
 * `window.__zylodSpaReady` (set by the web navigation store right after the
 * popstate listener is registered), the shell can drive pageId changes with
 * history.pushState + a synthetic popstate — the store's own contract —
 * instead of a full document reload. The script VERIFIES the navigation was
 * consumed (history.state.page === pageId after the synchronous popstate
 * handler ran) and falls back to loadUrl when the flag is absent (SPA not
 * hydrated yet, or a stale cached bundle) or the contract drifted — a false
 * "ok" previously left the previous page painted under a new native route
 * (round-3 finding: taps appeared dead).
 */
object WebShellScripts {

    private const val CHROME_SUPPRESSION_CSS =
        "[data-zylod-mobile-nav]{display:none!important}" +
            "[data-zylod-nav-padding]{padding-bottom:16px!important}" +
            // Transition shim for the not-yet-redeployed web bundle (see KDoc):
            "nav.fixed.bottom-0{display:none!important}" +
            "[class*=\"pb-[calc(64px\"]{padding-bottom:16px!important}"

    /** Set by [installDocumentStartScripts] — false ⇒ runtime fallbacks must inject. */
    @Volatile
    internal var primaryDocumentStartApiAvailable: Boolean = false

    /** Legacy bottom bar's fixed button order (mobile-bottom-nav.tsx NAV_ITEMS). */
    private val LEGACY_BAR_PAGE_IDS = listOf("home", "category-browser", "flash-deals", "cart", "profile")

    /**
     * The full document-start script: native flag + suppression stylesheet +
     * idempotent DOM sweep with a MutationObserver + legacy-bar click capture
     * that routes taps into the native navigation bridge.
     */
    fun chromeSuppressionScript(): String {
        val pageIdsLiteral = LEGACY_BAR_PAGE_IDS.joinToString(",") { "'$it'" }
        return """
        window.__ZYL_NATIVE__ = true;
        (function(){
          try{
            if (window.__ZYL_SHELL_SUPPRESS__) return;
            window.__ZYL_SHELL_SUPPRESS__ = true;
            var css = '$CHROME_SUPPRESSION_CSS';
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
            var PAGE_IDS = [$pageIdsLiteral];
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
                      if (window.ZylodNativeBridge && window.ZylodNativeBridge.openPage){
                        window.ZylodNativeBridge.openPage(pageId, '');
                      }
                    }catch(err){}
                  }, true);
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
        """.trimIndent()
    }

    /** Injects the suppression script at page start when the webkit API is unavailable. */
    fun injectSuppressionFallback(view: WebView?) {
        if (primaryDocumentStartApiAvailable) return
        view?.evaluateJavascript(chromeSuppressionScript(), null)
    }

    /**
     * Installs the static document-start scripts (chrome suppression) for the
     * shell's origin. The auth seed is installed separately via
     * [WebAuthSeeder] because it changes with the session state.
     */
    fun installDocumentStartScripts(webView: WebView, baseUrl: String) {
        val origin = documentStartOriginRule(baseUrl) ?: return
        primaryDocumentStartApiAvailable = try {
            WebViewCompat.addDocumentStartJavaScript(webView, chromeSuppressionScript(), setOf(origin))
            true
        } catch (_: Throwable) {
            false
        }
    }

    /**
     * F1+F4 — THE authoritative verification probe. One round-trip returns
     * everything the shell needs to decide whether a document may be shown:
     *
     *  - `identity` — the served bundle's build identity
     *    (window.__ZylodBundleIdentity, set inline in <head> before any
     *    hydration). F1: missing identity = unknown bundle = never accepted.
     *  - `spaReady` — the SPA's popstate listener is registered, i.e. the
     *    bundle supports the soft-navigate + ack contract.
     *  - `page`/`params` — the SPA's LIVE committed page state
     *    (window.__zylodCurrentPage/__zylodCurrentParams). F4: the shell may
     *    reveal a destination ONLY when this matches the requested
     *    pageId+params for the current navigation generation — pushState
     *    "ok" and onPageFinished are never treated as proof on their own.
     *
     * The result is a JSON string (null-safe even for non-Zylod documents).
     */
    fun documentVerifyScript(): String = """
        (function(){
          var out = { identity: null, spaReady: false, page: null, params: {} };
          try{
            var id = window.__ZylodBundleIdentity;
            if (id){
              var obj = null;
              if (typeof id === 'object') { obj = id; }
              else if (typeof id === 'string') { try { obj = JSON.parse(id); } catch(e) { obj = null; } }
              if (obj && typeof obj === 'object'){
                out.identity = {
                  commit: String(obj.commit || ''),
                  shortCommit: String(obj.shortCommit || String(obj.commit || '').slice(0,7)),
                  version: String(obj.version || ''),
                  builtAt: String(obj.builtAt || '')
                };
                if (!out.identity.commit) out.identity = null;
              }
            }
            out.spaReady = (window.__zylodSpaReady === true);
            if (typeof window.__zylodCurrentPage === 'string') out.page = window.__zylodCurrentPage;
            try { out.params = JSON.parse(window.__zylodCurrentParams || '{}') || {}; } catch(e) { out.params = {}; }
          }catch(e){}
          return JSON.stringify(out);
        })();
    """.trimIndent()

    /**
     * Returns "ok" after driving the SPA to (pageId, query) client-side AND
     * verifying the store consumed it (history.state.page === pageId — the
     * popstate handler runs synchronously inside dispatchEvent), or "no" when
     * the SPA has not signalled readiness / the contract drifted — the caller
     * must then fall back to a full loadUrl of the `?page=` deep link.
     *
     * F4 NOTE: "ok" verifies only that the store CONSUMED the pushState — it
     * is never, by itself, proof that the new page finished committing. The
     * shell lifts stale-content suppression exclusively on the authoritative
     * [documentVerifyScript] verification (ack-driven or polled) — never on
     * this result alone.
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
                var st = history.state;
                if (!st || st.page !== $pageIdLiteral) return "no";
                return "ok";
              }catch(e){ return "no"; }
            })();
        """.trimIndent()
    }
}
