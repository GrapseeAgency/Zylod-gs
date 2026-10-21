'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'

/** Rotate when fewer than 2 days of session remain. */
const ROTATE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Task 124: SESSION KEEP-ALIVE (near-expiry rotation) — the shell probes
 * GET /api/auth/session-info once per page load (non-destructive) and only
 * when the session is within 2 days of expiry does it POST
 * /api/auth/refresh — which destroys the old session (single-use) and sets
 * a fresh httpOnly 7-day cookie via Set-Cookie.
 *
 * Why conditional: rotating EVERY load would destroy the very token the
 * page's Bearer fetches are about to use. Normal loads therefore never
 * race their own authentication; a rotation only ever happens on a session
 * that is about to die anyway, and the auth store is synced with the new
 * token from the response (Bearer headers take precedence over the cookie
 * in extractToken, so a stale store token would 401 every Bearer fetch).
 */
export function useSessionRefresh() {
  useEffect(() => {
    let alive = true
    const run = async () => {
      try {
        const probe = await fetch('/api/auth/session-info', { credentials: 'include' })
        if (!alive || !probe.ok) return // anon / error → nothing to keep alive
        const pj = await probe.json().catch(() => null)
        const expiresInMs = pj?.data?.expiresInMs
        if (typeof expiresInMs !== 'number' || expiresInMs > ROTATE_THRESHOLD_MS) return

        const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
        if (!alive || !res.ok) return
        const json = await res.json().catch(() => null)
        if (alive && json?.success && typeof json.token === 'string') {
          // Keep the store's Bearer token in lockstep with the rotated cookie.
          useAuthStore.getState().setToken(json.token)
          window.dispatchEvent(new CustomEvent('zylod:session-refreshed'))
        }
      } catch {
        // Offline / reaper — silently ignore; next load retries.
      }
    }
    run()
    return () => { alive = false }
  }, [])
}
