import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/warehouses — PUBLIC ship-from directory (audit unit 21). The
 * warehouse-locator page used to render three hard-coded fictional
 * facilities ("85% Utilized", invented distances) while the REAL
 * warehouseLocations rows — which suppliers manage through the Task 98 rail
 * and GET /api/suppliers/[id] already exposes per-store — had no public
 * directory read at all. This endpoint serves the real rows of ACTIVE
 * suppliers only, joined with the company name. Read-only, rate-limited,
 * no auth by design (a warehouse directory is pre-order public information).
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'warehouses-public', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const rows = await db.warehouseLocations.findMany({
      where: {
        isActive: true,
        supplier: { verificationStatus: 'approved' },
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        district: true,
        createdAt: true,
        supplier: {
          select: { id: true, companyName: true, ratingAvg: true, ratingCount: true, verificationStatus: true },
        },
      },
      orderBy: [{ district: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    })

    const shaped = rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      district: r.district,
      addressLine1: r.addressLine1,
      addressLine2: r.addressLine2,
      supplierId: r.supplier.id,
      companyName: r.supplier.companyName,
      ratingAvg: r.supplier.ratingAvg,
      ratingCount: r.supplier.ratingCount,
      verificationStatus: r.supplier.verificationStatus,
    }))

    // Honest search across the REAL fields only (name/city/district/company).
    const filtered = q
      ? shaped.filter((r) =>
          [r.name, r.city, r.district, r.companyName, r.addressLine1]
            .filter((v): v is string => typeof v === 'string')
            .some((v) => v.toLowerCase().includes(q))
        )
      : shaped

    const districts = [...new Set(shaped.map((r) => r.district))].sort()

    return NextResponse.json({
      success: true,
      data: filtered,
      districts,
      count: filtered.length,
      total: shaped.length,
    })
  } catch (error) {
    console.error('Public warehouses GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
