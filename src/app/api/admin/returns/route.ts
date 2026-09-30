import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeAdminReturn } from '@/lib/admin-returns'

/**
 * GET /api/admin/returns — admin review queue for buyer return requests.
 *
 * Real behavior (no fake data):
 * - Auth is checked FIRST (401 before any query work).
 * - Rows come newest-first from the real returnRequests table, with the
 *   real per-item reasons/quantities and manually joined order + buyer info
 *   (plain string FKs — no Prisma relations on this model).
 * - Buyers are joined from users (id + email ONLY — never password or other
 *   private fields) + buyerProfiles.fullName for the display name; missing
 *   values stay honestly null.
 * - Counts per status are real groupBy/count aggregates on the same table.
 */

const QuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'refunded', 'all']).default('all'),
  take: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-returns-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = QuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { status, take } = parsed.data

    const where = status === 'all' ? {} : { status }
    const returns = await db.returnRequests.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })

    // Items live in a separate table (plain string FK, no Prisma relation).
    const returnIds = returns.map((r) => r.id)
    const allItems = returnIds.length
      ? await db.returnRequestItems.findMany({ where: { returnRequestId: { in: returnIds } } })
      : []
    const itemsByReturn = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const list = itemsByReturn.get(item.returnRequestId) ?? []
      list.push(item)
      itemsByReturn.set(item.returnRequestId, list)
    }

    // Real order context (orderNumber / paymentStatus / subOrder statuses).
    const orderIds = [...new Set(returns.map((r) => r.orderId))]
    const orders = orderIds.length
      ? await db.orders.findMany({
          where: { id: { in: orderIds } },
          select: {
            id: true,
            orderNumber: true,
            paymentStatus: true,
            subOrders: { select: { status: true } },
          },
        })
      : []
    const orderById = new Map(orders.map((o) => [o.id, o]))

    // Buyer context: only safe public fields (id, email, profile full name).
    // users has NO name column — the display name comes from buyerProfiles.
    const buyerIds = [...new Set(returns.map((r) => r.buyerId))]
    const buyers = buyerIds.length
      ? await db.users.findMany({
          where: { id: { in: buyerIds } },
          select: {
            id: true,
            email: true,
            buyerProfile: { select: { fullName: true } },
          },
        })
      : []
    const buyerById = new Map(
      buyers.map((u) => [
        u.id,
        { id: u.id, email: u.email, fullName: u.buyerProfile?.fullName ?? null },
      ])
    )

    // Real per-status counts (groupBy) + total (count).
    const [statusRows, total] = await Promise.all([
      db.returnRequests.groupBy({ by: ['status'], _count: { _all: true } }),
      db.returnRequests.count(),
    ])
    const counts: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
      refunded: 0,
    }
    for (const row of statusRows) counts[row.status] = row._count._all

    return NextResponse.json({
      success: true,
      data: {
        returns: returns.map((r) =>
          serializeAdminReturn(
            r,
            itemsByReturn.get(r.id) ?? [],
            orderById.get(r.orderId) ?? null,
            buyerById.get(r.buyerId) ?? null
          )
        ),
        counts: { ...counts, total },
        dataNotes: [
          'Order status is derived from sub-order statuses (orders has no status column) using the same derivation as /api/admin/orders.',
          'Buyer name comes from the buyer profile (users table has no name column); a missing profile or email is shown as null.',
          'A "refunded" decision cannot be made from this queue — no real refund rail exists in the codebase yet.',
        ],
      },
    })
  } catch (error) {
    console.error('Admin returns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
