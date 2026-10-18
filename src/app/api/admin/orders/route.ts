import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

type OrderWithIncludes = Prisma.ordersGetPayload<{
  include: {
    buyer: { select: { id: true; email: true; userType: true; supplierProfile: { select: { companyName: true } }; buyerProfile: { select: { fullName: true } } } }
    payments: { orderBy: { paidAt: 'desc' } }
    subOrders: { select: { id: true; status: true; supplierId: true; _count: { select: { items: true } } } }
  }
}>

/**
 * REAL subOrder status values (prisma/schema.prisma → subOrders.status:
 * "pending | confirmed | packed | shipped | delivered | cancelled | returned").
 * `orders` itself has NO status column — fulfillment state lives per subOrder.
 */
const SUB_ORDER_STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'] as const

/**
 * GET /api/admin/orders — admin-only order list for operations queues.
 * Query: paymentStatus (unpaid|partial|paid|refunded|all, default 'unpaid'),
 *        status (pending|confirmed|packed|shipped|delivered|cancelled|returned|all —
 *        filters orders that have at least one subOrder in that REAL status),
 *        q (search orderNumber / buyer email), page, limit (1..100, default 20).
 * Used by the admin payment-verification queue (unchanged default behavior:
 * no paymentStatus param still means 'unpaid') AND by the fulfillment view
 * (?paymentStatus=all&status=…). Every order carries buyer display name from
 * buyerProfiles.fullName (users has NO name column), a real item count, and
 * its per-subOrder statuses so admins see fulfillment without opening SQL.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-orders-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const paymentStatus = (searchParams.get('paymentStatus') || 'unpaid').toLowerCase()
    const status = (searchParams.get('status') || 'all').toLowerCase()
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))

    const where: Prisma.ordersWhereInput = {}
    if (['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) {
      where.paymentStatus = paymentStatus
    }
    if ((SUB_ORDER_STATUSES as readonly string[]).includes(status)) {
      where.subOrders = { some: { status } }
    }
    if (q) {
      where.OR = [
        { orderNumber: { contains: q } },
        { buyer: { email: { contains: q } } },
      ]
    }

    const [total, orders] = await Promise.all([
      db.orders.count({ where }),
      db.orders.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          buyer: {
            select: {
              id: true,
              email: true,
              userType: true,
              supplierProfile: { select: { companyName: true } },
              buyerProfile: { select: { fullName: true } },
            },
          },
          payments: { orderBy: { paidAt: 'desc' } },
          subOrders: {
            select: {
              id: true,
              status: true,
              supplierId: true,
              _count: { select: { items: true } },
            },
          },
        },
      }) as Promise<OrderWithIncludes[]>,
    ])

    return NextResponse.json({
      success: true,
      data: {
        orders: orders.map((o) => {
          const buyerName =
            o.buyer?.buyerProfile?.fullName ||
            o.buyer?.supplierProfile?.companyName ||
            null
          const statuses = o.subOrders.map((s) => (s.status || 'pending').toLowerCase())
          const derivedStatus =
            statuses.length === 0
              ? 'processing'
              : statuses.every((s) => s === 'delivered')
                ? 'delivered'
                : statuses.some((s) => s === 'cancelled')
                  ? 'cancelled'
                  : statuses.some((s) => s === 'shipped')
                    ? 'shipped'
                    : 'processing'
          const itemCount = o.subOrders.reduce((sum, s) => sum + s._count.items, 0)
          return {
            id: o.id,
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount,
            paymentStatus: o.paymentStatus,
            status: derivedStatus,
            placedAt: o.placedAt.toISOString(),
            buyer: o.buyer
              ? { id: o.buyer.id, email: o.buyer.email, name: buyerName, userType: o.buyer.userType }
              : null,
            payments: o.payments.map((p) => ({
              id: p.id,
              method: p.method,
              amount: p.amount,
              status: p.status,
              transactionId: p.transactionId,
              paidAt: p.paidAt?.toISOString() || null,
            })),
            subOrderCount: o.subOrders.length,
            // ── Task 51-b additive fields (payments queue ignores these) ──
            itemCount,
            subOrders: o.subOrders.map((s) => ({
              id: s.id,
              status: s.status || 'pending',
              supplierId: s.supplierId,
              itemCount: s._count.items,
            })),
          }
        }),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
      },
    })
  } catch (error) {
    console.error('Admin orders list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
