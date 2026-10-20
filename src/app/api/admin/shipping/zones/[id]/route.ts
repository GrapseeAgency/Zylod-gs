import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { parseDistricts } from '@/lib/shipping'

/**
 * PATCH /api/admin/shipping/zones/[id] — rename / edit districts / toggle.
 * District edits re-run the cross-zone conflict check (409 with the owning
 * zone named). DELETE removes the zone — its rates go with it (Cascade),
 * and that is exactly what the response reports so no admin deletes a
 * price book by accident without seeing the cost.
 */

const ZonePatchSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    districts: z.array(z.string().trim().min(1).max(60)).min(1).max(64).optional(),
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
    return { auth: null, rl: null, early: NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 }) }
  }
  const rl = checkRateLimit(request, 'admin-shipping', 30, 60 * 1000)
  if (!rl.ok) return { auth: null, rl: null, early: rateLimitResponse(rl) }
  return { auth, rl, early: null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await guard(request)
  if (g.early) return g.early

  try {
    const { id } = await params
    const existing = await db.shippingZones.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping zone not found' }, { status: 404 })
    }

    const parsed = ZonePatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid zone payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const nextDistricts = parsed.data.districts ? parsed.data.districts.map((d) => d.trim()).join(',') : existing.districts
    const stillActive = parsed.data.isActive ?? existing.isActive

    // Cross-zone district conflicts (only among ACTIVE zones; a district
    // must resolve to exactly one price book).
    if (stillActive) {
      const wanted = new Set(parseDistricts(nextDistricts).map((d) => d.toLowerCase()))
      const others = await db.shippingZones.findMany({
        where: { isActive: true, id: { not: id } },
        select: { id: true, name: true, districts: true },
      })
      for (const o of others) {
        for (const d of parseDistricts(o.districts)) {
          if (wanted.has(d.toLowerCase())) {
            return NextResponse.json(
              { error: `District "${d}" is already covered by zone "${o.name}".` },
              { status: 409 }
            )
          }
        }
      }
    }

    const zone = await db.shippingZones.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.districts ? { districts: nextDistricts } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_zone_updated',
        entityType: 'shippingZones',
        entityId: zone.id,
        metadata: JSON.stringify({ name: zone.name, isActive: zone.isActive }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'zone', id: zone.id, action: 'updated' })

    return NextResponse.json({ success: true, data: { id: zone.id, name: zone.name, districts: parseDistricts(zone.districts), isActive: zone.isActive } })
  } catch (err) {
    console.error('Admin shipping zone PATCH failed:', err)
    return NextResponse.json({ error: 'Failed to update shipping zone' }, { status: 500 })
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
    const existing = await db.shippingZones.findUnique({
      where: { id },
      include: { _count: { select: { shippingRates: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Shipping zone not found' }, { status: 404 })
    }

    await db.shippingZones.delete({ where: { id } })

    await db.auditLogs.create({
      data: {
        actorId: g.auth!.user!.id,
        action: 'shipping_zone_deleted',
        entityType: 'shippingZones',
        entityId: id,
        metadata: JSON.stringify({ name: existing.name, removedRates: existing._count.shippingRates }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'zone', id, action: 'deleted' })

    return NextResponse.json({ success: true, data: { id, removed: true, removedRates: existing._count.shippingRates } })
  } catch (err) {
    console.error('Admin shipping zone DELETE failed:', err)
    return NextResponse.json({ error: 'Failed to delete shipping zone' }, { status: 500 })
  }
}
