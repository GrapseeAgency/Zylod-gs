import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * Admin shipping methods (Task 94) — the carrier vocabulary buyers choose
 * from (e.g. "Sundarban Courier — 2-4 days"). GET lists every row with its
 * live rate count; POST creates. 401-first, 'admin-shipping' limits, Zod
 * strict, audited, admin consoles tapped live.
 */

const MethodCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(200).optional(),
    estimatedDays: z.string().trim().max(60).optional(),
    isActive: z.boolean().default(true),
  })
  .strict()

async function tapAllAdmins(event: string, payload: unknown): Promise<void> {
  try {
    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })
    await Promise.all(admins.map((a) => broadcastToRoom(`admin:${a.id}`, event, payload)))
  } catch {}
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-shipping', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const methods = await db.shippingMethods.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { shippingRates: true } } },
    })
    return NextResponse.json({
      success: true,
      data: methods.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        estimatedDays: m.estimatedDays,
        isActive: m.isActive,
        rateCount: m._count.shippingRates,
      })),
      count: methods.length,
    })
  } catch (err) {
    console.error('Admin shipping methods GET failed:', err)
    return NextResponse.json({ error: 'Failed to load shipping methods' }, { status: 500 })
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
    const parsed = MethodCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid method payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const allMethods = await db.shippingMethods.findMany({ select: { id: true, name: true } })
    const clashHit = allMethods.find((m) => m.name.toLowerCase() === parsed.data.name.toLowerCase())
    if (clashHit) {
      return NextResponse.json({ error: `A shipping method named "${clashHit.name}" already exists.` }, { status: 409 })
    }

    const method = await db.shippingMethods.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        estimatedDays: parsed.data.estimatedDays ?? null,
        isActive: parsed.data.isActive,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'shipping_method_created',
        entityType: 'shippingMethods',
        entityId: method.id,
        metadata: JSON.stringify({ name: method.name }),
      },
    })
    await tapAllAdmins('shipping:changed', { kind: 'method', id: method.id, action: 'created' })

    return NextResponse.json({ success: true, data: { id: method.id, name: method.name, isActive: method.isActive } }, { status: 201 })
  } catch (err) {
    console.error('Admin shipping methods POST failed:', err)
    return NextResponse.json({ error: 'Failed to create shipping method' }, { status: 500 })
  }
}
