import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/rfq/[id] — buyer-owned RFQ detail with the FULL quote list.
 *
 * Mandate order (Task 52-b contract):
 *   1) authenticateRequest → 401 FIRST (nothing else is revealed before auth).
 *   2) rate limit 60/min 'rfq-buyer-detail'.
 *   3) RFQ missing → 404 'RFQ request not found'. A non-owner (any user type
 *      except admin) receives the SAME 404 — existence never leaks across
 *      accounts (same no-leak pattern as the Task-51 order fix).
 *   4) Admin bypasses ownership for oversight (userType === 'admin').
 *
 * Privacy: supplier identity is exposed as displayName ONLY
 * (supplierProfiles.companyName — the display-name field, verified in
 * schema.prisma; there is no storeName column). Never supplier
 * email/phone/NID/bank/userId. rfqQuotes.supplierId is a supplierProfiles.id
 * and is included (internal reference, not PII). Buyer display name comes
 * from buyerProfiles.fullName (users has no name column) — an admin-oversight
 * benefit; the owner sees their own name, which is theirs.
 */

const RATE_LIMIT = { limit: 60, windowMs: 60_000 }

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'rfq-buyer-detail', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const rfq = await db.rfqRequests.findUnique({
      where: { id },
      include: {
        items: true,
        quotes: {
          orderBy: { createdAt: 'desc' },
          include: {
            supplier: { select: { id: true, companyName: true } },
          },
        },
        buyer: { include: { buyerProfile: { select: { fullName: true } } } },
      },
    })

    // 3) Missing or not the owner → the SAME 404 (no-leak). Admin bypasses.
    if (!rfq) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }
    const isOwner = rfq.buyerId === auth.user.id
    const isAdmin = auth.user.userType === 'admin'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    const data = {
      id: rfq.id,
      buyerId: rfq.buyerId,
      title: rfq.title,
      description: rfq.description,
      categorySlug: rfq.categorySlug,
      quantity: rfq.quantity,
      unit: rfq.unit,
      targetPrice: rfq.targetPrice,
      deliveryCity: rfq.deliveryCity,
      deadline: rfq.deadline,
      status: rfq.status,
      items: rfq.items,
      quotes: rfq.quotes.map((q) => ({
        id: q.id,
        rfqId: q.rfqId,
        supplierId: q.supplierId,
        pricePerUnit: q.pricePerUnit,
        totalPrice: q.totalPrice,
        deliveryDays: q.deliveryDays,
        message: q.message,
        status: q.status,
        createdAt: q.createdAt,
        supplier: { displayName: q.supplier?.companyName ?? null },
      })),
      quoteCount: rfq.quotes.length,
      buyerName: rfq.buyer?.buyerProfile?.fullName ?? null,
      // Task 82: the buyer learns their RFQ became a real order — the
      // denormalized order number rides the row itself (id + payment status
      // need no join the buyer surface shouldn't make).
      convertedOrder: rfq.convertedOrderId
        ? { id: rfq.convertedOrderId, orderNumber: rfq.convertedOrderNumber }
        : null,
      createdAt: rfq.createdAt,
      updatedAt: rfq.updatedAt,
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('RFQ detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
