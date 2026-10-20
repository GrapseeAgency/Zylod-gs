import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/inspections — the admin oversight list for the inspection
 * rail (Task 91): every request (pending first, then by recency), the
 * order's buyer display name embedded, honest stats. 401-first, then
 * 'admin-inspections-list' 60/min. ?status filters by the REAL statuses
 * only (pending | scheduled | completed | failed).
 */

const QuerySchema = z.object({
  status: z.enum(['pending', 'scheduled', 'completed', 'failed']).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-inspections-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = QuerySchema.safeParse({ status: searchParams.get('status') || undefined })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const rows = await db.inspectionRequests.findMany({
      where: parsed.data.status ? { status: parsed.data.status } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        order: { select: { orderNumber: true, totalAmount: true } },
        buyer: { select: { buyerProfile: { select: { fullName: true } } } },
      },
    })

    const inspections = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      orderTotal: r.order?.totalAmount ?? null,
      buyerName: r.buyer?.buyerProfile?.fullName ?? null,
      inspectorType: r.inspectorType,
      status: r.status,
      reportUrl: r.reportUrl,
      scheduledAt: r.scheduledAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }))

    const [statsRows, byStatus] = await Promise.all([
      db.inspectionRequests.count(),
      db.inspectionRequests.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    const stats = {
      total: statsRows,
      ...Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    }

    return NextResponse.json({ success: true, data: { inspections, stats } })
  } catch (err) {
    console.error('GET /api/admin/inspections error:', err)
    return NextResponse.json({ error: 'Failed to load inspections' }, { status: 500 })
  }
}
