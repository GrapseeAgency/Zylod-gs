/**
 * Deterministic native-host detection (Phase 1 remediation — owner audit
 * finding: duplicate navigation chrome).
 *
 * When a pageId is hosted inside the Zylod Android/iOS shell, the shell
 * renders its own bottom navigation bar. The web app must then suppress its
 * OWN mobile chrome (MobileBottomNav, the detail back-bar, bottom padding)
 * so exactly one navigation system is visible. Browsers never match any
 * marker below, so web users are unaffected — nothing is removed globally.
 *
 * Markers the shells set, all available before the first React render:
 *  - `window.__ZYL_NATIVE__`      — injected at document start by both shells
 *                                   (session/WebShellScripts.kt / .swift)
 *  - `window.ZylodNativeBridge`   — Android @JavascriptInterface object, and
 *                                   the iOS document-start shim
 *  - `window.webkit.messageHandlers.ZylodNativeBridge` — iOS raw transport
 *  - UA suffix `ZylodAndroidNative/<version>` (Android settings.userAgentString)
 *  - UA application name `ZylodiOSNative/<version>` (iOS WKWebViewConfiguration)
 *
 * Client-only by construction: the SPA mounts via dynamic(ssr: false), so
 * this flag can never cause a hydration mismatch.
 */

import { useMemo } from 'react'

export function detectNativeHost(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    __ZYL_NATIVE__?: boolean
    ZylodNativeBridge?: unknown
    webkit?: { messageHandlers?: { ZylodNativeBridge?: unknown } }
  }
  if (w.__ZYL_NATIVE__ === true) return true
  if (w.ZylodNativeBridge) return true
  if (w.webkit?.messageHandlers?.ZylodNativeBridge) return true
  const ua = navigator.userAgent || ''
  return ua.includes('ZylodAndroidNative/') || ua.includes('ZylodiOSNative/')
}

let memoized: boolean | null = null

/** One-shot synchronous check with process-wide memoization. */
export function isNativeHost(): boolean {
  if (memoized === null) memoized = detectNativeHost()
  return memoized
}

/** React hook form — stable for the lifetime of the page. */
export function useNativeHost(): boolean {
  return useMemo(() => isNativeHost(), [])
}

/**
 * Web-initiated navigation through the NATIVE shell (`ZylodNativeBridge.
 * openPage`, Android WebAppBridge / iOS script-message parity): when any web
 * chrome is visible inside a shell, its taps must change the NATIVE route —
 * never an SPA state that diverges from the shell's own navigation bar.
 * Returns false when no native transport is available (plain browser).
 */
export function nativeOpenPage(pageId: string, params = ''): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    ZylodNativeBridge?: { openPage?: (pageId: string, params: string) => void }
    webkit?: { messageHandlers?: { ZylodNativeBridge?: { postMessage: (msg: unknown) => void } } }
  }
  try {
    if (typeof w.ZylodNativeBridge?.openPage === 'function') {
      w.ZylodNativeBridge.openPage(pageId, params)
      return true
    }
    if (w.webkit?.messageHandlers?.ZylodNativeBridge) {
      w.webkit.messageHandlers.ZylodNativeBridge.postMessage({
        method: 'openPage',
        pageId,
        params,
      })
      return true
    }
  } catch {
    // A bridge failure must never break the web fallback navigation.
  }
  return false
}
