import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { weightWindowsOverlap } from '@/lib/shipping'

/**
 * PATCH /api/admin/shipping/rates/[id] — reband / reprice / set the free
 * threshold. Every edit re-runs the same-zone+method weight-window overlap
 * check (409 with the conflicting band), because a reband can silently
 * start fighting a sibling rate. DELETE removes the rate.
 */

const RatePatchSchema = z
  .object({
    weightMin: z.number().min(0).max(100_000).optional(),
    weightMax: z.number().min(0).max(100_000).nullable().optional(),
    price: z.number().min(0).max(1_000_000).optional(),
    freeAbove: z.number().min(0).max(10_000_000).nullable().optional(),
  })
  .strict()
  .refine((v) => {
    const min = v.weightMin
    const max = v.weightMax
    if (min === undefined || max === undefined || max === null) return true
    return max > min
  }, {
    message: 'weightMax must be greater than weightMin',
    path: ['weightMax'],
  })

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

  const rl = checkRateLimit(request, 'admin-shipping-item-write', 30, 60000)

  if (!rl.ok) return rateLimitResponse(rl)


  try {
    const { id } = await params
    const existing = await db.shippingRates.findUnique({
      where: { id },
      include: { zone: { select: { name: true } }, method: { select: { name: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping rate not found' }, { status: 404 })
    }

    const parsed = RatePatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid rate payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const band = {
      weightMin: parsed.data.weightMin ?? existing.weightMin,
      weightMax: parsed.data.weightMax !== undefined ? parsed.data.weightMax : existing.weightMax,
    }
    if (band.weightMax !== null && band.weightMax <= band.weightMin) {
      return NextResponse.json({ error: 'weightMax must be greater than weightMin' }, { status: 400 })
    }

    const siblings = await db.shippingRates.findMany({
      where: { zoneId: existing.zoneId, methodId: existing.methodId, id: { not: id } },
    })
    for (const s of siblings) {
      if (weightWindowsOverlap(band, s)) {
        return NextResponse.json(
          {
            error: `This weight band overlaps an existing rate for ${existing.zone?.name ?? 'this zone'} × ${existing.method?.name ?? 'this method'} ([${s.weightMin}kg, ${s.weightMax === null ? '∞' : `${s.weightMax}kg`}]).`,
            conflictId: s.id,
          },
          { status: 409 }
        )
      }
    }

    const rate = await db.shippingRates.update({
      where: { id },
      data: {
        ...(parsed.data.weightMin !== undefined ? { weightMin: parsed.data.weightMin } : {}),
        ...(parsed.data.weightMax !== undefined ? { weightMax: parsed.data.weightMax } : {}),
        ...(parsed.data.price !== undefined ? { price: parsed.data.price } : {}),
        ...(parsed.data.freeAbove !== undefined ? { freeAbove: parsed.data.freeAbove } : {}),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_rate_updated',
        entityType: 'shippingRates',
        entityId: rate.id,
        metadata: JSON.stringify({ weightMin: rate.weightMin, weightMax: rate.weightMax, price: rate.price, freeAbove: rate.freeAbove }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'rate', id: rate.id, action: 'updated' })

    return NextResponse.json({ success: true, data: { id: rate.id, weightMin: rate.weightMin, weightMax: rate.weightMax, price: rate.price, freeAbove: rate.freeAbove } })
  } catch (err) {
    console.error('Admin shipping rate PATCH failed:', err)
    return NextResponse.json({ error: 'Failed to update shipping rate' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard(request)
  if (g.early) return g.early

  const rl = checkRateLimit(request, 'admin-shipping-item-write', 30, 60000)

  if (!rl.ok) return rateLimitResponse(rl)


  try {
    const { id } = await params
    const existing = await db.shippingRates.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping rate not found' }, { status: 404 })
    }

    await db.shippingRates.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_rate_deleted',
        entityType: 'shippingRates',
        entityId: id,
        metadata: JSON.stringify({ zoneId: existing.zoneId, methodId: existing.methodId, weightMin: existing.weightMin, price: existing.price }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'rate', id, action: 'deleted' })

    return NextResponse.json({ success: true, data: { id, removed: true } })
  } catch (err) {
    console.error('Admin shipping rate DELETE failed:', err)
    return NextResponse.json({ error: 'Failed to delete shipping rate' }, { status: 500 })
  }
}
