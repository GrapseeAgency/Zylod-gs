import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * THE INSPECTION RAIL (Task 91) — "have someone check it before you accept
 * the bulk shipment". The inspectionRequests table existed in the schema
 * from day one with NO route and NO UI. This is the buyer side:
 *
 * POST /api/inspections — request an inspection of the buyer's OWN order:
 *   - 401-first, then 'inspections-create' 10/min.
 *   - The order must exist AND belong to this buyer — a foreign id is a REAL
 *     404 (the platform's no-leak rule, same as order detail).
 *   - inspectorType 'self' (the buyer's own QC team) or 'third_party' (the
 *     platform coordinates an agency) — the buyer declares intent; only an
 *     ADMIN moves the request through pending → scheduled → completed/failed.
 *   - One ACTIVE (pending|scheduled) inspection per order → 409; a completed
 *     or failed one does not block a fresh look at a NEW shipment.
 *   - EVERY admin is told: a durable notification each + a live
 *     'inspection:new' tap on their admin:<id> room (fire-and-forget; the
 *     DB row is the truth, the 30s poll degrades).
 *
 * GET /api/inspections — the buyer's own inspections, newest first, order
 * number embedded, report URL only present when an admin actually recorded
 * one (never invented).
 */

const InspectionCreateSchema = z
  .object({
    orderId: z.string().trim().min(1).max(64),
    inspectorType: z.enum(['self', 'third_party']).default('self'),
    note: z.string().trim().max(500).optional(),
  })
  .strict()

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: clients degrade to the 30s poll.
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'inspections-create', 10, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsed = InspectionCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid inspection request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { orderId, inspectorType, note } = parsed.data

    const order = await db.orders.findFirst({
      where: { id: orderId, buyerId: auth.user.id },
      select: { id: true, orderNumber: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const activeDuplicate = await db.inspectionRequests.findFirst({
      where: { orderId, status: { in: ['pending', 'scheduled'] } },
      select: { id: true },
    })
    if (activeDuplicate) {
      return NextResponse.json(
        { error: 'This order already has an inspection in progress', inspectionId: activeDuplicate.id },
        { status: 409 }
      )
    }

    const inspection = await db.inspectionRequests.create({
      data: {
        orderId,
        buyerId: auth.user.id,
        inspectorType,
        status: 'pending',
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'inspection_requested',
        entityType: 'inspectionRequests',
        entityId: inspection.id,
        metadata: JSON.stringify({ orderId, orderNumber: order.orderNumber, inspectorType, note: note ?? null }),
      },
    })

    // EVERY admin is told — durable each:
    const buyerProfile = await db.buyerProfiles.findUnique({
      where: { userId: auth.user.id },
      select: { fullName: true },
    })
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(
      admins.map((a) =>
        sendNotification({
          userId: a.id,
          type: 'order',
          title: `Inspection requested — ${order.orderNumber}`,
          body: `${buyerProfile?.fullName || 'A buyer'} asked for a ${inspectorType === 'third_party' ? 'third-party' : 'self'} inspection of order ${order.orderNumber}${note ? `: "${note.slice(0, 160)}"` : ''}.`,
          relatedEntityId: inspection.id,
        })
      )
    )
    // PLUS one live tap per admin room:
    void tapAllAdmins('inspection:new', {
      inspectionId: inspection.id,
      orderId,
      orderNumber: order.orderNumber,
      inspectorType,
    })

    return NextResponse.json(
      { success: true, data: { inspectionId: inspection.id, status: inspection.status } },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/inspections error:', err)
    return NextResponse.json({ error: 'Failed to request inspection' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'inspections-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.inspectionRequests.findMany({
      where: { buyerId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: { order: { select: { orderNumber: true, totalAmount: true } } },
    })

    const inspections = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      orderTotal: r.order?.totalAmount ?? null,
      inspectorType: r.inspectorType,
      status: r.status,
      reportUrl: r.reportUrl,
      scheduledAt: r.scheduledAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({ success: true, data: { inspections } })
  } catch (err) {
    console.error('GET /api/inspections error:', err)
    return NextResponse.json({ error: 'Failed to load inspections' }, { status: 500 })
  }
}
