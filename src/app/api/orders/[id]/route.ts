import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

type OrderWithIncludes = Prisma.ordersGetPayload<{
  include: {
    shippingAddress: true
    subOrders: {
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, thumbnailUrl: true, unit: true, slug: true } }
            variant: { select: { id: true, variantName: true, variantValue: true } }
          }
        }
        trackingHistory: { orderBy: { trackedAt: 'desc' }; take: 10 }
      }
    }
    payments: { orderBy: { paidAt: 'desc' } }
  }
}>

/**
 * GET /api/orders/[id] — real order detail with sub-orders, items, payment, shipping address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        subOrders: {
          orderBy: { createdAt: 'asc' },
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, thumbnailUrl: true, unit: true, slug: true } },
                variant: { select: { id: true, variantName: true, variantValue: true } },
              },
            },
            trackingHistory: {
              orderBy: { trackedAt: 'desc' },
              take: 10,
            },
          },
        },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    }) as OrderWithIncludes | null

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Ensure only the owner (or a supplier involved) can view
    const isParticipatingSupplier = order.subOrders.some(so => so.supplierId === auth.user?.id)
    if (order.buyerId !== auth.user.id && !isParticipatingSupplier && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to view this order' }, { status: 403 })
    }

    // Resolve supplier names for each sub-order
    const supplierIds = [...new Set(order.subOrders.map(so => so.supplierId))]
    const suppliers = supplierIds.length
      ? await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true, ratingAvg: true, ratingCount: true },
        })
      : []
    const supplierMap = new Map(suppliers.map(s => [s.id, s]))

    const data = {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      paymentStatus: order.paymentStatus,
      placedAt: order.placedAt.toISOString(),
      updatedAt: order.createdAt.toISOString(),
      shippingAddress: order.shippingAddress
        ? {
            id: order.shippingAddress.id,
            label: order.shippingAddress.label,
            addressLine1: order.shippingAddress.addressLine1,
            addressLine2: order.shippingAddress.addressLine2,
            city: order.shippingAddress.city,
            district: order.shippingAddress.district,
            postalCode: order.shippingAddress.postalCode,
          }
        : null,
      payments: order.payments.map(p => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        status: p.status,
        transactionId: p.transactionId,
        paidAt: p.paidAt?.toISOString() || null,
      })),
      subOrders: order.subOrders.map(so => {
        const supplier = supplierMap.get(so.supplierId)
        return {
          id: so.id,
          orderId: so.orderId,
          supplierId: so.supplierId,
          supplier: supplier
            ? {
                companyName: supplier.companyName,
                slug: supplier.companyName.toLowerCase().replace(/\s+/g, '-'),
                ratingAvg: supplier.ratingAvg,
                ratingCount: supplier.ratingCount,
              }
            : { companyName: 'Supplier', slug: '', ratingAvg: 0, ratingCount: 0 },
          subtotal: so.subtotal,
          shippingCost: so.shippingCost,
          status: so.status,
          trackingNumber: so.trackingNumber,
          estimatedDelivery: so.estimatedDelivery?.toISOString() || null,
          createdAt: so.createdAt.toISOString(),
          updatedAt: so.updatedAt.toISOString(),
          items: so.items.map(item => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            product: item.product,
            variant: item.variant,
          })),
          tracking: so.trackingHistory.map(t => ({
            id: t.id,
            status: t.status,
            location: t.location,
            note: t.note,
            lat: t.lat,
            lng: t.lng,
            trackedAt: t.trackedAt.toISOString(),
          })),
        }
      }),
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Order detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
