import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/rfqs — admin oversight list over the real RFQ chain
 * (rfqRequests + rfqItems + rfqQuotes). ADMIN ONLY.
 *
 * Real behavior (no fake data):
 * - Admin auth is checked FIRST (401 before any query work), then the rate
 *   limit ('admin-rfqs', 60/min).
 * - ?status filters by the REAL rfqRequests.status values only
 *   (open | quoted | awarded | closed | expired — prisma/schema.prisma);
 *   anything else is a 400 with the verbatim Zod error. Absent/empty = no
 *   filter (the UI's "All" tab simply omits the param).
 * - ?page (≥1) and ?limit (1..50, default 20) paginate server-side; counts
 *   and pagination stay real — nothing is filtered client-side.
 * - Stats are real groupBy aggregates over the WHOLE table (all 5 statuses +
 *   total), independent of the current filter, so the strip always shows the
 *   platform-wide truth.
 * - Buyer privacy: displayName only, from buyerProfiles.fullName (users has
 *   no name column). A buyer without a profile shows null — never invented.
 * - Supplier identities are NOT on the list rows (quotes carry price/status
 *   only for the real min/max range); names come from the detail route.
 */

const RFQ_STATUSES = ['open', 'quoted', 'awarded', 'closed', 'expired'] as const

const QuerySchema = z.object({
  status: z.enum(RFQ_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-rfqs', 60, 60 * 1000)
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

    // Parallel: whole-table stats (groupBy + count) and the filtered page rows.
    const [statusRows, totalRows, rfqs] = await Promise.all([
      db.rfqRequests.groupBy({ by: ['status'], _count: { _all: true } }),
      db.rfqRequests.count({ where }),
      db.rfqRequests.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          buyer: { select: { id: true, buyerProfile: { select: { fullName: true } } } },
          // Price/status metadata only — enough for the real min/max range;
          // supplier identities come from the detail endpoint, not the list.
          quotes: { select: { pricePerUnit: true, totalPrice: true, status: true, createdAt: true } },
          _count: { select: { items: true, quotes: true } },
        },
      }),
    ])

    const stats: Record<string, number> = {
      open: 0,
      quoted: 0,
      awarded: 0,
      closed: 0,
      expired: 0,
      total: 0,
    }
    for (const row of statusRows) {
      if (row.status in stats) stats[row.status] = row._count._all
      stats.total += row._count._all
    }

    const data = rfqs.map((r) => {
      const totals = r.quotes.map((q) => q.totalPrice)
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        quantity: r.quantity,
        unit: r.unit,
        targetPrice: r.targetPrice,
        deliveryCity: r.deliveryCity,
        deadline: r.deadline,
        createdAt: r.createdAt,
        buyer: { displayName: r.buyer.buyerProfile?.fullName ?? null },
        itemCount: r._count.items,
        quoteCount: r._count.quotes,
        bestQuote: totals.length
          ? { min: Math.min(...totals), max: Math.max(...totals) }
          : { min: null, max: null },
      }
    })

    return NextResponse.json({
      success: true,
      data,
      stats,
      pagination: { page, limit, total: totalRows, totalPages: Math.ceil(totalRows / limit) },
    })
  } catch (error) {
    console.error('Admin RFQs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
