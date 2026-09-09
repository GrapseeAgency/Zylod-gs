'use client'
/**
 * Typed helpers for the native Android WebView bridge (ZylodNativeBridge).
 * Every function is a safe no-op when the app runs in a normal browser.
 */

interface NativeBridge {
  isNativeAndroid?: () => boolean
  isNetworkConnected?: () => boolean
  getAppVersionName?: () => string
  getAppVersionCode?: () => number
  cacheOfflineProducts?: (productsJson: string, callbackJsFunction: string) => void
  searchOfflineProducts?: (query: string, callbackJsFunction: string) => void
  getOfflineProductCount?: (callbackJsFunction: string) => void
  getOfflineQueueCount?: (callbackJsFunction: string) => void
  enqueueOfflineAction?: (actionType: string, entityType: string, payloadJson: string) => void
  setAuthToken?: (token: string) => void
  retryServerConnection?: () => void
  startBarcodeScanner?: (callbackJsFunction: string) => void
  startVoiceRecognition?: (callbackJsFunction: string) => void
  copyToClipboard?: (text: string) => boolean
  getDeviceId?: () => string
  requestNativeNotificationPermission?: (callbackJsFunction: string) => void
  showNativeNotification?: (title: string, body: string, channelId?: string) => void
  clearLocalAppCache?: () => void
  showToast?: (message: string) => void
  triggerHaptic?: (type: string) => void
}

export function getNativeBridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  // The native side invokes this by name once the cache write finishes.
  if (typeof w.__zylodOfflineCacheNoop !== 'function') {
    w.__zylodOfflineCacheNoop = () => {}
  }
  const bridge = (w as unknown as { ZylodNativeBridge?: NativeBridge }).ZylodNativeBridge
  return bridge ?? null
}

export function isNativeAndroidApp(): boolean {
  try {
    return !!getNativeBridge()?.isNativeAndroid?.()
  } catch {
    return false
  }
}

/**
 * Pushes a product list (shape: /api/products rows) into the native Room
 * offline cache. No-op outside the Android shell.
 */
export function cacheProductsForOffline(products: unknown[]): void {
  const bridge = getNativeBridge()
  if (!bridge?.cacheOfflineProducts || !Array.isArray(products) || products.length === 0) return
  try {
    bridge.cacheOfflineProducts(JSON.stringify(products), 'window.__zylodOfflineCacheNoop')
  } catch {
    // Cache population is best-effort; never break page rendering.
  }
}

let lastSyncedToken: string | null = null

/**
 * Mirrors the session token into the native encrypted store so the
 * OfflineSyncWorker can replay queued actions as the signed-in user.
 * No-op outside the Android shell.
 */
export function syncNativeAuthToken(token: string | null): void {
  if (token === lastSyncedToken) return
  lastSyncedToken = token
  const bridge = getNativeBridge()
  if (!bridge?.setAuthToken) return
  try {
    if (token) {
      bridge.setAuthToken(token)
    }
    // A null/cleared token is intentionally not pushed — the worker keeps the
    // last valid token; explicit sign-out clears it via clearNativeAuthToken.
  } catch {
    // Token sync is best-effort.
  }
}

/** Clears the mirrored session token (native sign-out / storage clear). */
export function clearNativeAuthToken(): void {
  lastSyncedToken = null
  const bridge = getNativeBridge()
  if (!bridge?.setAuthToken) return
  try {
    bridge.setAuthToken('')
  } catch {
    // Best-effort.
  }
}

/** True when the native offline queue can accept actions. */
export function isNativeOfflineCapable(): boolean {
  try {
    return !!getNativeBridge()?.enqueueOfflineAction
  } catch {
    return false
  }
}

/**
 * Queues a mutation for replay by the native sync worker. The payload must
 * carry everything needed to reproduce the request later.
 */
export function queueOfflineAction(
  actionType: string,
  entityType: string,
  request: { url: string; method: string; body?: unknown }
): void {
  const bridge = getNativeBridge()
  if (!bridge?.enqueueOfflineAction) return
  try {
    bridge.enqueueOfflineAction(actionType, entityType, JSON.stringify(request))
  } catch {
    // Queueing is best-effort; surface nothing to avoid double-error UI.
  }
}

