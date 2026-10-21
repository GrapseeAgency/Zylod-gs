import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/admin/topups — admin oversight list over the REAL wallet top-up
 * surface (Task 118). Covers BOTH legs of the doctrine:
 *
 *   - manual claims from POST /api/wallet/topup (status 'pending' until the
 *     admin decides at POST /api/admin/topups/[id]/verify), and
 *   - gateway sessions from POST /api/wallet/topup/initiate (pending until
 *     the verified callback/IPN credits them).
 *
 * Real behavior (no fake data):
 * - Admin auth FIRST (401 before any query work), then 'admin-topups-list'
 *   60/min.
 * - ?status filters by the REAL walletTopups.status values only (pending |
 *   credited | failed | cancelled | rejected); anything else is a 400 with
 *   the verbatim Zod error. Absent/empty = no filter.
 * - ?page (≥1), ?limit (1..100, default 20) — server-side pagination.
 * - Rows sort pending-first, then newest-first by createdAt (explicit rank
 *   partition — the DB sort cannot express it directly).
 * - Stats are real groupBy aggregates over the WHOLE table (+ a real _sum of
 *   the pending amount), independent of the current filter.
 * - Claimant privacy: displayName only (buyerProfiles.fullName →
 *   buyerProfiles.businessName → supplierProfiles.companyName); email shown
 *   to admins (finance needs a contact) — the same tradeoff the admin
 *   payments list makes with order data.
 * - claimDetails JSON (method/senderNumber/note/submittedAt/verification) is
 *   parsed defensively — rows written by other producers never 500 the list.
 */

const TOPUP_STATUSES = ['pending', 'credited', 'failed', 'cancelled', 'rejected'] as const

const QuerySchema = z.object({
  status: z.enum(TOPUP_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-topups-list', 60, 60 * 1000)
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

    const [statusRows, pendingSum, totalRows, topups] = await Promise.all([
      db.walletTopups.groupBy({ by: ['status'], _count: { _all: true } }),
      db.walletTopups.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
      db.walletTopups.count({ where }),
      db.walletTopups.findMany({
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

    const stats: Record<string, number> = {
      pending: 0,
      credited: 0,
      failed: 0,
      cancelled: 0,
      rejected: 0,
      total: 0,
    }
    for (const row of statusRows) {
      if (row.status in stats) stats[row.status] = row._count._all
      stats.total += row._count._all
    }

    const data = topups.map((t) => {
      let method: string | null = null
      let senderNumber: string | null = null
      let note: string | null = null
      let submittedAt: string | null = null
      let verification: Record<string, unknown> | null = null
      try {
        const c = (t.claimDetails ?? null) as Record<string, unknown> | null
        if (c && typeof c === 'object' && !Array.isArray(c)) {
          if (typeof c.method === 'string') method = c.method
          if (typeof c.senderNumber === 'string') senderNumber = c.senderNumber
          if (typeof c.note === 'string') note = c.note
          if (typeof c.submittedAt === 'string') submittedAt = c.submittedAt
          if (c.verification && typeof c.verification === 'object' && !Array.isArray(c.verification)) {
            verification = c.verification as Record<string, unknown>
          }
        }
      } catch {
        /* claimDetails written by another producer — never 500 the list */
      }
      const displayName = t.user.buyerProfile?.fullName ?? t.user.buyerProfile?.businessName ?? t.user.supplierProfile?.companyName ?? null
      return {
        id: t.id,
        userId: t.user.id,
        claimant: { displayName, email: t.user.email },
        provider: t.provider,
        method: method ?? t.provider,
        senderNumber,
        note,
        reference: t.reference,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        sessionId: t.sessionId,
        gatewayTrxId: t.gatewayTrxId,
        submittedAt,
        creditedAt: t.creditedAt ? t.creditedAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
        verification,
        source: t.sessionId ? 'gateway' : 'manual',
      }
    })

    // pending-first for real: explicit rank partition on the page's rows.
    data.sort((a, b) => {
      const rank = (s: string) => (s === 'pending' ? 0 : 1)
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
    console.error('Admin topups GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
