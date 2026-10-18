import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/revenue — REAL revenue ledger for the signed-in supplier.
 *
 * Ledger rows = orderItems on my products, joined to their parent subOrder +
 * order for the REAL paymentStatus and fulfillment status. No commission,
 * delivery-deduction or payout-availability numbers are invented — the
 * platform has no real fee ledger yet, so those fields are null/omitted.
 * A supplier with no sales gets an honest empty ledger.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-revenue', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    // Real reversal statuses on subOrders: 'cancelled' | 'returned'
    const items = await db.orderItems.findMany({
      where: {
        product: { supplierId: profile.id },
        subOrder: { status: { notIn: ['cancelled', 'returned'] } },
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        subOrderId: true,
        subOrder: {
          select: {
            createdAt: true,
            status: true,
            order: { select: { id: true, orderNumber: true, paymentStatus: true } },
          },
        },
        product: { select: { name: true } },
      },
      orderBy: { subOrder: { createdAt: 'desc' as const } },
      take: 500,
    })

    // Group by day — real daily gross from recorded order lines.
    const byDay = new Map<string, number>()
    let gross = 0
    let recognized = 0
    const ledger = items.map((item) => {
      const created = item.subOrder.createdAt
      const day = new Date(created.getFullYear(), created.getMonth(), created.getDate()).toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) || 0) + item.totalPrice)
      gross += item.totalPrice
      // "Recognized" = payment actually received (real paymentStatus on the order)
      const isPaid = item.subOrder.order.paymentStatus === 'paid'
      if (isPaid) recognized += item.totalPrice
      return {
        id: item.id,
        orderNumber: item.subOrder.order.orderNumber,
        paymentStatus: item.subOrder.order.paymentStatus,
        fulfillmentStatus: item.subOrder.status,
        date: created.toISOString(),
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gross: item.totalPrice,
        // No real platform-fee ledger exists yet — honest nulls.
        commission: null,
        net: null,
      }
    })

    const dailySeries = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, gross: Math.round(amount * 100) / 100 }))

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          gross: Math.round(gross * 100) / 100,
          recognized: Math.round(recognized * 100) / 100,
          // No real fee/payout sources — null, never fabricated numbers.
          commissionFees: null,
          deliveryDeductions: null,
          netRevenue: null,
          availableForPayout: null,
        },
        dailySeries,
        ledger,
      },
    })
  } catch (error) {
    console.error('Supplier revenue GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
