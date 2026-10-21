import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/customers — REAL customer insights for the signed-in
 * supplier, derived ONLY from the supplier's own subOrders joined to their
 * parent orders' buyers.
 *
 * A buyer becomes "my customer" by ordering MY products: every non-cancelled,
 * non-returned subOrder contributes its (post-discount) subtotal as the
 * seller-earned amount. No demographics, retention curves or "loyalty
 * scores" are invented — the platform has no such tracking yet, so the
 * summary only aggregates what actually happened.
 *
 * Real subOrder statuses: pending | confirmed | packed | shipped |
 * delivered | cancelled | returned.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-customers', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const subOrders = await db.subOrders.findMany({
      where: {
        supplierId: profile.id,
        status: { notIn: ['cancelled', 'returned'] },
      },
      select: {
        id: true,
        subtotal: true,
        status: true,
        createdAt: true,
        order: {
          select: {
            buyer: {
              select: {
                id: true,
                email: true,
                buyerProfile: { select: { fullName: true, businessName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    type Agg = {
      buyerId: string
      email: string
      fullName: string
      businessName: string
      ordersCount: number
      totalSpent: number
      deliveredCount: number
      openCount: number
      firstOrderAt: Date
      lastOrderAt: Date
    }
    const byBuyer = new Map<string, Agg>()
    for (const so of subOrders) {
      const buyer = so.order.buyer
      if (!buyer) continue
      let agg = byBuyer.get(buyer.id)
      if (!agg) {
        const fresh: Agg = {
          buyerId: buyer.id,
          email: buyer.email ?? '',
          fullName: buyer.buyerProfile?.fullName ?? '',
          businessName: buyer.buyerProfile?.businessName ?? '',
          ordersCount: 0,
          totalSpent: 0,
          deliveredCount: 0,
          openCount: 0,
          firstOrderAt: so.createdAt,
          lastOrderAt: so.createdAt,
        }
        byBuyer.set(buyer.id, fresh)
        agg = fresh
      }
      agg.ordersCount += 1
      agg.totalSpent += so.subtotal
      if (so.status === 'delivered') agg.deliveredCount += 1
      else agg.openCount += 1
      if (so.createdAt < agg.firstOrderAt) agg.firstOrderAt = so.createdAt
      if (so.createdAt > agg.lastOrderAt) agg.lastOrderAt = so.createdAt
    }

    const customers = Array.from(byBuyer.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 100)
      .map((c) => ({
        buyerId: c.buyerId,
        displayName: c.businessName || c.fullName || c.email,
        email: c.email,
        ordersCount: c.ordersCount,
        totalSpent: Math.round(c.totalSpent * 100) / 100,
        deliveredCount: c.deliveredCount,
        openCount: c.openCount,
        repeat: c.ordersCount > 1,
        firstOrderAt: c.firstOrderAt.toISOString(),
        lastOrderAt: c.lastOrderAt.toISOString(),
      }))

    const totalCustomers = customers.length
    const repeatCustomers = customers.filter((c) => c.repeat).length
    const totalOrders = customers.reduce((s, c) => s + c.ordersCount, 0)
    const lifetimeValue = customers.reduce((s, c) => s + c.totalSpent, 0)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCustomers,
          repeatCustomers,
          // Honest averages from real rows — null only when there is nobody yet.
          avgOrdersPerCustomer: totalCustomers > 0 ? Math.round((totalOrders / totalCustomers) * 100) / 100 : null,
          lifetimeValue: Math.round(lifetimeValue * 100) / 100,
        },
        customers,
      },
    })
  } catch (error) {
    console.error('Supplier customers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
