import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/rankings — REAL ranking of the signed-in supplier's own
 * products by soldCount (top 10, actual numbers from the products table).
 * The previous fabricated "Gold Supplier tier / platform-wide rank" payload
 * is gone: nothing outside this supplier's own data exists to rank against.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-rankings', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const topProducts = await db.products.findMany({
      where: { supplierId: profile.id },
      orderBy: { soldCount: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        soldCount: true,
        stockQuantity: true,
        ratingAvg: true,
        reviewCount: true,
        unit: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalProducts: topProducts.length,
        // Platform-wide rank/tier would require real marketplace-wide data
        // this endpoint does not derive — honest nulls instead of a fabricated
        // "Gold Supplier" scorecard.
        platformRank: null,
        tier: null,
        products: topProducts.map((p, index) => ({
          rank: index + 1,
          id: p.id,
          name: p.name,
          soldCount: p.soldCount,
          stockQuantity: p.stockQuantity,
          ratingAvg: p.ratingAvg,
          reviewCount: p.reviewCount,
          unit: p.unit,
        })),
      },
    })
  } catch (error) {
    console.error('Supplier rankings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
