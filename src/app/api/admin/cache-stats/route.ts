import { NextRequest, NextResponse } from 'next/server'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { cacheSnapshot } from '@/lib/api-cache'

/**
 * GET /api/admin/cache-stats — the REAL in-memory API cache telemetry
 * (Task 78). The cache-stats page used to invent "94.2% Cloudflare hit
 * ratio"; these are the numbers that actually happen in this server
 * process: per-counter totals, live entry counts, and the per-prefix
 * breakdown. Counters reset on server restart (stated on the page).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-cache-stats', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const snap = cacheSnapshot()
    const total = snap.counters.freshHits + snap.counters.staleServed + snap.counters.dbLoads
    return NextResponse.json({
      success: true,
      data: {
        ...snap,
        hitRatio: total > 0
          ? Math.round(((snap.counters.freshHits + snap.counters.staleServed) / total) * 1000) / 10
          : null,
        note: 'In-memory cache for this server process. Counters reset on restart; invalidations fire on every write that changes a cached surface (Task 68).',
      },
    })
  } catch (error) {
    console.error('Admin cache-stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
