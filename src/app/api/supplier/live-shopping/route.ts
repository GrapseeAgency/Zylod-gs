import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/supplier/live-shopping (Task 145)
 * The SESSION supplier's own broadcasts — the data behind the Live Studio
 * console. Everything here is the store's real state: isLive, viewerCount,
 * scheduledAt, endedAt, and the featured products resolved to real rows.
 * No cross-store leakage: the scope is the resolved supplierProfile id (the
 * Task 142 id-space rule — streams are keyed by the PROFILE id).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'supplier-live-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(
        { error: 'A seller profile is required to manage broadcasts', code: 'SUPPLIER_PROFILE_REQUIRED' },
        { status: 403 }
      )
    }

    const streams = await db.liveStreams.findMany({
      where: { supplierId: profile.id },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    })

    // Resolve featured product ids to real rows for the console's chips.
    const allIds = streams
      .flatMap((s) => (s.featuredProductIds ? s.featuredProductIds.split(',').map((x) => x.trim()) : []))
      .filter(Boolean)
    const products =
      allIds.length > 0
        ? await db.products.findMany({
            where: { id: { in: allIds } },
            select: { id: true, name: true, basePrice: true, thumbnailUrl: true, isActive: true, isApproved: true },
          })
        : []
    const productMap = new Map(products.map((p) => [p.id, p]))

    return NextResponse.json({
      success: true,
      data: {
        streams: streams.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          streamUrl: s.streamUrl,
          isLive: s.isLive,
          viewerCount: s.viewerCount,
          scheduledAt: s.scheduledAt,
          endedAt: s.endedAt,
          featuredProducts: (s.featuredProductIds ? s.featuredProductIds.split(',').map((x) => x.trim()) : [])
            .filter(Boolean)
            .map((id) => productMap.get(id))
            .filter(Boolean),
        })),
      },
    })
  } catch (error) {
    console.error('Supplier live-shopping GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
