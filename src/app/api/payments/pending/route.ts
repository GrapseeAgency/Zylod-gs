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

    // Payments with pending status or held in escrow
    const [pendingPayments, heldEscrows] = await Promise.all([
      db.payments.findMany({
        where: {
          status: 'pending',
          order: {
            OR: [{ buyerId: userId }, { subOrders: { some: { supplierId: userId } } }],
          },
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
          },
        },
        orderBy: { id: 'desc' },
      }),
      db.escrowAccounts.findMany({
        where: {
          status: 'held',
          OR: [{ buyerId: userId }, { supplierId: userId }],
        },
        include: {
          order: {
            select: { id: true, orderNumber: true, totalAmount: true, createdAt: true },
          },
        },
        orderBy: { heldAt: 'desc' },
      }),
    ])

    const formatted = [
      ...pendingPayments.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        amount: p.amount,
        type: 'Order Payment Clearance',
        method: p.method,
        status: 'pending_settlement',
        date: p.order.createdAt.toISOString(),
        description: `Wholesale order payment clearance for PO #${p.order.orderNumber}`,
      })),
      ...heldEscrows.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        orderNumber: e.order.orderNumber,
        amount: e.amount,
        type: 'Trade Assurance Escrow',
        method: 'Escrow Vault',
        status: 'held_in_escrow',
        date: e.heldAt.toISOString(),
        description: `Secured milestone escrow for PO #${e.order.orderNumber}. Releasing upon delivery inspection.`,
      })),
    ]

    return NextResponse.json({
      success: true,
      data: formatted,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
