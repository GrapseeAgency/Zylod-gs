import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

/**
 * Admin management of delivery assignments (ADMIN ONLY).
 *
 * POST   /api/admin/deliveries/assignments  — assign a driver to a sub-order
 * GET    /api/admin/deliveries/assignments?orderId=…&subOrderId=…
 *
 * Assignments are what make live tracking possible: the driver's phone can
 * only POST pings for sub-orders it holds an ACTIVE assignment for, and the
 * customer's live map only renders while such an assignment exists. There
 * is deliberately no self-assignment path for drivers.
 */

const AssignSchema = z.object({
  subOrderId: z.string().min(1),
  driverId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Admin authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'admin-assign', 60, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  const { subOrderId, driverId } = parsed.data

  try {
    const driver = await db.users.findUnique({ where: { id: driverId } })
    if (!driver) {
      return NextResponse.json({ error: 'Driver user not found' }, { status: 404 })
    }
    if (driver.userType !== 'driver') {
      return NextResponse.json(
        {
          error: `User ${driverId} is a '${driver.userType}' account, not a driver. Create a driver account first (POST /api/admin/deliveries/drivers).`,
        },
        { status: 400 }
      )
    }
    if (driver.accountStatus !== 'active') {
      return NextResponse.json(
        { error: `Driver account is ${driver.accountStatus} — cannot be assigned.` },
        { status: 400 }
      )
    }

    const subOrder = await db.subOrders.findUnique({ where: { id: subOrderId } })
    if (!subOrder) {
      return NextResponse.json({ error: 'Sub-order not found' }, { status: 404 })
    }
    if (['delivered', 'cancelled', 'returned'].includes(subOrder.status)) {
      return NextResponse.json(
        {
          error: `Sub-order is already '${subOrder.status}' — a driver can only be assigned while it is still in transit.`,
        },
        { status: 400 }
      )
    }

    // One active driver per sub-order: supersede any previous assignment.
    const result = await db.$transaction(async (tx) => {
      await tx.deliveryAssignments.updateMany({
        where: { subOrderId, status: 'active' },
        data: { status: 'cancelled', completedAt: new Date() },
      })
      return tx.deliveryAssignments.create({
        data: { subOrderId, driverId, status: 'active' },
        include: {
          driver: { select: { id: true, email: true, phone: true } },
        },
      })
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'delivery.assignment.create',
        entityType: 'deliveryAssignments',
        entityId: result.id,
        metadata: JSON.stringify({ subOrderId, driverId }),
      },
    }).catch(() => {/* audit logging must never break assignment */})

    return NextResponse.json({
      ok: true,
      assignment: {
        id: result.id,
        subOrderId: result.subOrderId,
        status: result.status,
        assignedAt: result.assignedAt.toISOString(),
        driver: {
          id: result.driver.id,
          name: result.driver.email?.split('@')[0] || result.driver.phone || result.driver.id,
        },
      },
    })
  } catch (err) {
    console.error('Assignment POST error:', err)
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Admin authentication required' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')
  const subOrderId = searchParams.get('subOrderId')

  try {
    let subOrderIds: string[] | undefined
    if (subOrderId) {
      subOrderIds = [subOrderId]
    } else if (orderId) {
      const sos = await db.subOrders.findMany({
        where: { orderId },
        select: { id: true },
      })
      subOrderIds = sos.map((s) => s.id)
    }

    const assignments = await db.deliveryAssignments.findMany({
      where: subOrderIds ? { subOrderId: { in: subOrderIds } } : undefined,
      include: {
        driver: { select: { id: true, email: true, phone: true } },
        subOrder: { select: { id: true, status: true, orderId: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        subOrderId: a.subOrderId,
        orderId: a.subOrder.orderId,
        subOrderStatus: a.subOrder.status,
        status: a.status,
        assignedAt: a.assignedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() || null,
        driver: {
          id: a.driver.id,
          name: a.driver.email?.split('@')[0] || a.driver.phone || a.driver.id,
        },
      })),
    })
  } catch (err) {
    console.error('Assignment GET error:', err)
    return NextResponse.json(
      { error: 'Failed to list assignments' },
      { status: 500 }
    )
  }
}
