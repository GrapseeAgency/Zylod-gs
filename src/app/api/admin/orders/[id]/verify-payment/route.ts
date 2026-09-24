import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * POST /api/admin/orders/[id]/verify-payment — admin-only.
 * For real-world B2B flows (bank transfer with paper receipt): an admin who
 * has CONFIRMED money arrived in the company account records the verified
 * payment. This is a deliberate human-verified path — not a test/bypass:
 * it requires admin auth and is audit-logged with the verifier's id.
 *
 * Body: { transactionId, method: 'bank_transfer'|'mobile_banking', amount, note? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
    }
    const { id } = await params

    const body = await request.json().catch(() => null)
    const transactionId = typeof body?.transactionId === 'string' ? body.transactionId.trim() : ''
    const method = typeof body?.method === 'string' ? body.method : ''
    const amount = Number(body?.amount)
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : ''

    if (!transactionId || !method || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'transactionId, method and a positive amount are required' },
        { status: 400 }
      )
    }
    if (!['bank_transfer', 'mobile_banking'].includes(method)) {
      return NextResponse.json({ error: "method must be 'bank_transfer' or 'mobile_banking'" }, { status: 400 })
    }

    const order = await db.orders.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This order is already marked paid' }, { status: 409 })
    }
    if (Math.abs(amount - order.totalAmount) > 0.01) {
      return NextResponse.json(
        { error: `Recorded amount ${amount} does not match the order total ${order.totalAmount}` },
        { status: 400 }
      )
    }

    const existingTx = await db.payments.findFirst({ where: { transactionId } })
    if (existingTx) {
      return NextResponse.json({ error: 'This transactionId was already recorded' }, { status: 409 })
    }

    await db.$transaction(async (tx) => {
      await tx.payments.create({
        data: {
          orderId: order.id,
          method,
          amount,
          status: 'success',
          transactionId,
          gatewayResponse: `admin-verified by ${auth.user!.id}${note ? ` — ${note}` : ''}`.slice(0, 500),
          paidAt: new Date(),
        },
      })
      await tx.orders.update({
        where: { id: order.id },
        data: { paymentStatus: 'paid' },
      })
    })

    console.log(`[AUDIT] Order ${order.orderNumber} marked PAID by admin ${auth.user.id} (tx ${transactionId}, ${amount})`)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, paymentStatus: 'paid' } })
  } catch (error) {
    console.error('Admin verify-payment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
