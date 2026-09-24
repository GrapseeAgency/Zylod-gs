/**
 * In-memory sliding-window rate limiter (no external middleware needed).
 * Per process — appropriate for a single Node deployment; on Railway with
 * multiple instances each instance enforces its own budget, which is still
 * an effective throttle for credential stuffing and checkout abuse.
 *
 * keyed by: bucket + client IP (x-forwarded-for aware).
 */
import { NextRequest } from 'next/server'

interface Hit {
  timestamps: number[]
}

const buckets = new Map<string, Hit>()
// Periodically drop stale entries so the map cannot grow unbounded
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let lastCleanup = Date.now()

export interface RateLimitResult {
  ok: boolean
  /** seconds until the client may retry (only set when ok=false) */
  retryAfter?: number
  remaining: number
}

function cleanup(now: number, windowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, hit] of buckets) {
    hit.timestamps = hit.timestamps.filter((t) => now - t < windowMs)
    if (hit.timestamps.length === 0) buckets.delete(key)
  }
}

export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export function checkRateLimit(
  request: NextRequest,
  bucket: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  cleanup(now, windowMs)

  const key = `${bucket}:${clientIp(request)}`
  const hit = buckets.get(key) ?? { timestamps: [] }
  hit.timestamps = hit.timestamps.filter((t) => now - t < windowMs)

  if (hit.timestamps.length >= limit) {
    const oldest = hit.timestamps[0]
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    buckets.set(key, hit)
    return { ok: false, retryAfter, remaining: 0 }
  }

  hit.timestamps.push(now)
  buckets.set(key, hit)
  return { ok: true, remaining: limit - hit.timestamps.length }
}

/** Standard 429 response for rate-limited requests. */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: `Too many requests. Try again in ${result.retryAfter}s.`,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter ?? 60),
      },
    }
  )
}
