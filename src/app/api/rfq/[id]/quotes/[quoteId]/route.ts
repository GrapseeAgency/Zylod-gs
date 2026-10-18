import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * PATCH /api/rfq/[id]/quotes/[quoteId] — the buyer accepts or rejects one
 * supplier quote on THEIR rfqRequest (Task 52-b award rail).
 *
 * Mandate order (fixed contract — 52-a builds the matching seller writer):
 *   1) authenticateRequest → 401 FIRST.
 *   2) rate limit 20/min 'rfq-buyer-award'.
 *   3) Ownership: rfq.buyerId === session user else 404 (no-leak — existence
 *      never crosses accounts). Admin does NOT award (admins only close,
 *      admin routes, Task 52-d) → an admin who is not the buyer gets the
 *      same 404 here.
 *   4) Zod { action: 'accept' | 'reject' } → 400 with the verbatim parse
 *      error on failure.
 *   5) Guards: quote must belong to this rfq → 404 'Quote not found';
 *      rfq.status must be open|quoted else 409
 *      `Cannot <action> quotes on an RFQ with status "<status>"`;
 *      quote.status must be pending else 409 `Quote already <status>`.
 *   6) accept → ONE transaction: this quote → 'accepted', every sibling
 *      pending quote on the same rfq → 'rejected', rfq → 'awarded',
 *      auditLogs 'rfq_quote_accepted' (metadata { rfqId, quoteId }).
 *      reject → quote → 'rejected' only; the rfq keeps its honest status.
 *   7) AFTER the DB write commits: fire-and-forget broadcasts (the socket
 *      service being down NEVER fails the request) — event
 *      'rfq:quote-accepted' / 'rfq:quote-rejected' to BOTH `rfq:<rfqId>`
 *      (buyer/multi-tab) and `seller:<supplierId>` (the supplier's room,
 *      supplierId = rfqQuotes.supplierId = supplierProfiles.id).
 *
 * Privacy: no supplier PII is read or returned — rfqQuotes.supplierId is an
 * internal supplierProfiles reference, not contact data.
 */

const RATE_LIMIT = { limit: 20, windowMs: 60_000 }

const actionSchema = z.object({
  action: z.enum(['accept', 'reject']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  // 1) Auth first — 401 before anything else.
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  // 2) Rate limit second (mandated order).
  const rl = checkRateLimit(request, 'rfq-buyer-award', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id, quoteId } = await params

    // 3) Ownership — buyer-owner only, no-leak 404 otherwise.
    const rfq = await db.rfqRequests.findUnique({ where: { id } })
    if (!rfq || rfq.buyerId !== auth.user.id) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    // 4) Zod — verbatim parse error.
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = actionSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }
    const { action } = parsed.data
    const actorId = auth.user.id

    // 5a) The quote must exist AND belong to this rfq.
    const quote = await db.rfqQuotes.findUnique({ where: { id: quoteId } })
    if (!quote || quote.rfqId !== id) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // 5b) The rfq must still be open for awards.
    if (rfq.status !== 'open' && rfq.status !== 'quoted') {
      return NextResponse.json(
        { error: `Cannot ${action} quotes on an RFQ with status "${rfq.status}"` },
        { status: 409 }
      )
    }

    // 5c) Only pending quotes can be decided.
    if (quote.status !== 'pending') {
      return NextResponse.json(
        { error: `Quote already ${quote.status}` },
        { status: 409 }
      )
    }

    let updatedQuote
    let rfqStatus: string

    if (action === 'accept') {
      // 6) ONE transaction: award + sibling rejection + rfq status + audit.
      const result = await db.$transaction(async (tx) => {
        const accepted = await tx.rfqQuotes.update({
          where: { id: quote.id },
          data: { status: 'accepted' },
        })
        await tx.rfqQuotes.updateMany({
          where: { rfqId: id, id: { not: quote.id }, status: 'pending' },
          data: { status: 'rejected' },
        })
        await tx.rfqRequests.update({
          where: { id },
          data: { status: 'awarded' },
        })
        await tx.auditLogs.create({
          data: {
            actorId,
            action: 'rfq_quote_accepted',
            entityType: 'rfqQuotes',
            entityId: quote.id,
            metadata: JSON.stringify({ rfqId: id, quoteId: quote.id }),
          },
        })
        return accepted
      })
      updatedQuote = result
      rfqStatus = 'awarded'
    } else {
      // Reject: the quote flips, the rfq keeps its real status (honest).
      const result = await db.$transaction(async (tx) => {
        const rejected = await tx.rfqQuotes.update({
          where: { id: quote.id },
          data: { status: 'rejected' },
        })
        await tx.auditLogs.create({
          data: {
            actorId,
            action: 'rfq_quote_rejected',
            entityType: 'rfqQuotes',
            entityId: quote.id,
            metadata: JSON.stringify({ rfqId: id, quoteId: quote.id }),
          },
        })
        return rejected
      })
      updatedQuote = result
      rfqStatus = rfq.status
    }

    // 7) Fire-and-forget broadcasts of REAL persisted state — two rooms.
    const event = action === 'accept' ? 'rfq:quote-accepted' : 'rfq:quote-rejected'
    const payload = { rfqId: id, quoteId: quote.id, rfqStatus }
    void Promise.allSettled([
      broadcastToRoom(`rfq:${id}`, event, payload),
      broadcastToRoom(`seller:${updatedQuote.supplierId}`, event, payload),
    ])

    return NextResponse.json({
      success: true,
      data: {
        quote: {
          id: updatedQuote.id,
          rfqId: updatedQuote.rfqId,
          supplierId: updatedQuote.supplierId,
          pricePerUnit: updatedQuote.pricePerUnit,
          totalPrice: updatedQuote.totalPrice,
          deliveryDays: updatedQuote.deliveryDays,
          message: updatedQuote.message,
          status: updatedQuote.status,
          createdAt: updatedQuote.createdAt,
        },
        rfqStatus,
      },
    })
  } catch (error) {
    console.error('RFQ quote PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
