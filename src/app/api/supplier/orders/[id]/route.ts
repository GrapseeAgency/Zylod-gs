import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'
import { notifyOrderMilestone, notifyDeliveryDispatch } from '@/lib/notifications'
import { releaseEscrowInTx } from '@/lib/escrow'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * SECURITY-FIXED supplier order detail API (Task 51-a).
 *
 * BEFORE: any authenticated user (including buyers) could GET any order —
 * complete with buyer PII — and PATCH every subOrder's status/trackingNumber
 * via an unscoped updateMany({OR:[{id},{orderId:id}]}). Full IDOR.
 *
 * AFTER:
 *  - Both verbs gate on requireUserType(['supplier','admin']) → 401 first.
 *  - Suppliers are scoped to their own supplierProfiles row; EVERY query and
 *    patch only ever touches subOrders.supplierId === profile.id (the exact
 *    scoping GET /api/supplier/orders uses). Admin bypasses as trusted role.
 *  - A supplier who owns NO subOrder under the requested order gets the same
 *    404 as a nonexistent order — no existence leak.
 *  - PATCH validates against the REAL subOrders.status schema values
 *    (pending|confirmed|packed|shipped|delivered|cancelled|returned), Zod-parses
 *    (strict — unknown fields like courier/cancellationReason are rejected
 *    because subOrders has no such columns and nothing is fabricated),
 *    writes auditLogs with real before/after, notifies the buyer via
 *    notifyOrderMilestone, and broadcasts order:status to the order room —
 *    all ONLY after the DB write actually succeeded.
 */

const READ_LIMIT = { limit: 60, windowMs: 60_000 }
const WRITE_LIMIT = { limit: 30, windowMs: 5 * 60_000 }

/** The exact status values the subOrders schema documents. */
const SUBORDER_STATUSES = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const

