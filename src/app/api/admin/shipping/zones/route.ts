import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { parseDistricts } from '@/lib/shipping'

/**
 * Admin shipping zones (Task 94) — GET lists EVERY zone with its districts
 * parsed + live rate counts; POST creates one. 401-first, 'admin-shipping'
 * rate limits, Zod strict, audited, and every admin's console is tapped
 * live ('shipping:changed').
 */

const ZoneCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    districts: z.array(z.string().trim().min(1).max(60)).min(1).max(64),
    isActive: z.boolean().default(true),
  })
  .strict()

/** Every admin's live room. */
async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {
    // Non-fatal: consoles degrade to the poll.
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-shipping', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const zones = await db.shippingZones.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { shippingRates: true } } },
    })
    return NextResponse.json({
      success: true,
      data: zones.map((z) => ({
        id: z.id,
        name: z.name,
        districts: parseDistricts(z.districts),
        isActive: z.isActive,
        rateCount: z._count.shippingRates,
        createdAt: z.createdAt.toISOString(),
      })),
      count: zones.length,
    })
  } catch (err) {
    console.error('Admin shipping zones GET failed:', err)
    return NextResponse.json({ error: 'Failed to load shipping zones' }, { status: 500 })
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
    const parsed = ZoneCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid zone payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // Districts must be unique within the platform's active zones — two
    // zones claiming the same district would give a buyer two different
    // prices for the same address.
    const duplicate = await db.shippingZones.findFirst({
      where: { isActive: true },
    })
    const wanted = new Set(parsed.data.districts.map((d) => d.toLowerCase()))
    if (duplicate) {
      const all = await db.shippingZones.findMany({ where: { isActive: true }, select: { id: true, name: true, districts: true } })
      for (const z of all) {
        for (const d of parseDistricts(z.districts)) {
          if (wanted.has(d.toLowerCase())) {
            return NextResponse.json(
              { error: `District "${d}" is already covered by zone "${z.name}".` },
              { status: 409 }
            )
          }
        }
      }
    }

    const zone = await db.shippingZones.create({
      data: { name: parsed.data.name, districts: parsed.data.districts.map((d) => d.trim()).join(','), isActive: parsed.data.isActive },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'shipping_zone_created',
        entityType: 'shippingZones',
        entityId: zone.id,
        metadata: JSON.stringify({ name: zone.name, districts: parsed.data.districts }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'zone', id: zone.id, action: 'created' })

    return NextResponse.json({ success: true, data: { id: zone.id, name: zone.name, districts: parseDistricts(zone.districts), isActive: zone.isActive } }, { status: 201 })
  } catch (err) {
    console.error('Admin shipping zones POST failed:', err)
    return NextResponse.json({ error: 'Failed to create shipping zone' }, { status: 500 })
  }
}
