import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

function getOverallOrderStatus(subOrderStatuses: string[]): string {
  if (subOrderStatuses.length === 0) return 'pending'
  if (subOrderStatuses.every(s => s === 'delivered')) return 'delivered'
  if (subOrderStatuses.some(s => s === 'cancelled')) return 'cancelled'
  if (subOrderStatuses.some(s => s === 'shipped')) return 'shipped'
  if (subOrderStatuses.some(s => s === 'confirmed')) return 'confirmed'
  return 'pending'
}

// GET /api/orders/my-orders — List the authenticated buyer's orders
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireUserType(request, ['buyer'])
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Authentication required' }, { status: 401 })
    }

    const buyerId = authResult.user.id
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const orders = await db.orders.findMany({
      where: { buyerId },
      include: {
        shippingAddress: true,
        subOrders: true,
      },
      orderBy: { placedAt: 'desc' },
    })

    // subOrders.supplierId is a plain scalar — batch-resolve supplier names
    const supplierIds = Array.from(
      new Set(orders.flatMap(o => o.subOrders.map(so => so.supplierId)))
    )
    const suppliers = supplierIds.length
      ? await db.supplierProfiles.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true },
        })
      : []
    const supplierNameById = new Map(suppliers.map(s => [s.id, s.companyName]))

    let data = orders.map(order => ({
      id: order.id,
      order_number: order.orderNumber,
      total_amount: order.totalAmount,
      payment_status: order.paymentStatus,
      placed_at: order.placedAt.toISOString(),
      updated_at: order.createdAt.toISOString(),
      shipping_address: order.shippingAddress
        ? {
            label: order.shippingAddress.label,
            address_line1: order.shippingAddress.addressLine1,
            city: order.shippingAddress.city,
          }
        : null,
      sub_orders: order.subOrders.map(so => ({
        id: so.id,
        status: so.status,
        supplier: {
          company_name: supplierNameById.get(so.supplierId) || 'Supplier',
        },
      })),
    }))

    if (status && status !== 'all') {
      data = data.filter(o => getOverallOrderStatus(o.sub_orders.map(s => s.status)) === status)
    }

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        o =>
          o.order_number.toLowerCase().includes(q) ||
          o.sub_orders.some(s => s.supplier.company_name.toLowerCase().includes(q))
      )
    }

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
    })
  } catch (error) {
    console.error('My orders API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
