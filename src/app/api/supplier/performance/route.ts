import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/performance — REAL derived metrics from the supplier's
 * subOrders only. Funnel metrics (impressions/clicks/cart-adds), views,
 * conversion and return-rates have NO real tracking source, so they are null
 * and the UI shows "Not available yet" — never invented numbers.
 *
 * Real statuses on subOrders: pending | confirmed | packed | shipped |
 * delivered | cancelled | returned.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-performance', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const subOrders = await db.subOrders.findMany({
      where: { supplierId: profile.id },
      select: { id: true, status: true, createdAt: true },
    })

    const countBy = (status: string) => subOrders.filter((so) => so.status === status).length
    const ordersReceived = subOrders.length
    const ordersFulfilled = countBy('delivered')
    // Pending shipment = accepted but not yet handed to delivery.
    const pendingShipment = countBy('pending') + countBy('confirmed') + countBy('packed')
    const inTransit = countBy('shipped')
    const cancelled = countBy('cancelled')
    const returned = countBy('returned')
    const fulfillmentRate = ordersReceived > 0 ? Math.round((ordersFulfilled / ordersReceived) * 100) : 0

    return NextResponse.json({
      success: true,
      data: {
        orders: {
          ordersReceived,
          ordersFulfilled,
          pendingShipment,
          inTransit,
          cancelled,
          returned,
          fulfillmentRate,
        },
        // Not derivable from real data yet — honest nulls, UI renders
        // "Not available yet".
        funnel: {
          impressions: null,
          productClicks: null,
          inquiries: null,
          orders: ordersReceived,
        },
        leaderboard: [],
        alerts: [],
      },
    })
  } catch (error) {
    console.error('Supplier performance GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