/**
 * Opens the native camera barcode scanner. Resolves with the decoded code,
 * or null when the scan fails / is cancelled. Rejects outside the Android shell.
 */
export function scanBarcodeWithNativeCamera(): Promise<string | null> {
  const bridge = getNativeBridge()
  if (!bridge?.startBarcodeScanner) {
    return Promise.reject(new Error('Native barcode scanner unavailable'))
  }
  return new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>
    let settled = false
    const callbackName = '__zylodBarcodeCallback'
    w[callbackName] = (success: boolean, code: string | null) => {
      if (settled) return
      settled = true
      delete w[callbackName]
      resolve(success && code ? code : null)
    }
    bridge.startBarcodeScanner!(callbackName)
  })
}

/**
 * Native speech recognition (Android SpeechRecognizer). The WebView does not
 * implement the Web Speech API at all, so voice search must go through here.
 * Resolves with the recognized text; rejects when unavailable or on error.
 */
export function recognizeSpeechWithNative(): Promise<string> {
  const bridge = getNativeBridge()
  if (!bridge?.startVoiceRecognition) {
    return Promise.reject(new Error('Native speech recognition unavailable'))
  }
  return new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    let settled = false
    const callbackName = '__zylodVoiceCallback'
    w[callbackName] = (success: boolean, textOrError: string | null) => {
      if (settled) return
      settled = true
      delete w[callbackName]
      if (success && textOrError) resolve(textOrError)
      else reject(new Error(textOrError || 'Voice recognition failed'))
    }
    bridge.startVoiceRecognition!(callbackName)
  })
}

/**
 * Returns true when the native shell can do speech recognition.
 * (Used to route voice UI before attempting anything.)
 */
export function hasNativeVoiceRecognition(): boolean {
  try {
    return !!getNativeBridge()?.startVoiceRecognition
  } catch {
    return false
  }
}

/** Stable per-install device id from the native side, or null on web. */
export function getNativeDeviceId(): string | null {
  const bridge = getNativeBridge()
  if (!bridge?.getDeviceId) return null
  try {
    return bridge.getDeviceId() || null
  } catch {
    return null
  }
}

/** Copies text via the native ClipboardManager. Returns false when unavailable. */
export function copyTextNative(text: string): boolean {
  const bridge = getNativeBridge()
  if (!bridge?.copyToClipboard) return false
  try {
    return !!bridge.copyToClipboard(text)
  } catch {
    return false
  }
}

/**
 * The WebView exposes no navigator.clipboard on non-secure (http://) origins,
 * which would kill every copy-to-clipboard button in the app on dev servers.
 * Polyfill it onto the native bridge when we are inside the shell.
 */
function installNativeClipboardPolyfill(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  if (!isNativeAndroidApp()) return
  const nav = navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } }
  if (typeof nav.clipboard?.writeText === 'function') return
  const shim = {
    writeText: (text: string): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (copyTextNative(text)) resolve()
        else reject(new Error('Clipboard write failed'))
      }),
  }
  ;(navigator as unknown as { clipboard: unknown }).clipboard = shim
}

// Install as soon as any client module pulls this file in.
installNativeClipboardPolyfill()

/**
 * Notification permission via the native runtime permission (the WebView does
 * not implement the Web Notifications API). Resolves to the granted state.
 */
export function requestNativeNotificationPermission(): Promise<boolean> {
  const bridge = getNativeBridge()
  if (!bridge?.requestNativeNotificationPermission) {
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    const w = window as unknown as Record<string, unknown>
    let settled = false
    const callbackName = '__zylodNotifPermCallback'
    w[callbackName] = (granted: boolean) => {
      if (settled) return
      settled = true
      delete w[callbackName]
      resolve(!!granted)
    }
    bridge.requestNativeNotificationPermission!(callbackName)
  })
}

/** Posts a notification through the app's native channels. */
export function showNativeNotification(title: string, body: string, channelId?: string): void {
  const bridge = getNativeBridge()
  if (!bridge?.showNativeNotification) return
  try {
    bridge.showNativeNotification(title, body, channelId)
  } catch {
    // Best-effort.
  }
}

/** True when the native shell can show notifications. */
export function hasNativeNotifications(): boolean {
  try {
    return !!getNativeBridge()?.showNativeNotification
  } catch {
    return false
  }
}
