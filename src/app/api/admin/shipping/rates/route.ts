import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { weightWindowsOverlap } from '@/lib/shipping'

/**
 * Admin shipping rates (Task 94) — the price book itself. A rate says:
 * moving weight in [weightMin, weightMax] to zone Z by method M costs
 * `price`, and is FREE once the order subtotal crosses `freeAbove`.
 *
 * POST/PATCH refuse two rates of the SAME zone+method fighting over the
 * same kilogram (409 with the conflicting rate's band) — a buyer must
 * never be shown two prices for one weight. Zone and method must exist
 * (404 with the missing side named). GET serves the full book with zone +
 * method names resolved.
 */

const RateCreateSchema = z
  .object({
    zoneId: z.string().trim().min(1).max(64),
    methodId: z.string().trim().min(1).max(64),
    weightMin: z.number().min(0).max(100_000),
    weightMax: z.number().min(0).max(100_000).nullable().optional(),
    price: z.number().min(0).max(1_000_000),
    freeAbove: z.number().min(0).max(10_000_000).nullable().optional(),
  })
  .strict()
  .refine((v) => v.weightMax === undefined || v.weightMax === null || v.weightMax > v.weightMin, {
    message: 'weightMax must be greater than weightMin',
    path: ['weightMax'],
  })

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {}
}

function shape(r: {
  id: string
  zoneId: string
  methodId: string
  weightMin: number
  weightMax: number | null
  price: number
  freeAbove: number | null
  zone?: { name: string } | null
  method?: { name: string } | null
}) {
  return {
    id: r.id,
    zoneId: r.zoneId,
    methodId: r.methodId,
    zoneName: r.zone?.name ?? null,
    methodName: r.method?.name ?? null,
    weightMin: r.weightMin,
    weightMax: r.weightMax,
    price: r.price,
    freeAbove: r.freeAbove,
  }
}

async function assertNoConflict(
  zoneId: string,
  methodId: string,
  band: { weightMin: number; weightMax: number | null },
  excludeId?: string
): Promise<{ id: string; weightMin: number; weightMax: number | null } | null> {
  const siblings = await db.shippingRates.findMany({ where: { zoneId, methodId, ...(excludeId ? { id: { not: excludeId } } : {}) } })
  for (const s of siblings) {
    if (weightWindowsOverlap(band, s)) return s
  }
  return null
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-shipping', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rates = await db.shippingRates.findMany({
      orderBy: [{ zoneId: 'asc' }, { methodId: 'asc' }, { weightMin: 'asc' }],
      include: { zone: { select: { name: true } }, method: { select: { name: true } } },
    })
    return NextResponse.json({ success: true, data: rates.map(shape), count: rates.length })
  } catch (err) {
    console.error('Admin shipping rates GET failed:', err)
    return NextResponse.json({ error: 'Failed to load shipping rates' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-shipping', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = RateCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid rate payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const zone = await db.shippingZones.findUnique({ where: { id: parsed.data.zoneId }, select: { id: true, name: true } })
    if (!zone) return NextResponse.json({ error: 'Shipping zone not found' }, { status: 404 })
    const method = await db.shippingMethods.findUnique({ where: { id: parsed.data.methodId }, select: { id: true, name: true } })
    if (!method) return NextResponse.json({ error: 'Shipping method not found' }, { status: 404 })

    const band = { weightMin: parsed.data.weightMin, weightMax: parsed.data.weightMax ?? null }
    const conflict = await assertNoConflict(parsed.data.zoneId, parsed.data.methodId, band)
    if (conflict) {
      return NextResponse.json(
        {
          error: `This weight band overlaps an existing rate for ${zone.name} × ${method.name} ([${conflict.weightMin}kg, ${conflict.weightMax === null ? '∞' : `${conflict.weightMax}kg`}]).`,
          conflictId: conflict.id,
        },
        { status: 409 }
      )
    }

    const rate = await db.shippingRates.create({
      data: {
        zoneId: parsed.data.zoneId,
        methodId: parsed.data.methodId,
        weightMin: parsed.data.weightMin,
        weightMax: parsed.data.weightMax ?? null,
        price: parsed.data.price,
        freeAbove: parsed.data.freeAbove ?? null,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'shipping_rate_created',
        entityType: 'shippingRates',
        entityId: rate.id,
        metadata: JSON.stringify({ zone: zone.name, method: method.name, ...band, price: rate.price, freeAbove: rate.freeAbove }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'rate', id: rate.id, action: 'created' })

    return NextResponse.json({ success: true, data: shape(rate) }, { status: 201 })
  } catch (err) {
    console.error('Admin shipping rates POST failed:', err)
    return NextResponse.json({ error: 'Failed to create shipping rate' }, { status: 500 })
  }
}
