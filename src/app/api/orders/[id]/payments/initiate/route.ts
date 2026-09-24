import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * POST /api/orders/[id]/payments/initiate
 * Buyer starts payment for their own order.
 *
 * REAL BEHAVIOR:
 * - amount ALWAYS comes from order.totalAmount in the DB (never the client).
 * - The payments row starts as `pending` — the order is NOT paid yet.
 * - Instructions are built ONLY from env-configured receiving accounts
 *   (PAYMENT_BANK_NAME / PAYMENT_BANK_ACCOUNT / PAYMENT_BKASH_MERCHANT /
 *   PAYMENT_NAGAD_MERCHANT). If none are configured this returns 503 —
 *   we never pretend a payment channel exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUserType(request, ['buyer'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const { id } = await params

    const body = await request.json().catch(() => null)
    const method = typeof body?.method === 'string' ? body.method : ''
    const METHODS = ['bank_transfer', 'mobile_banking'] as const
    if (!METHODS.includes(method as (typeof METHODS)[number])) {
      return NextResponse.json({ error: `method must be one of: ${METHODS.join(', ')}` }, { status: 400 })
    }

    const order = await db.orders.findUnique({ where: { id } })
    if (!order || order.buyerId !== auth.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.paymentStatus === 'paid') {
      return NextResponse.json({ error: 'This order is already paid' }, { status: 409 })
    }

    // Reuse an existing pending payment for the same method instead of stacking rows
    const existing = await db.payments.findFirst({
      where: { orderId: order.id, status: 'pending', method },
    })
    const payment = existing ?? (await db.payments.create({
      data: {
        orderId: order.id,
        method,
        amount: order.totalAmount, // server-side amount — never client-sent
        status: 'pending',
      },
    }))

    // Build instructions exclusively from env — unset vars produce honest gaps
    const instructions: Record<string, string> = {}
    if (process.env.PAYMENT_BANK_NAME && process.env.PAYMENT_BANK_ACCOUNT) {
      instructions.bank = `${process.env.PAYMENT_BANK_NAME} — a/c ${process.env.PAYMENT_BANK_ACCOUNT}`
    }
    if (process.env.PAYMENT_BKASH_MERCHANT) {
      instructions.bKash = `Send Money to ${process.env.PAYMENT_BKASH_MERCHANT} and reference ${order.orderNumber}`
    }
    if (process.env.PAYMENT_NAGAD_MERCHANT) {
      instructions.Nagad = `Send Money to ${process.env.PAYMENT_NAGAD_MERCHANT} and reference ${order.orderNumber}`
    }
    if (Object.keys(instructions).length === 0) {
      return NextResponse.json(
        {
          error:
            'No payment receiving account is configured yet, so this order cannot be paid right now. ' +
            'The site owner must set the payment account configuration before checkout can complete.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        instructions,
        note:
          'After sending the money, payment is confirmed only when the gateway/webhook or the site admin verifies the transaction. Until then the order stays UNPAID.',
      },
    })
  } catch (error) {
    console.error('Payment initiate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
