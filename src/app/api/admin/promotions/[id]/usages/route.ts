import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/promotions/[id]/usages — the drill-down under the admin
 * promotion console (Task 103). Every applied-discount event for THIS
 * campaign, read from the REAL promotion_applied audit rows written by the
 * pricing engine at order time (entityType 'orders', entityId = orderNumber,
 * metadata carries promotionId + the numbers — the ONE shape the engine
 * writes; no invented second shape). No buyer PII: orderNumber + the
 * pricing numbers is all an admin needs for analytics. No-leak 404 for a
 * phantom id.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-promotion-usages', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const exists = await db.promotions.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // SQLite cannot query into the metadata JSON — read the engine's audit
    // rows (bounded, newest first) and filter on the promotionId field.
    const audits = await db.auditLogs.findMany({
      where: { action: 'promotion_applied', entityType: 'orders' },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const usages = audits
      .map((a) => {
        let meta: Record<string, unknown> = {}
        try { meta = JSON.parse(a.metadata ?? '{}') } catch {}
        return {
          id: a.id,
          orderNumber: a.entityId,
          promotionId: typeof meta.promotionId === 'string' ? meta.promotionId : null,
          type: typeof meta.type === 'string' ? meta.type : null,
          value: typeof meta.value === 'number' ? meta.value : null,
          promotedSubtotal: typeof meta.promotedSubtotal === 'number' ? meta.promotedSubtotal : null,
          discount: typeof meta.discount === 'number' ? meta.discount : null,
          at: a.createdAt.toISOString(),
        }
      })
      .filter((u) => u.promotionId === id)

    const totals = usages.reduce(
      (acc, u) => {
        acc.count += 1
        if (typeof u.discount === 'number') acc.totalDiscount += u.discount
        return acc
      },
      { count: 0, totalDiscount: 0 }
    )

    return NextResponse.json({ success: true, data: usages, totals })
  } catch (error) {
    console.error('Admin promotion usages GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
