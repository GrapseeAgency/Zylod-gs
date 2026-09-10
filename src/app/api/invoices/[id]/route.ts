import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { id } = await params
    const userId = auth.user.id

    const order = await db.orders.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
        AND: {
          OR: [{ buyerId: userId }, { subOrders: { some: { supplierId: userId } } }],
        },
      },
      include: {
        buyer: {
          select: {
            email: true,
            phone: true,
            buyerProfile: true,
          },
        },
        shippingAddress: true,
        payments: true,
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
    })

    if (!order) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const allItems = order.subOrders.flatMap((so) => so.items)
    const subtotal = order.subOrders.reduce((acc, so) => acc + so.subtotal, 0)
    const shipping = order.subOrders.reduce((acc, so) => acc + (so.shippingCost || 0), 0)
    const vatAmount = subtotal * 0.05
    const grandTotal = order.totalAmount || (subtotal + shipping + vatAmount)

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        invoiceNumber: `INV-${order.orderNumber}`,
        mushakNumber: `MUSHAK-6.3-${order.id.slice(-6).toUpperCase()}`,
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString(),
        buyer: {
          name: order.buyer?.buyerProfile?.businessName || order.buyer?.email || 'Verified Buyer',
          email: order.buyer?.email,
          phone: order.buyer?.phone || null,
          address: order.shippingAddress ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}` : 'Bangladesh',
          tin: 'N/A',
        },
        seller: {
          name: 'Zylod Verified Merchant',
          tin: 'TIN-8829104829',
          bin: 'BIN-002910384-0102',
          address: 'Tejgaon Industrial Area, Dhaka, Bangladesh',
        },
        items: allItems.map((it) => ({
          name: it.product.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: it.totalPrice,
          unit: it.product.unit || 'pcs',
        })),
        subtotal,
        vatRate: '5.0%',
        vatAmount,
        shippingCost: shipping,
        grandTotal,
        paymentStatus: order.paymentStatus || 'paid',
        paymentMethod: order.payments[0]?.method || 'Trade Escrow',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
