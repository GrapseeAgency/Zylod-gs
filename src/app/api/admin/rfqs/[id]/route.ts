import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * /api/admin/rfqs/[id] — admin oversight detail + moderation close. ADMIN ONLY.
 *
 * GET — the full RFQ: every real scalar field, the buyer's displayName (from
 * buyerProfiles.fullName — users has no name column), all rfqItems, and all
 * rfqQuotes newest-first with the supplier's real displayName (supplierProfiles
 * companyName — verified: supplierProfiles has NO storeName field in
 * prisma/schema.prisma, so companyName IS the display name). Admins are
 * trusted oversight; the supplier identity shown is the same companyName
 * already public on the marketplace. No email/phone is exposed here (the
 * admin/users route exposes those for USER administration — RFQ oversight
 * does not need them, so they stay out).
 *
 * PATCH — the ONLY admin write on an RFQ: close it.
 * - Zod .strict(): { status: 'closed' } — the single allowed body; anything
 *   else (unknown fields included) is a 400 with the verbatim Zod error.
 * - Guarded: only an RFQ whose real status is 'open' or 'quoted' can be
 *   closed. awarded/closed/expired are final → 409 with the REAL status in
 *   the message.
 * - Transaction: status update + auditLogs row ('rfq_closed') with the real
 *   before/after — the log and the write succeed or fail together.
 * - After the commit the closure is broadcast (fire-and-forget) to the
 *   token-gated `rfq:<rfqId>` room so buyers/suppliers watching this RFQ see
 *   it close live. The DB write is the source of truth; the socket service
 *   being down never fails the request (clients degrade to polling).
 */

const closeSchema = z.object({ status: z.enum(['closed']) }).strict()

/** Shared loader for both verbs — detail projection with buyer + supplier names. */
async function loadRfqDetail(id: string) {
  return db.rfqRequests.findUnique({
    where: { id },
    include: {
      buyer: { select: { id: true, buyerProfile: { select: { fullName: true } } } },
      items: true,
      quotes: {
        orderBy: { createdAt: 'desc' },
        include: { supplier: { select: { id: true, companyName: true } } },
      },
    },
  })
}

function serializeRfq(rfq: NonNullable<Awaited<ReturnType<typeof loadRfqDetail>>>) {
  return {
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
    createdAt: rfq.createdAt,
    updatedAt: rfq.updatedAt,
    buyer: { displayName: rfq.buyer.buyerProfile?.fullName ?? null },
    items: rfq.items.map((i) => ({
      id: i.id,
      productName: i.productName,
      specifications: i.specifications,
      quantity: i.quantity,
      unit: i.unit,
      targetPrice: i.targetPrice,
    })),
    quotes: rfq.quotes.map((q) => ({
      id: q.id,
      pricePerUnit: q.pricePerUnit,
      totalPrice: q.totalPrice,
      deliveryDays: q.deliveryDays,
      message: q.message,
      status: q.status,
      createdAt: q.createdAt,
      supplier: { displayName: q.supplier.companyName },
    })),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-rfq-detail', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const rfq = await loadRfqDetail(id)
    if (!rfq) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: serializeRfq(rfq) })
  } catch (error) {
    console.error('Admin RFQ detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-rfq-close', 20, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const body = await request.json().catch(() => null)
    const parsed = closeSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid request body', issues: flattened.fieldErrors },
        { status: 400 }
      )
    }

    const existing = await db.rfqRequests.findUnique({
      where: { id },
      select: { id: true, status: true, title: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'RFQ request not found' }, { status: 404 })
    }

    // Closing is a moderation act on a LIVE rfq — awarded/closed/expired are
    // final states for closing (an awarded RFQ has a real accepted quote).
    if (existing.status !== 'open' && existing.status !== 'quoted') {
      return NextResponse.json(
        { error: `Cannot close an RFQ with status "${existing.status}"` },
        { status: 409 }
      )
    }

    const [, updated] = await db.$transaction([
      db.rfqRequests.update({ where: { id }, data: { status: 'closed' } }),
      db.auditLogs.create({
        data: {
          actorId: auth.user.id,
          action: 'rfq_closed',
          entityType: 'rfqRequests',
          entityId: id,
          metadata: JSON.stringify({
            rfqId: id,
            before: existing.status,
            after: 'closed',
          }),
        },
      }),
    ])

    // Real-time closure notice into the token-gated rfq:<id> room (rooms are
    // token-issued by /api/realtime/room-token, rfq support Task 52-a).
    // Fire-and-forget: broadcastToRoom never throws; the DB write above is
    // the source of truth.
    await broadcastToRoom(`rfq:${id}`, 'rfq:status', { rfqId: id, status: 'closed' })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Admin RFQ close PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
