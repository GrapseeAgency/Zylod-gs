// In-memory TTL cache for hot read-only API routes.
// The remote DB (Supabase pooler, ap-southeast-1) has multi-second round-trips,
// so identical list requests are served from memory. Stale copies are served
// when the DB is unreachable so the UI shows last-known data instead of errors.

interface CacheEntry<T> {
  value: T
  freshUntil: number
  staleUntil: number
}

const store = new Map<string, CacheEntry<unknown>>()

// One in-flight DB load per key — concurrent requests share a single round-trip
const inflight = new Map<string, Promise<unknown>>()

export interface CacheOptions {
  /** ms the cached value is served without hitting the DB */
  ttlMs: number
  /** ms after expiry that a stale value may still be served if the DB fails */
  staleMs: number
}

export function cacheGetFresh<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (entry && Date.now() < entry.freshUntil) return entry.value as T
  return undefined
}

export function cacheGetStale<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (entry && Date.now() < entry.staleUntil) return entry.value as T
  return undefined
}

export function cacheSet<T>(key: string, value: T, opts: CacheOptions): void {
  const now = Date.now()
  store.set(key, { value, freshUntil: now + opts.ttlMs, staleUntil: now + opts.staleMs })
}

/**
 * Wrap a DB-backed GET handler with caching:
 * 1. fresh cache hit  → return instantly
 * 2. expired + stale copy → return stale instantly, refresh in background
 * 3. no copy → await a single-flight DB load
 * 4. DB failure + stale copy → serve the stale payload (never a hard error)
 */
export async function withApiCache<T>(
  key: string,
  opts: CacheOptions,
  loadFromDb: () => Promise<T>
): Promise<{ data: T; source: 'fresh' | 'db' | 'stale' }> {
  const fresh = cacheGetFresh<T>(key)
  if (fresh !== undefined) return { data: fresh, source: 'fresh' }

  const startLoad = () => {
    let p = inflight.get(key) as Promise<T> | undefined
    if (!p) {
      p = loadFromDb()
        .then((value) => {
          cacheSet(key, value, opts)
          return value
        })
        .finally(() => {
          inflight.delete(key)
        })
      inflight.set(key, p)
    }
    return p
  }

  const stale = cacheGetStale<T>(key)
  if (stale !== undefined) {
    // Stale-while-revalidate: answer immediately, refresh behind the scenes
    startLoad().catch(() => {
      console.warn(`[api-cache] background refresh failed for "${key}", keeping stale copy`)
    })
    return { data: stale, source: 'stale' }
  }

  try {
    const data = await startLoad()
    return { data, source: 'db' }
  } catch (err) {
    const staleNow = cacheGetStale<T>(key)
    if (staleNow !== undefined) {
      console.warn(`[api-cache] DB failed for "${key}", serving stale copy`)
      return { data: staleNow, source: 'stale' }
    }
    throw err
  }
}
