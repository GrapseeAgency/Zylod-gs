import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeAdminReturn } from '@/lib/admin-returns'

/**
 * POST /api/admin/returns/[id]/refund — record a REAL refund for an approved
 * return request (ADMIN ONLY).
 *
 * What this rail is (and is not):
 * - It DOCUMENTS money that actually moved OUTSIDE this system (bank transfer,
 *   mobile banking, or cash handed over) by writing a ledger row with the
 *   real-world transaction reference (UTR / TxnID).
 * - It does NOT move money. There is no payment gateway here.
 * - It does NOT touch orders.paymentStatus — no real payment write-back rail
 *   exists, and flipping it without one would fabricate financial truth.
 *
 * Guard chain (fail closed, honest errors):
 * 401 (not admin) → 429 (rate limit 20/min) → 400 (invalid body) →
 * 404 (unknown return) → 409 (status must be 'approved'; message carries the
 * real current status) → 422 (amount > remaining = estimatedRefund −
 * Σ existing refunds.amount; message carries the real remaining amount).
 *
 * The refunds.create + returnRequests.status='refunded' flip happen in ONE
 * $transaction, and the decision is audit-logged with the authenticated
 * admin's id (never client-supplied).
 */

const BodySchema = z.object({
  amount: z.number().positive().finite(),
  method: z.enum(['bank_transfer', 'mobile_banking', 'cash']),
  reference: z.string().trim().min(4).max(120),
  note: z.string().max(2000).optional(),
})

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Error carrying an HTTP status through the interactive transaction. */
class GuardError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-returns-refund', 20, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Invalid payload — amount must be a positive number, method one of bank_transfer | mobile_banking | cash, reference required (4–120 chars).',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }
    const { amount, method, reference, note } = parsed.data
    const trimmedNote = (note ?? '').trim()
    // Captured once — auth.user is narrowed by the 401 guard above and must
    // not be re-derived inside the transaction closure.
    const adminId = auth.user.id

    // Guard: unknown return → 404 (fail closed before any write).
    const existing = await db.returnRequests.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }

    // Guard: only an 'approved' return can receive a refund record.
    // (pending → review first; rejected → no refund; refunded → the flip
    // already happened and any further transfer would need a new record flow.)
    if (existing.status !== 'approved') {
      return NextResponse.json(
        {
          error: `This return request (${existing.returnNumber}) is currently '${existing.status}' — refunds can only be recorded for approved returns.`,
        },
        { status: 409 }
      )
    }

    // Guard: amount must fit within the real remaining budget
    // = estimatedRefund − Σ existing refunds.amount for this return.
    const priorRefunds = await db.refunds.findMany({
      where: { returnRequestId: id },
      select: { amount: true },
    })
    const refundedSoFar = round2(priorRefunds.reduce((sum, f) => sum + f.amount, 0))
    const remaining = Math.max(0, round2(existing.estimatedRefund - refundedSoFar))
    if (round2(amount) > remaining) {
      return NextResponse.json(
        {
          error: `Refund amount exceeds the remaining refund budget: ${formatAmount(remaining)} remains on ${existing.returnNumber} (estimated refund ${formatAmount(existing.estimatedRefund)} minus ${formatAmount(refundedSoFar)} already refunded).`,
        },
        { status: 422 }
      )
    }

    // ONE transaction: ledger row + the parent status flip. Guards are
    // re-checked inside so a concurrent write cannot slip a bad amount through.
    const { refund, updated } = await db.$transaction(async (tx) => {
      const current = await tx.returnRequests.findUnique({ where: { id } })
      if (!current) throw new GuardError(404, 'Return request not found')
      if (current.status !== 'approved') {
        throw new GuardError(
          409,
          `This return request (${current.returnNumber}) is currently '${current.status}' — refunds can only be recorded for approved returns.`
        )
      }
      const txPrior = await tx.refunds.findMany({
        where: { returnRequestId: id },
        select: { amount: true },
      })
      const txRefunded = round2(txPrior.reduce((sum, f) => sum + f.amount, 0))
      const txRemaining = Math.max(0, round2(current.estimatedRefund - txRefunded))
      if (round2(amount) > txRemaining) {
        throw new GuardError(
          422,
          `Refund amount exceeds the remaining refund budget: ${formatAmount(txRemaining)} remains on ${current.returnNumber} (estimated refund ${formatAmount(current.estimatedRefund)} minus ${formatAmount(txRefunded)} already refunded).`
        )
      }

      const created = await tx.refunds.create({
        data: {
          returnRequestId: id,
          orderId: current.orderId,
          buyerId: current.buyerId,
          amount: round2(amount),
          method,
          reference,
          // Only 'processed' is ever written — it records a real transfer
          // that already happened outside the system.
          status: 'processed',
          processedById: adminId,
          note: trimmedNote.length > 0 ? trimmedNote : null,
        },
      })
      // resolutionNote is intentionally kept (it documents the approval);
      // updatedAt is bumped automatically via @updatedAt.
      const updatedRow = await tx.returnRequests.update({
        where: { id },
        data: { status: 'refunded' },
      })
      return { refund: created, updated: updatedRow }
    })

    // Audit trail — same real pattern as the approve/reject decision.
    await db.auditLogs.create({
      data: {
        actorId: adminId,
        action: 'refund_recorded',
        entityType: 'refunds',
        entityId: refund.id,
        metadata: JSON.stringify({
          returnNumber: updated.returnNumber,
          amount: refund.amount,
          method: refund.method,
          reference: refund.reference,
          buyerId: refund.buyerId,
          adminId,
        }),
      },
    })

    // Serialize the updated row exactly like GET so the UI can replace state.
    const items = await db.returnRequestItems.findMany({ where: { returnRequestId: updated.id } })
    const refunds = await db.refunds.findMany({
      where: { returnRequestId: updated.id },
      orderBy: { createdAt: 'desc' },
    })
    const order = await db.orders.findUnique({
      where: { id: updated.orderId },
      select: {
        orderNumber: true,
        paymentStatus: true,
        subOrders: { select: { status: true } },
      },
    })
    const buyerUser = await db.users.findUnique({
      where: { id: updated.buyerId },
      select: { id: true, email: true, buyerProfile: { select: { fullName: true } } },
    })

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        method: refund.method,
        reference: refund.reference,
        status: refund.status,
        processedById: refund.processedById,
        note: refund.note,
        createdAt: refund.createdAt.toISOString(),
      },
      return: serializeAdminReturn(
        updated,
        items,
        order,
        buyerUser
          ? { id: buyerUser.id, email: buyerUser.email, fullName: buyerUser.buyerProfile?.fullName ?? null }
          : null,
        refunds
      ),
      message: `Refund of ${formatAmount(refund.amount)} recorded for ${updated.returnNumber} (${methodLabel(refund.method)}, ref ${refund.reference}). The return is now marked refunded.`,
    })
  } catch (error) {
    if (error instanceof GuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Admin return refund POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function formatAmount(n: number): string {
  return `৳${n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function methodLabel(method: string): string {
  if (method === 'bank_transfer') return 'bank transfer'
  if (method === 'mobile_banking') return 'mobile banking'
  if (method === 'cash') return 'cash'
  return method
}
