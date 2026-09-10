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
      OR: [{ buyerId: userId }, { subOrders: { some: { supplierId: userId } } }],
    }

    if (status && status !== 'all') {
      whereClause.paymentStatus = status
    }

    const orders = await db.orders.findMany({
      where: whereClause,
      include: {
        buyer: {
          select: { email: true, phone: true, buyerProfile: true },
        },
        subOrders: {
          include: {
            items: {
              include: {
                product: { select: { name: true, unit: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })

    const invoices = orders.map((o) => {
      const allItems = o.subOrders.flatMap((so) => so.items)
      const subtotal = o.subOrders.reduce((acc, so) => acc + so.subtotal, 0)
      const shipping = o.subOrders.reduce((acc, so) => acc + (so.shippingCost || 0), 0)
      const vatAmount = subtotal * 0.05
      const grandTotal = o.totalAmount || (subtotal + shipping + vatAmount)
      const invoiceNumber = `INV-${o.orderNumber}`
      const mushakNumber = `MUSHAK-6.3-${o.id.slice(-6).toUpperCase()}`

      return {
        id: o.id,
        invoiceNumber,
        mushakNumber,
        orderNumber: o.orderNumber,
        date: o.createdAt.toISOString(),
        dueDate: new Date(o.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subtotal,
        vatAmount,
        shipping,
        grandTotal,
        paymentStatus: o.paymentStatus || 'paid',
        buyerName: o.buyer.buyerProfile?.businessName || o.buyer.email || 'Verified Buyer',
        itemsCount: allItems.length,
      }
    })

    return NextResponse.json({
      success: true,
      data: invoices,
    })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
