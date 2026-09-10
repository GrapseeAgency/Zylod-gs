import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const VAT_RATE = 0.15

/**
 * GET /api/orders/[id]/invoices
 * Returns the current invoice + invoice history (all of the buyer's past orders)
 * for the authenticated user. Requires auth; the caller must be the buyer,
 * a supplier on the order, or admin.
 */
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

    const order = await db.orders.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            buyerProfile: { select: { fullName: true, businessName: true } },
          },
        },
        shippingAddress: true,
        subOrders: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: 'asc' } },
                    supplier: { select: { id: true, companyName: true } },
                  },
                },
                variant: true,
              },
            },
          },
        },
        payments: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Authorization
    const isBuyer = order.buyerId === auth.user.id
    const isAdmin = auth.user.userType === 'admin'
    if (!isBuyer && !isAdmin) {
      const supplierOnOrder = order.subOrders.some((so) =>
        so.items.some((it) => it.product.supplierId === auth.user!.id)
      )
      if (!supplierOnOrder) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
    }

    const invoiceItems = order.subOrders.flatMap((so) =>
      so.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        sku: item.product.sku || `WBD-${item.id.slice(-3).toUpperCase()}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
      }))
    )

    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
    const shipping = order.subOrders.reduce((sum, so) => sum + (so.shippingCost || 0), 0)
    const tax = subtotal * VAT_RATE

    const currentInvoice = {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      invoiceDate: order.placedAt,
      dueDate: new Date(new Date(order.placedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      billTo: {
        name: order.buyer.buyerProfile?.businessName || order.buyer.buyerProfile?.fullName || 'N/A',
        address: order.shippingAddress ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}` : 'N/A',
        city: order.shippingAddress?.city || 'N/A',
        country: order.shippingAddress?.country || 'Bangladesh',
      },
      shipTo: order.shippingAddress
        ? {
            name: order.buyer.buyerProfile?.businessName || order.buyer.buyerProfile?.fullName || 'N/A',
            address: order.shippingAddress.addressLine1,
            city: order.shippingAddress.city,
            country: order.shippingAddress.country,
          }
        : null,
      items: invoiceItems,
      subtotal,
      tax,
      shipping,
      total: order.totalAmount,
      currency: 'BDT',
      status: order.paymentStatus,
    }

    // Real invoice history: all of this buyer's past orders.
    const historyOrders = await db.orders.findMany({
      where: { buyerId: order.buyerId },
      orderBy: { placedAt: 'desc' },
      take: 20,
      select: { orderNumber: true, placedAt: true, totalAmount: true, paymentStatus: true },
    })

    const invoiceHistory = historyOrders.map((o) => ({
      invoiceNumber: `INV-${o.orderNumber}`,
      date: o.placedAt,
      amount: o.totalAmount,
      status: o.paymentStatus,
      downloadUrl: `/api/orders/${o.orderNumber}/invoice`,
    }))

    return NextResponse.json({
      success: true,
      data: { currentInvoice, invoiceHistory },
    })
  } catch (error) {
    console.error('Invoices GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}