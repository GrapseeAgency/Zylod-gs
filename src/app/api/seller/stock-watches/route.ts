import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/seller/stock-watches — the seller's RESTOCK DEMAND signal (Task 62).
 *
 * For every product this supplier owns: how many buyers currently hold an
 * ACTIVE back-in-stock watch on it (status='active' only — completed or
 * cancelled watches are not demand), alongside the product's live stock so
 * the seller can prioritize what to replenish first. Ordered by watchers
 * desc. Zero-watch products are not rows — this is a demand queue, not a
 * listing.
 *
 * Read-only. 401 unauthenticated → 403 no supplier profile → 30/min.
 */

const RATE_LIMIT = { limit: 30, windowMs: 60_000 }

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'seller-stock-watches', RATE_LIMIT.limit, RATE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  const profile = await resolveSupplierProfile(auth.user)
  if (!profile) {
    return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
  }

  try {
    const products = await db.products.findMany({
      where: { supplierId: profile.id },
      select: { id: true, name: true, stockQuantity: true, unit: true, isActive: true },
    })
    if (products.length === 0) {
      return NextResponse.json({ success: true, data: [], totalWatchers: 0 })
    }

    const productIds = products.map((p) => p.id)
    const grouped = await db.stockAlerts.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, status: 'active' },
      _count: { _all: true },
    })

    const countByProduct = new Map(grouped.map((g) => [g.productId, g._count._all]))
    const data = products
      .map((p) => ({ product: p, watchers: countByProduct.get(p.id) ?? 0 }))
      .filter((row) => row.watchers > 0)
      .sort((a, b) => b.watchers - a.watchers)
      .map(({ product, watchers }) => ({
        productId: product.id,
        productName: product.name,
        stockQuantity: product.stockQuantity,
        unit: product.unit,
        isActive: product.isActive,
        watchers,
      }))

    return NextResponse.json({
      success: true,
      data,
      totalWatchers: data.reduce((sum, r) => sum + r.watchers, 0),
    })
  } catch (error) {
    console.error('Seller stock-watches GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
