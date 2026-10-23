import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * The delivery-reschedule circuit (audit unit 20).
 *
 * POST /api/orders/[id]/reschedule — the BUYER-OWNER asks for a different
 *      delivery date/window on THEIR order. The old page faked the whole
 *      thing with a setTimeout "Delivery Rescheduled" screen and a
 *      hard-coded order number; nothing was ever persisted and no seller
 *      ever heard about it.
 *      Guards: 401-first (buyer only) → rate limit → ownership (foreign or
 *      phantom order = the SAME 404) → the order must still be reschedulable
 *      (delivered / cancelled / returned are final) → ONE pending request
 *      per order (409 — honest friction beats ambiguous duplicates) →
 *      Zod strict body.
 *      Persisted: orderReschedules row (status pending) + auditLogs row +
 *      a durable notifications row per supplier feed (the seller side of
 *      the circuit — the subOrders' suppliers' users in one findMany).
 *
 * GET /api/orders/[id]/reschedule — the owner (or admin) lists the
 *      reschedule requests for the order, newest first.
 */

const rescheduleSchema = z
  .object({
    requestedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'requestedDate must be a YYYY-MM-DD date'),
    window: z.enum(['morning', 'afternoon']),
    instructions: z.string().trim().max(500, 'Instructions are limited to 500 characters').optional().nullable(),
  })
  .strict()

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'order-reschedule-write', 5, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id } = await params
  const userId = auth.user.id // narrow once for the tx closure
  try {
    const parsed = rescheduleSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid reschedule payload' },
        { status: 400 }
      )
    }

    const order = await db.orders.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        buyerId: true,
        subOrders: { select: { supplierId: true, status: true } },
      },
    })
    // Foreign and phantom are the SAME 404 (no existence games).
    if (!order || order.buyerId !== userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    // A reschedule needs something still moving: an order whose EVERY slice
    // is delivered/cancelled/returned is final (status lives on subOrders —
    // the per-shipment slices ARE the delivery).
    const FINAL = ['delivered', 'cancelled', 'returned']
    const allFinal = order.subOrders.length > 0 && order.subOrders.every((s) => FINAL.includes(s.status))
    if (allFinal) {
      return NextResponse.json(
        { error: 'Every shipment on this order is already delivered/closed — there is no delivery left to reschedule.' },
        { status: 409 }
      )
    }

    // The requested date must be a real future day (not today-or-past).
    const requested = new Date(`${parsed.data.requestedDate}T00:00:00`)
    if (Number.isNaN(requested.getTime())) {
      return NextResponse.json({ error: 'requestedDate is not a valid date' }, { status: 400 })
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (requested.getTime() <= today.getTime()) {
      return NextResponse.json(
        { error: 'Pick a future date — the delivery cannot move into the past.' },
        { status: 400 }
      )
    }

    // One open request per order — a second pending would be ambiguous noise.
    const existingPending = await db.orderReschedules.findFirst({
      where: { orderId: order.id, status: 'pending' },
      select: { id: true },
    })
    if (existingPending) {
      return NextResponse.json(
        { error: 'This order already has a pending reschedule request — wait for the seller to respond or track it from the order page.' },
        { status: 409 }
      )
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.orderReschedules.create({
        data: {
          orderId: order.id,
          buyerId: userId,
          requestedDate: requested,
          window: parsed.data.window,
          instructions: parsed.data.instructions?.trim() || null,
        },
      })
      await tx.auditLogs.create({
        data: {
          actorId: userId,
          action: 'delivery_reschedule_requested',
          entityType: 'orderReschedules',
          entityId: row.id,
          metadata: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            requestedDate: parsed.data.requestedDate,
            window: parsed.data.window,
          }),
        },
      })
      return row
    })

    // Durable seller-side signal (cohesion): one row per supplier feed, the
    // supplier userIds resolved in ONE pass (subOrders carry supplierId; the
    // profiles map to users — same pattern as the order-created feed).
    const supplierIds = [...new Set(order.subOrders.map((s) => s.supplierId))]
    if (supplierIds.length > 0) {
      const sellerUsers = await db.supplierProfiles.findMany({
        where: { id: { in: supplierIds } },
        select: { id: true, userId: true },
      })
      const userIds = [...new Set(sellerUsers.map((s) => s.userId).filter((v): v is string => Boolean(v)))]
      if (userIds.length > 0) {
        await db.notifications.createMany({
          data: userIds.map((su) => ({
            userId: su,
            type: 'order',
            title: `Reschedule request — ${order.orderNumber}`,
            body: `The buyer asked to move delivery to ${parsed.data.requestedDate} (${parsed.data.window === 'morning' ? '8:00 AM–12:00 PM' : '12:00 PM–4:00 PM'}).${parsed.data.instructions ? ` Note: ${parsed.data.instructions.slice(0, 140)}` : ''}`,
            relatedEntityId: order.id,
          })),
        })
      }
    }

    return NextResponse.json(
      { success: true, data: { id: created.id, orderId: order.id, orderNumber: order.orderNumber, requestedDate: created.requestedDate.toISOString(), window: created.window, status: created.status }, message: 'Reschedule request sent — the supplier sees it now.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Order reschedule POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['buyer', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'order-reschedule-read', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  const { id } = await params
  try {
    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true },
    })
    if (!order || (auth.user.userType !== 'admin' && order.buyerId !== auth.user.id)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    const rows = await db.orderReschedules.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        requestedDate: r.requestedDate.toISOString(),
        window: r.window,
        instructions: r.instructions,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Order reschedule GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
