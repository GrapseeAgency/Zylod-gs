import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const VAT_RATE = 0.15

/**
 * GET /api/orders/[id]/receipt
 * Generates a payment receipt for a real order. Auth required; caller must be
 * the buyer, a supplier on the order, or admin.
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

    const receiptItems = order.subOrders.flatMap((so) =>
      so.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        sku: item.product.sku || `WBD-${item.id.slice(-3).toUpperCase()}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
      }))
    )

    const subtotal = receiptItems.reduce((sum, item) => sum + item.total, 0)
    const shipping = order.subOrders.reduce((sum, so) => sum + (so.shippingCost || 0), 0)
    const tax = subtotal * VAT_RATE

    const receipt = {
      orderNumber: order.orderNumber,
      orderDate: order.placedAt,
      paymentMethod: order.payments[0]?.method || 'bank_transfer',
      paymentStatus: order.paymentStatus,
      items: receiptItems,
      subtotal,
      shipping,
      tax,
      total: order.totalAmount,
      currency: 'BDT',
      buyer: {
        name: order.buyer.buyerProfile?.fullName || 'N/A',
        businessName: order.buyer.buyerProfile?.businessName || null,
      },
      shippingAddress: order.shippingAddress
        ? {
            address: order.shippingAddress.addressLine1,
            city: order.shippingAddress.city,
            district: order.shippingAddress.district,
            country: order.shippingAddress.country,
          }
        : null,
    }

    return NextResponse.json({ success: true, data: receipt })
  } catch (error) {
    console.error('Receipt GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}