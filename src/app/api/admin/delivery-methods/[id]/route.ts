import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { deliveryMethodPatchSchema, shapeAdminDeliveryMethod } from '@/lib/delivery-methods'

/**
 * Task 108: delivery methods — PATCH and DELETE per row. PATCH touches only
 * the keys that arrived (no defaults on the shared schema). isActive=false
 * parks a courier: the public reader filters isActive, so the option
 * vanishes from checkout while the console keeps the row — the same
 * draft/phantom semantics as every other curated rail.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-delivery-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.deliveryMethods.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Delivery method not found' }, { status: 404 })
    }
    const parsed = deliveryMethodPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const row = await db.deliveryMethods.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.price !== undefined ? { price: d.price } : {}),
        ...(d.estimatedDelivery !== undefined ? { estimatedDelivery: d.estimatedDelivery } : {}),
        ...(d.badge !== undefined ? { badge: d.badge } : {}),
        ...(d.icon !== undefined ? { icon: d.icon } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'delivery_method_updated',
        entityType: 'deliveryMethods',
        entityId: row.id,
        metadata: JSON.stringify({
          before: { name: existing.name, price: existing.price, isActive: existing.isActive },
          after: { name: row.name, price: row.price, isActive: row.isActive },
        }),
      },
    })
    await tapAllAdmins('delivery:changed', { action: 'updated', id: row.id, name: row.name, isActive: row.isActive })
    return NextResponse.json({ success: true, data: shapeAdminDeliveryMethod(row), message: 'Delivery method updated' })
  } catch (error) {
    console.error('Admin delivery methods PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-delivery-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.deliveryMethods.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Delivery method not found' }, { status: 404 })
    }
    await db.deliveryMethods.delete({ where: { id } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'delivery_method_deleted',
        entityType: 'deliveryMethods',
        entityId: existing.id,
        metadata: JSON.stringify({ name: existing.name, price: existing.price }),
      },
    })
    await tapAllAdmins('delivery:changed', { action: 'deleted', id: existing.id, name: existing.name })
    return NextResponse.json({ success: true, message: 'Delivery method deleted' })
  } catch (error) {
    console.error('Admin delivery methods DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
