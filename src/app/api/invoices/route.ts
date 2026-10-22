import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Task 132 REAL BUG (same identity trap Task 128 killed in the receipt
    // route): subOrders.supplierId stores a supplierProfiles.id, NOT a
    // users.id — the old `supplierId: userId` could NEVER match, so sellers
    // saw an empty invoice list forever. Admins see the full book.
    const whereClause: any =
      auth.user.userType === 'admin' ? {} : { OR: [{ buyerId: userId }] }

    if (auth.user.userType !== 'admin') {
      const profile = await resolveSupplierProfile(auth.user)
      if (profile) {
        whereClause.OR.push({ subOrders: { some: { supplierId: profile.id } } })
      }
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
