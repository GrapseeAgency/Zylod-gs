import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/payouts — REAL sellerPayouts rows for the signed-in
 * supplier. There is intentionally NO POST here: creating a payout is a
 * finance/admin action, and the previous fake POST that echoed the request
 * body back as "success" was removed. No payouts yet → honest empty state.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-payouts', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const payouts = await db.sellerPayouts.findMany({
      where: { supplierId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Real summary derived ONLY from the rows above — zeros when empty.
    const completed = payouts.filter((p) => p.status === 'completed')
    const pending = payouts.filter((p) => p.status === 'pending' || p.status === 'processing')
    const totalPaid = completed.reduce((sum, p) => sum + p.amount, 0)
    const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalPaid: Math.round(totalPaid * 100) / 100,
          pendingAmount: Math.round(pendingAmount * 100) / 100,
          completedCount: completed.length,
          pendingCount: pending.length,
        },
        payouts: payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          status: p.status,
          reference: p.reference,
          fee: p.fee,
          processedAt: p.processedAt,
          createdAt: p.createdAt,
        })),
      },
    })
  } catch (error) {
    console.error('Supplier payouts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
