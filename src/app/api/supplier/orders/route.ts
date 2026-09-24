import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * REAL supplier orders API.
 * Every order shown here comes from the `subOrders` table for the
 * authenticated supplier — zero hardcoded rows, zero fake buyers.
 * If the supplier has no orders, the API honestly returns an empty list.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Supplier authentication required' }, { status: 401 })
    }

    // Admin may inspect any supplier via ?supplierId=, suppliers only see their own
    let supplierId: string | undefined
    if (auth.user.userType === 'admin') {
      const requested = request.nextUrl.searchParams.get('supplierId')
      if (!requested) {
        return NextResponse.json({ error: 'supplierId query parameter is required for admin' }, { status: 400 })
      }
      supplierId = requested
    } else {
      const profile = await db.supplierProfiles.findFirst({
        where: { userId: auth.user.id },
        select: { id: true },
      })
      if (!profile) {
        return NextResponse.json({ error: 'No supplier profile found for this account' }, { status: 404 })
      }
      supplierId = profile.id
    }

    const statusParam = (request.nextUrl.searchParams.get('status') || '').trim().toLowerCase()
    const where: Record<string, unknown> = { supplierId }
    // Only accept REAL subOrder statuses — unknown filters return empty lists
    const validStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']
    if (statusParam && validStatuses.includes(statusParam)) {
      where.status = statusParam
    }

    const subOrders = await db.subOrders.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            paymentStatus: true,
            buyerId: true,
            buyer: {
              select: {
                buyerProfile: { select: { fullName: true, businessName: true } },
              },
            },
          },
        },
        items: {
          include: {
            product: { select: { name: true, thumbnailUrl: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const orders = subOrders.map((sub) => {
      const buyerName = sub.order.buyer?.buyerProfile?.fullName || 'Buyer'
      const buyerCompanyName = sub.order.buyer?.buyerProfile?.businessName || buyerName
      return {
        id: sub.id,
        orderNumber: sub.order.orderNumber,
        createdAt: sub.createdAt.toISOString(),
        status: sub.status,
        paymentStatus: sub.order.paymentStatus,
        buyerCompanyName,
        buyerName,
        moqPackCount: sub.items.reduce((sum, i) => sum + i.quantity, 0),
        totalAmount: sub.subtotal,
        items: sub.items.map((i) => ({
          name: i.product?.name || 'Product',
          imageUrl: i.product?.thumbnailUrl || null,
          quantity: i.quantity,
          price: i.totalPrice,
          unit: i.product?.unit || null,
        })),
      }
    })

    return NextResponse.json({ success: true, orders })
  } catch (error) {
    console.error('Supplier orders GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
