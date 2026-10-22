import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/wallet/refund (Task 140) — the buyer's REAL refund ledger.
 *
 * What this route is (and is not) after the Task 140 honesty pass:
 * - It returns the refunds the PLATFORM actually processed for this buyer —
 *   rows written by the admin rail POST /api/admin/returns/[id]/refund when
 *   an approved return's money genuinely moved (bank transfer / mobile
 *   banking / cash, each documented with the real-world UTR / TxnID
 *   reference). The money arrived OUTSIDE the platform wallet, exactly as
 *   the admin refund doctrine documents it.
 * - The old POST on this route was a SELF-SERVICE MONEY PRINTER: any
 *   authenticated user could credit their own wallet with ANY amount
 *   instantly, no verification, no order validation — the exact class of
 *   fake the wallet doctrine (Tasks 56/118/128) exists to kill. It is
 *   RETIRED. Refunds are never self-claimed; they are admin-processed
 *   through the return flow, documented with a real reference, audit-logged.
 *
 * Read-only. 401-first. The buyer sees only their own rows (buyerId = me).
 */

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const refunds = await db.refunds.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orderId: true,
        returnRequestId: true,
        amount: true,
        method: true,
        reference: true,
        status: true,
        note: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: refunds.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        returnRequestId: r.returnRequestId,
        amount: r.amount,
        method: r.method,
        reference: r.reference,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      })),
      message:
        'Refunds are processed by the platform once a return is approved — the money arrives through your chosen channel (bank transfer, mobile banking, or cash) and is documented here with its real transaction reference.',
    })
  } catch (error) {
    console.error('Refund GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
