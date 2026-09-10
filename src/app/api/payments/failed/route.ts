import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    const failed = await db.payments.findMany({
      where: {
        status: 'failed',
        order: {
          OR: [{ buyerId: userId }, { subOrders: { some: { supplierId: userId } } }],
        },
      },
      include: {
        order: {
          select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
        },
      },
      orderBy: { id: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: failed.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        amount: p.amount,
        method: p.method,
        reason: p.gatewayResponse || 'Payment authorization failed at bank gateway. Insufficient merchant limit or timeout.',
        date: p.order.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
