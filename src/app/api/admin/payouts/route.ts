import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { shapeAdminPayout } from '@/lib/payouts'

/**
 * Task 107: THE PAYOUT QUEUE (admin side). Withdrawal requests land here
 * as pending sellerPayouts rows (POST /api/wallet/withdraw creates them and
 * holds the amount against double-requesting). The wallet is untouched
 * until THIS console decides: completing debits the wallet for real and
 * stamps the transfer reference; rejecting frees the hold without moving
 * money. House contract: requireUserType 401-first, rate limit, real
 * groupBy stats, audits + admin-room taps on decisions.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-payouts-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const VALID = ['pending', 'processing', 'completed', 'failed']
    if (status && !VALID.includes(status)) {
      return NextResponse.json({ error: `Unknown status filter "${status}". Allowed: ${VALID.join(', ')}` }, { status: 400 })
    }

    const [rows, groupBy] = await Promise.all([
      db.sellerPayouts.findMany({
        where: status ? { status } : undefined,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: { supplier: { select: { companyName: true } } },
      }),
      db.sellerPayouts.groupBy({ by: ['status'], _count: { status: true }, _sum: { amount: true } }),
    ])

    const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, pendingAmount: 0, completedAmount: 0 }
    for (const g of groupBy) {
      stats.total += g._count.status
      if (g.status === 'pending' || g.status === 'processing') stats.pendingAmount += g._sum.amount ?? 0
      if (g.status === 'completed') stats.completedAmount += g._sum.amount ?? 0
      if (g.status in stats) stats[g.status as 'pending' | 'processing' | 'completed' | 'failed'] += g._count.status
    }

    return NextResponse.json({ success: true, data: rows.map((r) => shapeAdminPayout(r, r.supplier.companyName)), stats })
  } catch (error) {
    console.error('Admin payouts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
