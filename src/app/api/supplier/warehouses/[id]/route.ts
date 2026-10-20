import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { warehouseSchema, shapeOwner, tapAllAdmins } from '@/lib/warehouses'

/**
 * Task 98: owner-only mutations on one warehouse row. A foreign id is the
 * SAME 404 as a phantom id — a supplier learns nothing about another
 * supplier's locations. Every transition audits and taps the admin rooms.
 */

const patchSchema = warehouseSchema.partial()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'warehouses-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json({ error: 'Supplier profile required', code: 'SUPPLIER_PROFILE_REQUIRED' }, { status: 403 })
    }
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const existing = await db.warehouseLocations.findFirst({
      where: { id, supplierId: profile.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse location not found' }, { status: 404 })
    }
    const d = parsed.data
    const row = await db.warehouseLocations.update({
      where: { id: existing.id },
      data: {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.addressLine1 !== undefined && { addressLine1: d.addressLine1 }),
        ...(d.addressLine2 !== undefined && { addressLine2: d.addressLine2 || null }),
        ...(d.city !== undefined && { city: d.city }),
        ...(d.district !== undefined && { district: d.district }),
        ...(d.lat !== undefined && { lat: d.lat }),
        ...(d.lng !== undefined && { lng: d.lng }),
        ...(d.isActive !== undefined && { isActive: d.isActive }),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'warehouse_updated',
        entityType: 'warehouseLocations',
        entityId: row.id,
        metadata: JSON.stringify({
          ...(d.name !== undefined && { name: { from: existing.name, to: row.name } }),
          ...(d.isActive !== undefined && { isActive: { from: existing.isActive, to: row.isActive } }),
        }),
      },
    })
    await tapAllAdmins('warehouse:changed', {
      action: 'updated',
      supplierId: profile.id,
      companyName: profile.companyName,
      warehouseId: row.id,
      name: row.name,
      district: row.district,
    })
    return NextResponse.json({ success: true, data: shapeOwner(row), message: 'Warehouse location updated' })
  } catch (error) {
    console.error('Warehouse PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'warehouses-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json({ error: 'Supplier profile required', code: 'SUPPLIER_PROFILE_REQUIRED' }, { status: 403 })
    }
    const removed = await db.warehouseLocations.deleteMany({
      where: { id, supplierId: profile.id },
    })
    if (removed.count === 0) {
      return NextResponse.json({ error: 'Warehouse location not found' }, { status: 404 })
    }
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'warehouse_removed',
        entityType: 'warehouseLocations',
        entityId: id,
        metadata: JSON.stringify({}),
      },
    })
    await tapAllAdmins('warehouse:changed', {
      action: 'removed',
      supplierId: profile.id,
      companyName: profile.companyName,
      warehouseId: id,
    })
    return NextResponse.json({ success: true, message: 'Warehouse location removed' })
  } catch (error) {
    console.error('Warehouse DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
