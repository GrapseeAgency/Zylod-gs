import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * PATCH /api/admin/shipping/methods/[id] — rename / describe / toggle.
 * DELETE removes the method and its rates (Cascade), reporting how many
 * prices went with it.
 */

const MethodPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(200).optional(),
    estimatedDays: z.string().trim().max(60).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {}
}

async function guard(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return { auth: null, early: NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 }) }
  }
  const rl = checkRateLimit(request, 'admin-shipping', 30, 60 * 1000)
  if (!rl.ok) return { auth: null, early: rateLimitResponse(rl) }
  return { auth, early: null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard(request)
  if (g.early) return g.early

  try {
    const { id } = await params
    const existing = await db.shippingMethods.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping method not found' }, { status: 404 })
    }

    const parsed = MethodPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid method payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    if (parsed.data.name) {
      const wanted = parsed.data.name
      const allMethods = await db.shippingMethods.findMany({ where: { id: { not: id } }, select: { id: true, name: true } })
      const clash = allMethods.find((m) => m.name.toLowerCase() === wanted.toLowerCase())
      if (clash) {
        return NextResponse.json({ error: `A shipping method named "${clash.name}" already exists.` }, { status: 409 })
      }
    }

    const method = await db.shippingMethods.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.estimatedDays !== undefined ? { estimatedDays: parsed.data.estimatedDays } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_method_updated',
        entityType: 'shippingMethods',
        entityId: method.id,
        metadata: JSON.stringify({ name: method.name, isActive: method.isActive }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'method', id: method.id, action: 'updated' })

    return NextResponse.json({ success: true, data: { id: method.id, name: method.name, isActive: method.isActive } })
  } catch (err) {
    console.error('Admin shipping method PATCH failed:', err)
    return NextResponse.json({ error: 'Failed to update shipping method' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard(request)
  if (g.early) return g.early

  try {
    const { id } = await params
    const existing = await db.shippingMethods.findUnique({
      where: { id },
      include: { _count: { select: { shippingRates: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping method not found' }, { status: 404 })
    }

    await db.shippingMethods.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_method_deleted',
        entityType: 'shippingMethods',
        entityId: id,
        metadata: JSON.stringify({ name: existing.name, removedRates: existing._count.shippingRates }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'method', id, action: 'deleted' })

    return NextResponse.json({ success: true, data: { id, removed: true, removedRates: existing._count.shippingRates } })
  } catch (err) {
    console.error('Admin shipping method DELETE failed:', err)
    return NextResponse.json({ error: 'Failed to delete shipping method' }, { status: 500 })
  }
}
