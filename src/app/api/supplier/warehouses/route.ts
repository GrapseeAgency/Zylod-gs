import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { resolveSupplierProfile } from '@/lib/supplier-scope'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { WAREHOUSE_CAP, warehouseSchema, shapeOwner, tapAllAdmins } from '@/lib/warehouses'

/**
 * Task 98: THE WAREHOUSE RAIL — supplierProfiles has carried
 * warehouseLocations since day one (and GET /api/suppliers/[id] already
 * projects them as additionalLocations), but NOTHING could write a row and
 * no storefront surface displayed one. Now a supplier manages their real
 * ship-from locations and buyers see them on the store. House contract:
 * profile gate 403, rate limits, Zod STRICT, cap 8 (a wall of warehouses is
 * a trust smell, same doctrine as the 12-cert cap), audits, admin-room taps.
 */

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'warehouses-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json({ error: 'Supplier profile required', code: 'SUPPLIER_PROFILE_REQUIRED' }, { status: 403 })
    }
    const rows = await db.warehouseLocations.findMany({
      where: { supplierId: profile.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json({ success: true, data: rows.map(shapeOwner), count: rows.length })
  } catch (error) {
    console.error('Warehouses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'warehouses-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json({ error: 'Supplier profile required', code: 'SUPPLIER_PROFILE_REQUIRED' }, { status: 403 })
    }
    const parsed = warehouseSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const data = parsed.data

    const existing = await db.warehouseLocations.findMany({
      where: { supplierId: profile.id },
      select: { id: true },
    })
    if (existing.length >= WAREHOUSE_CAP) {
      return NextResponse.json(
        { error: `A store can list at most ${WAREHOUSE_CAP} warehouse locations — remove one to add another` },
        { status: 409 }
      )
    }

    const row = await db.warehouseLocations.create({
      data: {
        supplierId: profile.id,
        name: data.name,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        district: data.district,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        isActive: data.isActive ?? true,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'warehouse_added',
        entityType: 'warehouseLocations',
        entityId: row.id,
        metadata: JSON.stringify({ name: row.name, city: row.city, district: row.district }),
      },
    })
    await tapAllAdmins('warehouse:changed', {
      action: 'added',
      supplierId: profile.id,
      companyName: profile.companyName,
      warehouseId: row.id,
      name: row.name,
      district: row.district,
    })

    return NextResponse.json({ success: true, data: shapeOwner(row), message: 'Warehouse location added' }, { status: 201 })
  } catch (error) {
    console.error('Warehouses POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
