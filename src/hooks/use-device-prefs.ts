'use client'

/**
 * useDevicePrefs — honest localStorage-backed device preferences.
 *
 * These are CLIENT-ONLY concerns (image cache cap, network timeout, biometric
 * preference, data-saver). They do NOT belong on the server — a web user's
 * device is the only place they make sense. The Kotlin native app persists
 * the same keys through its own DataStore on-device.
 *
 * Every read is gated behind `typeof window !== 'undefined'` so SSR is safe;
 * every write fires a `zylod:device-prefs` event so multiple mounted components
 * stay in sync on the same tab.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'zylod:device-prefs:v1'
const EVENT = 'zylod:device-prefs'

export type DevicePrefs = {
  // App settings hub
  biometricLogin: boolean
  autoSyncIntervalMins: number
  sessionInactivityLock: boolean
  wifiOnlyImagePreload: boolean
  // Network settings
  networkTimeoutMs: number
  dataSaver: boolean
  dnsOverHttps: boolean
  // Image cache
  imageQuality: 'ultra' | 'high' | 'medium'
  imageCacheMaxMb: number
  // Cache settings (Task 171)
  swPrecache: boolean
  memoryQueryCache: boolean
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  biometricLogin: true,
  autoSyncIntervalMins: 15,
  sessionInactivityLock: true,
  wifiOnlyImagePreload: true,
  networkTimeoutMs: 15000,
  dataSaver: false,
  dnsOverHttps: true,
  imageQuality: 'high',
  imageCacheMaxMb: 200,
  swPrecache: true,
  memoryQueryCache: true,
}

function readRaw(): DevicePrefs {
  if (typeof window === 'undefined') return DEFAULT_DEVICE_PREFS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DEVICE_PREFS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_DEVICE_PREFS, ...parsed }
  } catch {
    return DEFAULT_DEVICE_PREFS
  }
}

// useSyncExternalStore plumbing — keeps every mounted subscriber honest.
let cached: DevicePrefs = DEFAULT_DEVICE_PREFS
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT, cb)
    window.addEventListener('storage', cb)
  }
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT, cb)
      window.removeEventListener('storage', cb)
    }
  }
}

function getSnapshot(): DevicePrefs {
  return cached
}

function getServerSnapshot(): DevicePrefs {
  return DEFAULT_DEVICE_PREFS
}

function broadcast() {
  cached = readRaw()
  listeners.forEach(cb => cb())
}

if (typeof window !== 'undefined') {
  cached = readRaw()
}

export function useDevicePrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const update = useCallback(<K extends keyof DevicePrefs>(key: K, value: DevicePrefs[K]) => {
    if (typeof window === 'undefined') return
    const next = { ...readRaw(), [key]: value }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      broadcast()
    } catch {
      // Quota exceeded or disabled storage — fail silently (honest: no fake success).
    }
  }, [])

  const replaceAll = useCallback((next: Partial<DevicePrefs>) => {
    if (typeof window === 'undefined') return
    const merged = { ...readRaw(), ...next }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      broadcast()
    } catch {
      // ignore
    }
  }, [])

  const reset = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      broadcast()
    } catch {
      // ignore
    }
  }, [])

  return { prefs, update, replaceAll, reset }
}

/**
 * Estimate the real localStorage usage by this domain in bytes.
 * Used by the app-settings hub so the "Storage Manager" tile shows an honest
 * number derived from the actual bytes stored, not a fabricated "52.4 MB".
 */
export function useLocalStorageUsageBytes() {
  const [bytes, setBytes] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let total = 0
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (!k) continue
        const v = window.localStorage.getItem(k) ?? ''
        total += k.length + v.length
      }
    } catch {
      total = 0
    }
    // 2 bytes per char (UTF-16).
    setBytes(total * 2)
  }, [])
  return bytes
}
