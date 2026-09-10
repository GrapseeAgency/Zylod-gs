import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// Platform billing identity (single source of truth — not user-editable).
const COMPANY = Object.freeze({
  name: 'Zylod',
  address: 'Level 12, Summit Tower, Gulshan-2',
  city: 'Dhaka, 1212',
  country: 'Bangladesh',
  phone: '+880 2 8888 9999',
  email: 'billing@zylod.com',
  taxId: 'TIN-123456789',
})

// 15% VAT — production value should come from config/env, kept here as a constant.
const VAT_RATE = 0.15

/**
 * GET /api/orders/[id]/invoice
 * Generates an invoice for a real order. Requires authentication; the caller
 * must be the order's buyer, a supplier on the order, or an admin.
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

    // Authorization: buyer, a supplier on the order, or admin.
    const isBuyer = order.buyerId === auth.user.id
    const isAdmin = auth.user.userType === 'admin'
    if (!isBuyer && !isAdmin) {
      // For suppliers, confirm one of the subOrders belongs to them.
      const supplierOnOrder = order.subOrders.some(
        (so) => so.items.some((it) => it.product.supplierId === auth.user!.id)
      )
      if (!supplierOnOrder) {
        return NextResponse.json({ error: 'Not authorized to view this invoice' }, { status: 403 })
      }
    }

    const invoiceItems = order.subOrders.flatMap((so) =>
      so.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        productImage: item.product.images[0]?.imageUrl || null,
        variant: item.variant ? `${item.variant.variantName}: ${item.variant.variantValue}` : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.totalPrice,
        supplier: item.product.supplier.companyName,
      }))
    )

    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0)
    const shipping = order.subOrders.reduce((sum, so) => sum + (so.shippingCost || 0), 0)
    const tax = subtotal * VAT_RATE
    // Derived discount: whatever isn't subtotal + shipping + tax.
    const discount = Math.max(0, subtotal + shipping + tax - order.totalAmount)

    const invoice = {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      orderDate: order.placedAt,
      invoiceDate: new Date().toISOString(),
      status: order.paymentStatus,
      company: COMPANY,
      buyer: {
        name: order.buyer.buyerProfile?.fullName || 'N/A',
        businessName: order.buyer.buyerProfile?.businessName || null,
        address: order.shippingAddress ? `${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}` : 'N/A',
        city: order.shippingAddress?.city || 'N/A',
        district: order.shippingAddress?.district || 'N/A',
        country: order.shippingAddress?.country || 'Bangladesh',
      },
      items: invoiceItems,
      subtotal,
      shipping,
      tax,
      discount,
      grandTotal: order.totalAmount,
      paymentMethod: order.payments[0]?.method || 'N/A',
      paymentStatus: order.paymentStatus,
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    console.error('Invoice GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}