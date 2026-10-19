import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/payments — admin oversight list over the REAL manual payment
 * chain (Task 56-b): buyer submissions from POST /api/orders/[id]/
 * payment-submit, their seller/admin verify decisions, and webhook-recorded
 * gateway payments. ADMIN ONLY. Mirrors the /api/admin/rfqs list style.
 *
 * Real behavior (no fake data):
 * - Admin auth is checked FIRST (401 before any query work), then the rate
 *   limit ('admin-payments-list', 60/min).
 * - ?status filters by the REAL payments.status values only (pending |
 *   success | failed | refunded); anything else is a 400 with the verbatim
 *   Zod error. Absent/empty = no filter (the UI's "All" tab omits the param).
 * - ?page (≥1) and ?limit (1..100, default 20) paginate server-side; counts
 *   and pagination stay real — nothing is filtered client-side. Rows sort
 *   newest-first by id (payments has no createdAt column; cuid ids are
 *   time-ordered — same projection choice as /api/payments/history).
 * - Stats are real groupBy aggregates over the WHOLE table (all 4 statuses +
 *   total), independent of the current filter, so the strip always shows the
 *   platform-wide truth.
 * - Buyer privacy: displayName only, from buyerProfiles.fullName (users has
 *   no name column). A buyer without a profile shows null — never invented.
 * - Supplier names come through the order's subOrders → supplierProfiles
 *   companyName (the same display name already public on the marketplace).
 */

const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'refunded'] as const

const QuerySchema = z.object({
  status: z.enum(PAYMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-payments-list', 60, 60 * 1000)
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
    const [statusRows, totalRows, paymentsList] = await Promise.all([
      db.payments.groupBy({ by: ['status'], _count: { _all: true } }),
      db.payments.count({ where }),
      db.payments.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              paymentStatus: true,
              buyer: { select: { id: true, buyerProfile: { select: { fullName: true } } } },
              subOrders: { select: { supplierId: true } },
            },
          },
        },
      }),
    ])

    const stats: Record<string, number> = {
      pending: 0,
      success: 0,
      failed: 0,
      refunded: 0,
      total: 0,
    }
    for (const row of statusRows) {
      if (row.status in stats) stats[row.status] = row._count._all
      stats.total += row._count._all
    }

    // Supplier display names for the page's rows (distinct supplierIds first).
    const supplierIds = [...new Set(paymentsList.flatMap((p) => p.order.subOrders.map((so) => so.supplierId)))]
    const suppliers = supplierIds.length
      ? await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true },
        })
      : []
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.companyName]))

    const data = paymentsList.map((p) => {
      // The buyer-submitted brand / sender / note live in the submit JSON.
      let brand: string | null = null
      let submittedAt: string | null = null
      try {
        const g = p.gatewayResponse ? (JSON.parse(p.gatewayResponse) as { brand?: unknown; submittedAt?: unknown }) : null
        if (g && typeof g.brand === 'string' && g.brand.length > 0) brand = g.brand
        if (g && typeof g.submittedAt === 'string') submittedAt = g.submittedAt
      } catch {
        /* gatewayResponse written by another producer (webhook/admin note) */
      }
      const names = [...new Set(p.order.subOrders.map((so) => supplierMap.get(so.supplierId)).filter((n): n is string => !!n))]
      return {
        id: p.id,
        orderId: p.order.id,
        orderNumber: p.order.orderNumber,
        orderTotal: p.order.totalAmount,
        orderPaymentStatus: p.order.paymentStatus,
        method: p.method,
        brand,
        amount: p.amount,
        status: p.status,
        transactionId: p.transactionId,
        submittedAt,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        buyer: { displayName: p.order.buyer.buyerProfile?.fullName ?? null },
        suppliers: names,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      stats,
      pagination: { page, limit, total: totalRows, totalPages: Math.ceil(totalRows / limit) },
    })
  } catch (error) {
    console.error('Admin payments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
