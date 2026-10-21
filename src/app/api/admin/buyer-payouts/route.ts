import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { shapeAdminBuyerPayout } from '@/lib/payouts'

/**
 * GET /api/admin/buyer-payouts — admin oversight list over the BUYER
 * withdrawal rail (Task 119). The buyer-side twin of /api/admin/payouts
 * (which stays the seller rail). Same doctrine: a pending buyerPayouts row
 * is a HOLD, not a debit; only the PATCH decision at
 * /api/admin/buyer-payouts/[id] moves or frees money.
 *
 * - Admin auth FIRST (401), then 'admin-buyer-payouts-list' 60/min.
 * - ?status filters by the REAL buyerPayouts.status values only (pending |
 *   processing | completed | failed); anything else → 400 verbatim Zod.
 * - ?page (≥1), ?limit (1..100, default 20) — server-side pagination.
 * - Rows sort pending-first, then newest-first (explicit rank partition).
 * - Stats: real groupBy over the WHOLE table + real pendingAmount _sum.
 * - Claimant privacy: displayName (fullName → businessName → companyName)
 *   + email (finance needs a contact — the same tradeoff as topups).
 */

const PAYOUT_STATUSES = ['pending', 'processing', 'completed', 'failed'] as const

const QuerySchema = z.object({
  status: z.enum(PAYOUT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-buyer-payouts-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const rawStatus = searchParams.get('status')
    const parsed = QuerySchema.safeParse({
      status: rawStatus === null || rawStatus === '' ? undefined : rawStatus,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid query parameters', issues: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const status = parsed.data.status
    const page = parsed.data.page ?? 1
    const limit = parsed.data.limit ?? 20
    const skip = (page - 1) * limit

    const where = status ? { status } : {}

    const [statusRows, pendingSum, totalRows, payouts] = await Promise.all([
      db.buyerPayouts.groupBy({ by: ['status'], _count: { _all: true } }),
      db.buyerPayouts.aggregate({ where: { status: { in: ['pending', 'processing'] } }, _sum: { amount: true } }),
      db.buyerPayouts.count({ where }),
      db.buyerPayouts.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              buyerProfile: { select: { fullName: true, businessName: true } },
              supplierProfile: { select: { companyName: true } },
            },
          },
        },
      }),
    ])

    const stats: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 }
    for (const row of statusRows) {
      if (row.status in stats) stats[row.status] = row._count._all
      stats.total += row._count._all
    }

    const data = payouts.map((p) => {
      const displayName =
        p.user.buyerProfile?.fullName ?? p.user.buyerProfile?.businessName ?? p.user.supplierProfile?.companyName ?? null
      return shapeAdminBuyerPayout(p, { displayName, email: p.user.email })
    })

    // pending-first for real: explicit rank partition on the page's rows.
    data.sort((a, b) => {
      const rank = (s: string) => (s === 'pending' || s === 'processing' ? 0 : 1)
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
      return b.createdAt.localeCompare(a.createdAt)
    })

    return NextResponse.json({
      success: true,
      data,
      stats: { ...stats, pendingAmount: pendingSum._sum.amount ?? 0 },
      pagination: { page, limit, total: totalRows, totalPages: Math.ceil(totalRows / limit) },
    })
  } catch (error) {
    console.error('Admin buyer payouts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