const patchBodySchema = z
  .object({
    status: z.enum(SUBORDER_STATUSES, {
      message: `status must be one of: ${SUBORDER_STATUSES.join(' | ')}`,
    }),
    // The id of ONE subOrder under this order to update. Omitted = all of the
    // caller's own subOrders under this order (never another supplier's).
    subOrderId: z.string().min(1).optional(),
    // Real schema column on subOrders — set at dispatch time.
    trackingNumber: z.string().min(1).max(120).optional(),
    // Optional free-text note (e.g. a cancellation reason). Persisted in the
    // auditLogs metadata — the REAL audit trail — never silently dropped.
    note: z.string().max(500).optional(),
  })
  .strict()
  .refine((b) => b.status !== undefined || b.trackingNumber !== undefined, {
    message: 'Nothing to update: provide status and/or trackingNumber',
  })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Supplier authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-order-detail-read', READ_LIMIT.limit, READ_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let supplierScope: string | null = null
    if (auth.user.userType !== 'admin') {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile) {
        return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
      }
      supplierScope = profile.id
    }

    const order = await db.orders.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        buyer: {
          select: {
            id: true,
            email: true,
            phone: true,
            buyerProfile: {
              select: {
                fullName: true,
                businessName: true,
                businessType: true,
              }
            }
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // THE SCOPING: suppliers only ever see subOrders that belong to them.
    // Zero owned subOrders → identical 404 as a nonexistent order (no leak).
    const subOrders = await db.subOrders.findMany({
      where: {
        orderId: order.id,
        ...(supplierScope ? { supplierId: supplierScope } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        trackingHistory: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                unit: true,
                basePrice: true,
              }
            }
          }
        }
      }
    })

    if (supplierScope && subOrders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { ...order, subOrders }
    })
  } catch (error) {
    console.error('Seller order GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Supplier authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-order-status-write', WRITE_LIMIT.limit, WRITE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const body = await request.json().catch(() => null)
    const parsed = patchBodySchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid request body' },
        { status: 400 }
      )
    }
    const { status, subOrderId, trackingNumber, note } = parsed.data

    let supplierScope: string | null = null
    if (auth.user.userType !== 'admin') {
      const profile = await resolveSupplierProfile(auth.user)
      if (!profile) {
        return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
      }
      supplierScope = profile.id
    }

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, buyerId: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Ownership resolution FIRST — the patch set can only ever be subOrders
    // this caller owns under this order. Strangers get the same 404 as a
    // nonexistent order (no existence leak), matching the GET behaviour.
    const owned = await db.subOrders.findMany({
      where: {
        orderId: order.id,
        ...(supplierScope ? { supplierId: supplierScope } : {}),
      },
      select: {
        id: true,
        status: true,
        trackingNumber: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (owned.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const targets = subOrderId
      ? owned.filter((s) => s.id === subOrderId)
      : owned
    if (targets.length === 0) {
      // The subOrder exists but belongs to another supplier → no leak.
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const data: { status?: string; trackingNumber?: string } = {}
    if (status !== undefined) data.status = status
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber

    // Real before/after — per-subOrder updates return the persisted rows
    // (unlike updateMany), so the audit log and broadcast carry true values.
    const before = targets.map((t) => ({
      id: t.id,
      status: t.status,
      trackingNumber: t.trackingNumber,
    }))

    const after = await db.$transaction(async (tx) => {
      const rows: Array<{
        id: string
        status: string
        trackingNumber: string | null
        updatedAt: Date
      }> = []
      for (const t of targets) {
        const row = await tx.subOrders.update({
          where: { id: t.id },
          data,
          select: { id: true, status: true, trackingNumber: true, updatedAt: true },
        })
        rows.push(row)
      }
      // Task 71: DELIVERED releases this supplier's held escrow (the seller
      // has earned it). Idempotent — non-'held' rows are never re-flipped.
      if (status === 'delivered') {
        await releaseEscrowInTx(tx, order.id, supplierScope ?? undefined)
      }
      return rows
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'suborder_status_updated',
        entityType: 'subOrders',
        entityId: order.id,
        metadata: JSON.stringify({
          actorType: auth.user.userType,
          supplierId: supplierScope,
          orderId: order.id,
          orderNumber: order.orderNumber,
          ...(note !== undefined ? { note } : {}),
          before,
          after: after.map((r) => ({
            id: r.id,
            status: r.status,
            trackingNumber: r.trackingNumber,
            updatedAt: r.updatedAt.toISOString(),
          })),
        }),
      },
    })

    // Buyer milestone notification — only after the write succeeded.
    // Task 66: a single-shipment status change carries THAT shipment's id so
    // the buyer's notification deep-link lands on the shipment's order view.
    if (status !== undefined) {
      await notifyOrderMilestone(order.buyerId, order.orderNumber, status, order.id, targets.length === 1 ? targets[0].id : undefined)
    }
    // Task 66: shipping with a waybill on THIS path (the normal seller flow)
    // also dispatches the courier-in-transit push — previously only the
    // driver track endpoint notified, so buyers got the milestone but never
    // the "Consignment Waybill" message when their seller shipped.
    if (status === 'shipped') {
      for (const r of after) {
        if (r.trackingNumber) {
          await notifyDeliveryDispatch(order.buyerId, order.orderNumber, 'the supplier', r.trackingNumber, order.id, r.id)
        }
      }
    }

    // Real-time: push the persisted state into the order room (buyer tracking
    // + admin watch). Fire-and-forget; socket downtime never fails the API.
    for (const r of after) {
      void broadcastToRoom(`order:${order.id}`, 'order:status', {
        orderId: order.id,
        subOrderId: r.id,
        status: r.status,
        ...(r.trackingNumber !== null ? { trackingNumber: r.trackingNumber } : {}),
        updatedAt: r.updatedAt.toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        updated: after.map((r) => ({
          subOrderId: r.id,
          status: r.status,
          trackingNumber: r.trackingNumber,
          updatedAt: r.updatedAt.toISOString(),
        })),
      },
      message: `Updated ${after.length} ${after.length === 1 ? 'sub-order' : 'sub-orders'}`,
    })
  } catch (error) {
    console.error('Seller order PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
