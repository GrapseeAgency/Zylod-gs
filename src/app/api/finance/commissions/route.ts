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

    const subOrders = await db.subOrders.findMany({
      where: { supplierId: userId },
      include: {
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const commissionItems = subOrders.map((so) => {
      const gmv = so.subtotal + (so.shippingCost || 0)
      const rate = 0.03
      const commissionFee = gmv * rate
      const netPayout = gmv - commissionFee
      return {
        id: so.id,
        orderNumber: so.order.orderNumber,
        subOrderNumber: so.id.slice(-6).toUpperCase(),
        grossAmount: gmv,
        ratePercent: '3.0%',
        commissionAmount: commissionFee,
        netPayout,
        status: so.status === 'delivered' ? 'settled' : 'in_escrow',
        date: so.createdAt.toISOString(),
      }
    })

    const totalGross = commissionItems.reduce((acc, curr) => acc + curr.grossAmount, 0)
    const totalCommissions = commissionItems.reduce((acc, curr) => acc + curr.commissionAmount, 0)

    return NextResponse.json({
      success: true,
      data: {
        totalGross,
        totalCommissions,
        items: commissionItems,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
