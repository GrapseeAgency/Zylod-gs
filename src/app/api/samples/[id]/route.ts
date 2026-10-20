import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * PATCH /api/samples/[id] — the sample state machine (Task 90).
 *
 *   requested → shipped     SHIP    — the SAMPLE'S SUPPLIER only (the buyer
 *           …cannot ship to themselves); optional samplePrice (≥ 0) is the
 *           supplier's honest declared value for the sample (0 = free).
 *   shipped → delivered     DELIVER — the BUYER confirms arrival.
 *   requested → cancelled   CANCEL  — either party, while nothing has shipped.
 *
 * Everything else is a REAL 409 that names the current state. A sample that
 * is not yours (neither its buyer nor its supplier) is a REAL 404 — the
 * platform's no-leak rule. Every transition:
 *   - audits into auditLogs (entityType 'sampleOrders', actor + role in metadata)
 *   - lands the other side a durable notification (prefs-checked) with a live
 *     'notification:new' push on their user room (sendNotification)
 *   - fires a live 'sample:status' tap on the seller:<supplierProfileId> room
 *     so the seller console refreshes without polling luck
 */

const SampleActionSchema = z
  .object({
    action: z.enum(['cancel', 'ship', 'deliver']),
    samplePrice: z.number().min(0).max(100_000).optional(),
  })
  .strict()

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'samples-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const sample = await db.sampleOrders.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, supplier: { select: { id: true, userId: true, companyName: true } } } },
      },
    })
    if (!sample) {
      return NextResponse.json({ error: 'Sample not found' }, { status: 404 })
    }

    const isBuyer = sample.buyerId === auth.user.id
    const supplierUserId = sample.product?.supplier?.userId ?? null
    const isSupplier = Boolean(supplierUserId) && supplierUserId === auth.user.id
    if (!isBuyer && !isSupplier) {
      return NextResponse.json({ error: 'Sample not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = SampleActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid sample action', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { action, samplePrice } = parsed.data

    // Role + state machine guards — every rejection states the truth.
    if (action === 'ship' && !isSupplier) {
      return NextResponse.json({ error: 'Only the supplier can ship the sample' }, { status: 403 })
    }
    if (action === 'deliver' && !isBuyer) {
      return NextResponse.json({ error: 'Only the buyer can confirm delivery' }, { status: 403 })
    }
    if (action === 'cancel' && sample.status !== 'requested') {
      return NextResponse.json(
        { error: `Cannot cancel — the sample is already ${sample.status}` },
        { status: 409 }
      )
    }
    if (action === 'ship' && sample.status !== 'requested') {
      return NextResponse.json(
        { error: `Cannot ship — the sample is already ${sample.status}` },
        { status: 409 }
      )
    }
    if (action === 'deliver' && sample.status !== 'shipped') {
      return NextResponse.json(
        { error: `Cannot confirm delivery — the sample is ${sample.status}, not shipped` },
        { status: 409 }
      )
    }

    const nextStatus =
      action === 'cancel' ? 'cancelled' : action === 'ship' ? 'shipped' : 'delivered'

    const updated = await db.sampleOrders.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(action === 'ship' && samplePrice !== undefined ? { samplePrice } : {}),
      },
    })

    const role = isBuyer ? 'buyer' : 'supplier'
    const auditAction =
      action === 'cancel' ? 'sample_cancelled' : action === 'ship' ? 'sample_shipped' : 'sample_delivered'
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: auditAction,
        entityType: 'sampleOrders',
        entityId: id,
        metadata: JSON.stringify({ role, from: sample.status, to: nextStatus }),
      },
    })

    // The OTHER side is told — durable + live:
    const productLabel = sample.product?.name || 'a sample'
    if (isBuyer && supplierUserId) {
      await sendNotification({
        userId: supplierUserId,
        type: 'order',
        title:
          action === 'cancel'
            ? `Sample cancelled: ${productLabel}`
            : `Sample delivered: ${productLabel}`,
        body:
          action === 'cancel'
            ? 'The buyer cancelled their sample request before shipment.'
            : 'The buyer confirmed the sample arrived. A bulk order may follow.',
        relatedEntityId: id,
      })
    } else if (isSupplier && sample.buyerId) {
      await sendNotification({
        userId: sample.buyerId,
        type: 'order',
        title: action === 'ship' ? `Your sample is on its way: ${productLabel}` : `Sample cancelled: ${productLabel}`,
        body:
          action === 'ship'
            ? `${sample.product?.supplier?.companyName || 'The supplier'} shipped your sample${samplePrice ? ` (declared value ৳${samplePrice})` : ''}.`
            : 'The supplier cancelled the sample request before shipment.',
        relatedEntityId: id,
      })
    }

    // Seller console live tap (supplier side refreshes without polling).
    if (sample.product?.supplier?.id) {
      void broadcastToRoom(`seller:${sample.product.supplier.id}`, 'sample:status', {
        sampleId: id,
        status: nextStatus,
        action,
        role,
      })
    }

    return NextResponse.json({ success: true, data: { sample: updated } })
  } catch (err) {
    console.error('PATCH /api/samples/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update sample' }, { status: 500 })
  }
}
