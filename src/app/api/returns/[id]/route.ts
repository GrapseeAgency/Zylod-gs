import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { listEvidence } from '@/lib/evidence'

/**
 * GET /api/returns/[id] — one real return request.
 * Visible to its buyer or an admin; everyone else gets 403/404.
 * Refunds (Task 47): the response carries the real refunds[] ledger rows
 * (money that actually moved outside the system) — empty when none exist.
 * Evidence (Task 49-b): the response carries evidencePhotos metadata (id,
 * mimeType, sizeBytes, note, createdAt, url) for THIS request — metadata
 * only, never the bytes; bytes are served by /api/attachments/[id] which
 * enforces the same owner-or-admin rule as this route.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const rl = checkRateLimit(request, 'return-detail', 60, 60 * 1000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const ret = await db.returnRequests.findUnique({
      where: { id },
    })
    if (!ret) return NextResponse.json({ error: 'Return request not found' }, { status: 404 })

    if (ret.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to view this return request' }, { status: 403 })
    }

    const retItems = await db.returnRequestItems.findMany({ where: { returnRequestId: ret.id } })

    const retRefunds = await db.refunds.findMany({
      where: { returnRequestId: ret.id },
      orderBy: { createdAt: 'desc' },
    })

    // Buyer-provided evidence photos (metadata only — never the bytes).
    const evidencePhotos = await listEvidence('return', ret.id)

    const order = await db.orders.findUnique({
      where: { id: ret.orderId },
      select: { id: true, orderNumber: true, paymentStatus: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: ret.id,
        returnNumber: ret.returnNumber,
        orderId: ret.orderId,
        orderNumber: order?.orderNumber ?? null,
        orderPaymentStatus: order?.paymentStatus ?? null,
        status: ret.status,
        shippingMethod: ret.shippingMethod,
        estimatedRefund: ret.estimatedRefund,
        resolutionNote: ret.resolutionNote,
        resolvedById: ret.resolvedById,
        resolvedAt: ret.resolvedAt?.toISOString() ?? null,
        createdAt: ret.createdAt.toISOString(),
        updatedAt: ret.updatedAt.toISOString(),
        items: retItems.map(i => ({
          id: i.id,
          orderItemId: i.orderItemId,
          reason: i.reason,
          quantity: i.quantity,
          comments: i.comments,
        })),
        refunds: retRefunds.map(f => ({
          id: f.id,
          amount: f.amount,
          method: f.method,
          reference: f.reference,
          status: f.status,
          processedAt: f.createdAt.toISOString(),
          note: f.note,
        })),
        evidencePhotos,
      },
    })
  } catch (error) {
    console.error('Return detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
