import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/supplier/live-streams (Task 165) — the host's OWN broadcast
 * console feed. Task 142 built the schedule (POST /api/live-shopping) and
 * the broadcast control (PATCH /api/live-shopping/[id]) but NO seller
 * surface could see their own streams: creation was API-side only, and the
 * public list mixes every store together. This is the seller-scoped rail:
 * only THIS store's sessions, honest state counters, featured products
 * resolved from the real catalog.
 *
 * 401-first (supplier/admin only) → rate limited → profile-scoped 403.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'supplier-live-streams', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(
        { error: 'Supplier profile required — only a store has a broadcast console', code: 'SUPPLIER_PROFILE_REQUIRED' },
        { status: 403 }
      )
    }

    const streams = await db.liveStreams.findMany({
      where: { supplierId: profile.id },
      orderBy: [{ isLive: 'desc' }, { scheduledAt: 'desc' }],
      take: 50,
    })

    // Resolve the real featured products for every stream in one query —
    // the console renders what the broadcast actually features, never a guess.
    const allFeaturedIds = [
      ...new Set(
        streams
          .flatMap(s => (s.featuredProductIds ? s.featuredProductIds.split(',') : []))
          .map(id => id.trim())
          .filter(Boolean)
      ),
    ]
    const featuredRows = allFeaturedIds.length
      ? await db.products.findMany({
          where: { id: { in: allFeaturedIds }, supplierId: profile.id },
          select: { id: true, name: true, basePrice: true, thumbnailUrl: true, isActive: true },
        })
      : []
    const featuredMap = new Map(featuredRows.map(p => [p.id, p]))

    const data = streams.map(s => {
      const ids = s.featuredProductIds
        ? s.featuredProductIds.split(',').map(id => id.trim()).filter(Boolean)
        : []
      const featured = ids
        .map(id => featuredMap.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        isLive: s.isLive,
        viewerCount: s.viewerCount,
        scheduledAt: s.scheduledAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        streamUrl: s.streamUrl,
        thumbnailUrl: s.thumbnailUrl,
        createdAt: s.createdAt.toISOString(),
        featuredProducts: featured,
      }
    })

    // Honest counters from the REAL rows — nothing estimated.
    const stats = {
      liveNow: streams.filter(s => s.isLive).length,
      scheduled: streams.filter(s => !s.isLive && !s.endedAt).length,
      ended: streams.filter(s => !s.isLive && s.endedAt).length,
    }

    return NextResponse.json({ success: true, data: { stats, streams: data } })
  } catch (error) {
    console.error('Supplier live-streams GET error:', error)
    return NextResponse.json({ error: 'Failed to load your broadcasts' }, { status: 500 })
  }
}
