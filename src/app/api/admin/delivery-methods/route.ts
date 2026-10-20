import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { deliveryMethodSchema, shapeAdminDeliveryMethod } from '@/lib/delivery-methods'

/**
 * Task 108: THE DELIVERY-METHODS RAIL (admin side). The checkout pages have
 * fetched GET /api/delivery-methods since day one; the honest empty state
 * ("No delivery methods have been configured yet") could never end because
 * nothing could write a row. This is the writer: admin-curated courier
 * options the buyer actually chooses from at checkout.
 *
 * House contract: requireUserType 401-first, rate limits, Zod STRICT,
 * audits + admin-room taps. The public reader stays as-is — it was honest
 * from day one (empty list, never invented couriers).
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-delivery-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const [rows, groupBy] = await Promise.all([
      db.deliveryMethods.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      db.deliveryMethods.groupBy({ by: ['isActive'], _count: { isActive: true } }),
    ])
    const stats = { total: 0, active: 0, inactive: 0 }
    for (const g of groupBy) {
      stats.total += g._count.isActive
      if (g.isActive) stats.active += g._count.isActive
      else stats.inactive += g._count.isActive
    }
    return NextResponse.json({ success: true, data: rows.map(shapeAdminDeliveryMethod), stats })
  } catch (error) {
    console.error('Admin delivery methods GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-delivery-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = deliveryMethodSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const row = await db.deliveryMethods.create({
      data: {
        name: d.name,
        description: d.description ?? null,
        price: d.price,
        estimatedDelivery: d.estimatedDelivery ?? null,
        badge: d.badge ?? null,
        icon: d.icon ?? 'truck',
        isActive: d.isActive ?? true,
        sortOrder: d.sortOrder ?? 0,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'delivery_method_created',
        entityType: 'deliveryMethods',
        entityId: row.id,
        metadata: JSON.stringify({ name: row.name, price: row.price, isActive: row.isActive }),
      },
    })
    await tapAllAdmins('delivery:changed', { action: 'created', id: row.id, name: row.name, isActive: row.isActive })
    return NextResponse.json({ success: true, data: shapeAdminDeliveryMethod(row), message: 'Delivery method created' }, { status: 201 })
  } catch (error) {
    console.error('Admin delivery methods POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
