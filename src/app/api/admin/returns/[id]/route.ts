import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeAdminReturn } from '@/lib/admin-returns'

/**
 * PATCH /api/admin/returns/[id] — approve or reject a pending buyer return request (ADMIN ONLY).
 *
 * Real behavior (no fake financial truth):
 * - Only a 'pending' request can be approved/rejected; anything else → 409.
 * - Rejection REQUIRES a real note (min 3 chars) — the buyer sees it.
 * - Approving may set a REAL refundAmount decision (≥ 0) on estimatedRefund;
 *   omitting it keeps the buyer's original estimate.
 * - There is deliberately NO 'refunded' transition: no real refund rail exists
 *   in the codebase, so writing 'refunded' would fake financial truth → 422.
 * - Every decision is audit-logged (action 'return_reviewed') with the
 *   authenticated admin's id as actor (never client-supplied).
 */

const BodySchema = z.object({
  action: z.enum(['approve', 'reject', 'refunded']),
  note: z.string().max(2000).optional(),
  refundAmount: z.number().min(0).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-returns-action', 30, 60 * 1000)
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
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { action, note, refundAmount } = parsed.data

    // No refund rail exists yet — marking a return 'refunded' would fabricate
    // financial truth, so it is refused honestly instead of silently succeeding.
    if (action === 'refunded') {
      return NextResponse.json(
        {
          error:
            'Returns cannot be marked as refunded yet — no real refund rail is implemented in this codebase, so writing a "refunded" status would fake financial truth. Only approve or reject is available.',
        },
        { status: 422 }
      )
    }

    if (refundAmount !== undefined && !Number.isFinite(refundAmount)) {
      return NextResponse.json(
        { error: 'refundAmount must be a finite number of at least 0' },
        { status: 422 }
      )
    }

    // Rejection requires a real, visible note (honest decision record).
    const trimmedNote = (note ?? '').trim()
    if (action === 'reject' && trimmedNote.length < 3) {
      return NextResponse.json(
        { error: 'A rejection note of at least 3 characters is required — the buyer will see this decision on their order.' },
        { status: 422 }
      )
    }

    const existing = await db.returnRequests.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }

    // Server-side transition guard: only pending → approved/rejected is legal.
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `This return request (${existing.returnNumber}) is already '${existing.status}' — only pending requests can be approved or rejected.` },
        { status: 409 }
      )
    }

    const now = new Date()
    const updated = await db.returnRequests.update({
      where: { id },
      data:
        action === 'approve'
          ? {
              status: 'approved',
              resolutionNote: trimmedNote.length > 0 ? trimmedNote : null,
              resolvedById: auth.user.id,
              resolvedAt: now,
              // The admin's real refund decision, when explicitly provided.
              ...(refundAmount !== undefined
                ? { estimatedRefund: Math.round(refundAmount * 100) / 100 }
                : {}),
            }
          : {
              status: 'rejected',
              resolutionNote: trimmedNote,
              resolvedById: auth.user.id,
              resolvedAt: now,
            },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'return_reviewed',
        entityType: 'returnRequests',
        entityId: updated.id,
        metadata: JSON.stringify({
          returnNumber: updated.returnNumber,
          decision: action,
          adminId: auth.user.id,
          previousStatus: existing.status,
          newStatus: updated.status,
          ...(refundAmount !== undefined ? { refundAmount: updated.estimatedRefund } : {}),
          note: updated.resolutionNote,
        }),
      },
    })

    // Serialize the updated row exactly like GET so the UI can replace state.
    const items = await db.returnRequestItems.findMany({ where: { returnRequestId: updated.id } })
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
      data: serializeAdminReturn(
        updated,
        items,
        order,
        buyerUser
          ? { id: buyerUser.id, email: buyerUser.email, fullName: buyerUser.buyerProfile?.fullName ?? null }
          : null
      ),
      message:
        action === 'approve'
          ? `Return request ${updated.returnNumber} approved.`
          : `Return request ${updated.returnNumber} rejected. The buyer can see the decision note on their order.`,
    })
  } catch (error) {
    console.error('Admin returns PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
