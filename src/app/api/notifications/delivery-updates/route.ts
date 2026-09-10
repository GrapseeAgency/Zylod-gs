import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/delivery-updates
 * Delivery notifications enriched with order tracking info.
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
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: auth.user.id, type: 'delivery' }
    if (unreadOnly) where.isRead = false

    const [notifications, total] = await Promise.all([
      db.notifications.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.notifications.count({ where }),
    ])

    const relatedIds = notifications.map(n => n.relatedEntityId).filter((id): id is string => !!id)

    const subOrders = relatedIds.length > 0
      ? await db.subOrders.findMany({
          where: { id: { in: relatedIds } },
          include: {
            order: { select: { id: true, orderNumber: true } },
          },
        })
      : []

    const subOrderMap = new Map(subOrders.map(s => [s.id, s]))

    const data = notifications.map(n => {
      const sub = n.relatedEntityId ? subOrderMap.get(n.relatedEntityId) : null
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.body,
        timestamp: n.createdAt.toISOString(),
        isRead: n.isRead,
        relatedId: n.relatedEntityId,
        order: sub ? {
          orderId: sub.orderId,
          subOrderId: sub.id,
          orderNumber: sub.order?.orderNumber ?? null,
          status: sub.status,
          trackingNumber: sub.trackingNumber,
          carrier: 'Steadfast Courier',
          estimatedDelivery: sub.estimatedDelivery?.toISOString() ?? null,
        } : null,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Delivery updates GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
