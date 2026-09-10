import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/order-updates
 * Order notifications enriched with order data.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const statusFilter = searchParams.get('status') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: auth.user.id, type: 'order' }

    const [notifications, total] = await Promise.all([
      db.notifications.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.notifications.count({ where }),
    ])

    const orderIds = notifications.map(n => n.relatedEntityId).filter((id): id is string => !!id)

    const orders = orderIds.length > 0
      ? await db.orders.findMany({
          where: { id: { in: orderIds } },
          include: {
            subOrders: {
              select: { status: true, supplierId: true },
              take: 1,
            },
          },
        })
      : []

    const ordersMap = new Map(orders.map(o => [o.id, o]))

    const data = notifications
      .map(n => {
        const order = n.relatedEntityId ? ordersMap.get(n.relatedEntityId) : null
        const orderStatus = order?.subOrders?.[0]?.status ?? null
        if (statusFilter && orderStatus !== statusFilter) return null
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.body,
          timestamp: n.createdAt.toISOString(),
          isRead: n.isRead,
          relatedId: n.relatedEntityId,
          order: order ? {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: orderStatus,
            totalAmount: order.totalAmount,
            supplierName: 'Verified Merchant',
            placedAt: order.placedAt?.toISOString() ?? null,
          } : null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Order updates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
