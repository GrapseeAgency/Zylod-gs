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
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const whereClause: any = {
      order: {
        OR: [{ buyerId: userId }, { subOrders: { some: { supplierId: userId } } }],
      },
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    const paymentsList = await db.payments.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: paymentsList.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        amount: p.amount,
        method: p.method,
        status: p.status,
        transactionId: p.transactionId || `PAY-${p.id.slice(-8).toUpperCase()}`,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        orderTotal: p.order.totalAmount,
        orderStatus: p.order.paymentStatus,
      })),
    })
  } catch (error) {
    console.error('Payment history error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
