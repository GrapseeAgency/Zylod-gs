'use client'

import { useEffect, useState } from 'react'

/**
 * usePublicSettings — shared client hook for GET /api/settings/public.
 *
 * Real behavior (no fake data):
 * - One simple fetch on mount (public endpoint — no auth headers needed).
 * - The module keeps a 60s in-memory TTL cache and dedupes concurrent calls
 *   with a single in-flight promise, so every consumer (footer, help center,
 *   …) shares ONE request per TTL window instead of hammering the
 *   rate-limited endpoint (60/min per IP).
 * - Graceful failure: on a non-2xx response, malformed payload or network
 *   error the hook keeps `settings` as an empty object and exposes the error.
 *   Consumers must stay SILENT when values are missing — honest absence,
 *   never a fabricated default contact.
 * - Successful payloads are cached; failures are NOT cached (a later mount
 *   retries).
 */

export interface PublicSettingsPayload {
  settings: Record<string, string>
  updatedAt: Record<string, string>
}

export interface UsePublicSettingsResult extends PublicSettingsPayload {
  loading: boolean
  error: string | null
}

const TTL_MS = 60_000

let cached: { data: PublicSettingsPayload; fetchedAt: number } | null = null
let inFlight: Promise<PublicSettingsPayload> | null = null

/** Keep only string entries — the current public registry keys
 * (support.email / support.phone) are strings; anything else is dropped
 * rather than misrendered. */
function pickStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') out[key] = entry
  }
  return out
}

async function fetchPublicSettings(): Promise<PublicSettingsPayload> {
  const res = await fetch('/api/settings/public', { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Public settings request failed (HTTP ${res.status})`)
  }
  const body: unknown = await res.json().catch(() => null)
  const data =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { success?: unknown; data?: unknown })
      : null
  if (!data || data.success !== true || !data.data || typeof data.data !== 'object') {
    throw new Error('Public settings response was malformed')
  }
  const payload = data.data as Record<string, unknown>
  return {
    settings: pickStringRecord(payload.settings),
    updatedAt: pickStringRecord(payload.updatedAt),
  }
}

export function usePublicSettings(): UsePublicSettingsResult {
  // A warm module cache (e.g. client-side remount within the TTL window) is
  // applied synchronously. On the server the module cache is always null and
  // no effect ever runs there, so SSR output and first client render agree.
  const [state, setState] = useState<UsePublicSettingsResult>(() =>
    cached
      ? { ...cached.data, loading: false, error: null }
      : { settings: {}, updatedAt: {}, loading: true, error: null }
  )

  useEffect(() => {
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      setState({ ...cached.data, loading: false, error: null })
      return
    }

    let active = true
    setState((prev) => ({ ...prev, loading: true }))

    if (!inFlight) {
      inFlight = fetchPublicSettings()
        .then((data) => {
          cached = { data, fetchedAt: Date.now() }
          return data
        })
        .finally(() => {
          inFlight = null
        })
    }

    inFlight
      .then((data) => {
        if (!active) return
        setState({ ...data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!active) return
        // Honest failure: empty settings — consumers render nothing rather
        // than inventing a default contact.
        setState({
          settings: {},
          updatedAt: {},
          loading: false,
          error: err instanceof Error ? err.message : 'Public settings request failed',
        })
      })

    return () => {
      active = false
    }
  }, [])

  return state
}
