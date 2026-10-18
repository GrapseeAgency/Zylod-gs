import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * POST /api/supplier/rfqs/[id]/quote — the FIRST rfqQuotes writer on the
 * platform (Task 52-a). Sellers respond to a buyer's quote request with a
 * per-unit price; the server computes the total, guards the RFQ lifecycle,
 * records a real before/after audit row, and pushes `rfq:new-quote` into the
 * RFQ's token-gated socket room so the buyer's quote rail updates live.
 *
 * Contract (orchestrator-fixed — 52-b/52-d build against this):
 *  - AUTH FIRST: requireUserType(['supplier']) → 401. Admin does NOT quote —
 *    admins moderate (their RFQ surfaces are Task 52-d); this verb is the
 *    seller's alone.
 *  - Rate limit SECOND: 20 quotes/min ('supplier-rfq-quote').
 *  - resolveSupplierProfile → none → 403 SUPPLIER_PROFILE_REQUIRED (same
 *    shape as every sibling /api/supplier/* route).
 *  - Zod: { pricePerUnit positive, deliveryDays int 0..365 optional,
 *    message ≤2000 optional }. totalPrice is NEVER trusted from the client —
 *    it is computed server-side (see QUANTITY PRECEDENCE below).
 *  - Lifecycle guards:
 *      rfq 404 'RFQ request not found'
 *      rfq.status ∉ {open, quoted} → 409 `Cannot quote on an RFQ with status "<status>"`
 *      deadline in the past → 409 naming the real deadline date
 *  - Idempotency per (rfqId, supplierId):
 *      own quote 'pending'           → UPDATE it (an edit; audit before/after)
 *      own quote 'accepted|rejected' → 409 `Your quote on this RFQ is already <status>`
 *      no own quote                  → CREATE; if the RFQ was 'open' it flips
 *                                      to 'quoted' IN THE SAME TRANSACTION.
 *  - QUANTITY PRECEDENCE for totalPrice (documented, deterministic):
 *      1. rfq.quantity (the request-level total, when the buyer set one)
 *      2. otherwise the sum of rfqItems[].quantity
 *      3. otherwise 1 (a description-only RFQ quotes as a single unit)
 *    totalPrice = pricePerUnit × qty, computed here — never client-sent.
 *  - auditLogs: action 'rfq_quoted', actor = the authenticated seller,
 *    metadata { rfqId, quoteId, before, after } — real persisted values only.
 *  - Broadcast AFTER the DB write (fire-and-forget doctrine of
 *    src/lib/realtime-broadcast.ts): `rfq:new-quote` to room `rfq:<rfqId>`.
 *    NO admin fan-out: the broadcast lib is one-room-per-call and nothing in
 *    the codebase joins an 'admin:broadcast' room (verified by grep) — room
 *    names that no client joins are never invented. Flagged in the Task 52-a
 *    worklog: when an admin RFQ console exists (52-d) it can subscribe via
 *    its own admin room or join rfq rooms directly (room-token authorizes
 *    admins already).
 *  - Response 201 { success: true, data: quote }.
 */

const QUOTE_LIMIT = { limit: 20, windowMs: 60_000 }

/** RFQ statuses that still accept (new or edited) quotes. */
const QUOTABLE_RFQ_STATUSES = ['open', 'quoted'] as const

const quoteBodySchema = z.object({
  pricePerUnit: z.number().positive(),
  deliveryDays: z.number().int().min(0).max(365).optional(),
  message: z.string().max(2000).optional(),
})

/** Shape returned to the client — dates as ISO strings like the sibling APIs. */
function quoteView(q: {
  id: string
  rfqId: string
  supplierId: string
  pricePerUnit: number
  totalPrice: number
  deliveryDays: number | null
  message: string | null
  status: string
  createdAt: Date
}) {
  return {
    id: q.id,
    rfqId: q.rfqId,
    supplierId: q.supplierId,
    pricePerUnit: q.pricePerUnit,
    totalPrice: q.totalPrice,
    deliveryDays: q.deliveryDays,
    message: q.message,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1) AUTH FIRST — sellers only; admins moderate, they do not quote.
  const auth = await requireUserType(request, ['supplier'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Supplier authentication required' },
      { status: 401 }
    )
  }

  // 2) Rate limit AFTER auth.
  const rl = checkRateLimit(request, 'supplier-rfq-quote', QUOTE_LIMIT.limit, QUOTE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  // 3) Real supplier profile — never fabricated.
  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  try {
    const { id } = await params

    // 4) Body — Zod-parsed; the first real issue message is returned verbatim.
    const body = await request.json().catch(() => null)
    const parsed = quoteBodySchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { pricePerUnit, deliveryDays, message } = parsed.data

    // 5) Load the RFQ with its items (quantity fallback) and any own quote.
    const rfq = await db.rfqRequests.findUnique({
      where: { id },
      select: {
        id: true,
        quantity: true,
        deadline: true,
        status: true,
        items: { select: { quantity: true } },
      },
    })
    if (!rfq) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    if (!(QUOTABLE_RFQ_STATUSES as readonly string[]).includes(rfq.status)) {
      return NextResponse.json(
        { error: `Cannot quote on an RFQ with status "${rfq.status}"` },
        { status: 409 }
      )
    }

    if (rfq.deadline && rfq.deadline.getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: `The quoting deadline for this RFQ passed on ${rfq.deadline.toISOString()} — quotes are closed.`,
        },
        { status: 409 }
      )
    }

    // Idempotency — one quote per (rfq, supplier).
    const ownQuote = await db.rfqQuotes.findFirst({
      where: { rfqId: rfq.id, supplierId: profile.id },
    })
    if (ownQuote && ownQuote.status !== 'pending') {
      return NextResponse.json(
        { error: `Your quote on this RFQ is already ${ownQuote.status}` },
        { status: 409 }
      )
    }

    // QUANTITY PRECEDENCE (documented): rfq.quantity ?? Σ rfqItems.quantity ?? 1.
    const itemsQtySum = rfq.items.reduce(
      (sum, it) => sum + (Number.isFinite(it.quantity) ? it.quantity : 0),
      0
    )
    const qty = rfq.quantity ?? (itemsQtySum > 0 ? itemsQtySum : 1)
    const totalPrice = pricePerUnit * qty

    let quote
    let rfqStatusBefore: string | null = null
    let rfqStatusAfter: string | null = null

    if (ownQuote) {
      // EDIT of the seller's own pending quote — same row, new values.
      quote = await db.rfqQuotes.update({
        where: { id: ownQuote.id },
        data: {
          pricePerUnit,
          totalPrice,
          deliveryDays: deliveryDays ?? null,
          message: message ?? null,
        },
      })
    } else {
      // CREATE — and the first quote on an 'open' RFQ flips it to 'quoted',
      // in the SAME transaction as the quote write (all-or-nothing).
      rfqStatusBefore = rfq.status
      rfqStatusAfter = rfq.status === 'open' ? 'quoted' : rfq.status
      quote = await db.$transaction(async (tx) => {
        const created = await tx.rfqQuotes.create({
          data: {
            rfqId: rfq.id,
            supplierId: profile.id,
            pricePerUnit,
            totalPrice,
            deliveryDays: deliveryDays ?? null,
            message: message ?? null,
          },
        })
        if (rfq.status === 'open') {
          await tx.rfqRequests.update({
            where: { id: rfq.id },
            data: { status: 'quoted' },
          })
        }
        return created
      })
    }

    // 6) Audit — real before/after, actor is the authenticated seller.
    //    Sibling convention (/api/supplier/orders/[id]): dates as ISO strings,
    //    metadata JSON-stringified.
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'rfq_quoted',
        entityType: 'rfqRequests',
        entityId: rfq.id,
        metadata: JSON.stringify({
          actorType: auth.user.userType,
          supplierId: profile.id,
          rfqId: rfq.id,
          quoteId: quote.id,
          before: ownQuote
            ? {
                pricePerUnit: ownQuote.pricePerUnit,
                totalPrice: ownQuote.totalPrice,
                deliveryDays: ownQuote.deliveryDays,
                message: ownQuote.message,
                status: ownQuote.status,
              }
            : null,
          after: {
            pricePerUnit: quote.pricePerUnit,
            totalPrice: quote.totalPrice,
            deliveryDays: quote.deliveryDays,
            message: quote.message,
            status: quote.status,
          },
          ...(rfqStatusBefore !== rfqStatusAfter
            ? { rfqStatus: { before: rfqStatusBefore, after: rfqStatusAfter } }
            : {}),
        }),
      },
    })

    // 7) Real-time — only AFTER the DB write succeeded. Fire-and-forget: the
    //    socket service being down never fails the API (clients poll).
    //    Payload = the persisted quote (consumers re-fetch detail through
    //    their own authenticated APIs).
    void broadcastToRoom(`rfq:${rfq.id}`, 'rfq:new-quote', {
      rfqId: rfq.id,
      quoteId: quote.id,
      pricePerUnit: quote.pricePerUnit,
      totalPrice: quote.totalPrice,
      deliveryDays: quote.deliveryDays,
      status: quote.status,
      updatedAt: quote.createdAt.toISOString(),
    })

    return NextResponse.json({ success: true, data: quoteView(quote) }, { status: 201 })
  } catch (error) {
    console.error('Supplier RFQ quote POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
