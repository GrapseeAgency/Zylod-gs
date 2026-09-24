import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

type OrderWithIncludes = Prisma.ordersGetPayload<{
  include: {
    buyer: { select: { id: true; email: true; userType: true; supplierProfile: { select: { companyName: true } }; buyerProfile: { select: { fullName: true } } } }
    payments: { orderBy: { paidAt: 'desc' } }
    subOrders: { select: { id: true; status: true; supplierId: true } }
  }
}>

/**
 * GET /api/admin/orders — admin-only order list for operations queues.
 * Query: paymentStatus (unpaid|partial|paid|refunded|all, default 'unpaid'),
 *        q (search orderNumber / buyer email), page, limit (max 50).
 * Used by the admin payment-verification queue: lists real orders with real
 * payment rows so an admin can verify bank/mobile transfers against reality.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const paymentStatus = (searchParams.get('paymentStatus') || 'unpaid').toLowerCase()
    const q = (searchParams.get('q') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

    const where: Prisma.ordersWhereInput = {}
    if (['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) {
      where.paymentStatus = paymentStatus
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
          subOrders: { select: { id: true, status: true, supplierId: true } },
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
