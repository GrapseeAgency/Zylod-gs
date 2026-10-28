import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/coupons/[id] — one coupon's public detail view (coupon terms page).
 * Task 143 scoping, same doctrine as GET /api/coupons: personal vouchers are
 * PRIVATE money promises — a row with a userId set is served ONLY to that
 * buyer. Anonymous callers see public rows only. A private row and a phantom
 * id are the SAME 404, so existence of another buyer's voucher never leaks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(request, 'coupons-detail', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const coupon = await db.coupons.findUnique({
      where: { id },
    })

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    // Private (userId-bound) voucher — owner only, no-leak 404 otherwise.
    if (coupon.userId) {
      const session = await authenticateRequest(request)
      if (!session.authenticated || !session.user || session.user.id !== coupon.userId) {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ success: true, data: coupon })
  } catch (error) {
    console.error('Coupon GET [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
