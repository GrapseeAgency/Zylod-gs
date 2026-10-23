import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/reviews — the seller's reviews console. REAL buyer
 * reviews of BOTH kinds the platform persists:
 *   kind 'product' — db.reviews joined via products.supplierId = my profile
 *                    (verifiedPurchase, product name/thumbnail attached);
 *   kind 'store'   — db.supplierReviews where supplierId = my profile (the
 *                    verified-purchase-gated store rail, Task 105 writer).
 * Audit unit 18 found the store rail was a one-sided circuit: buyers could
 * write store reviews but NO seller surface ever read them. Both lists are
 * merged newest-first (50 each, capped at 50 combined), with per-kind honest
 * aggregates. A supplier with no reviews gets an honest empty list — never
 * fabricated praise.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-reviews', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const [reviews, storeReviews] = await Promise.all([
      db.reviews.findMany({
        where: { product: { supplierId: profile.id } },
        select: {
          id: true,
          rating: true,
          comment: true,
          verifiedPurchase: true,
          createdAt: true,
          product: { select: { id: true, name: true, thumbnailUrl: true, supplierId: true } },
          buyer: {
            select: {
              id: true,
              buyerProfile: { select: { fullName: true, businessName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.supplierReviews.findMany({
        where: { supplierId: profile.id },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          buyer: {
            select: {
              id: true,
              buyerProfile: { select: { fullName: true, businessName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    const productRows = reviews.map((review) => ({
      id: review.id,
      kind: 'product' as const,
      supplierId: review.product.supplierId,
      rating: review.rating,
      comment: review.comment,
      verifiedPurchase: review.verifiedPurchase,
      createdAt: review.createdAt,
      productName: review.product.name,
      productId: review.product.id,
      productThumbnail: review.product.thumbnailUrl,
      buyerName:
        review.buyer.buyerProfile?.businessName ||
        review.buyer.buyerProfile?.fullName ||
        'Anonymous buyer',
    }))

    const storeRows = storeReviews.map((review) => ({
      id: review.id,
      kind: 'store' as const,
      supplierId: profile.id,
      rating: review.rating,
      comment: review.comment,
      // The store rail's writer enforces a real delivered order from this
      // supplier before the row can exist (POST /api/suppliers/[id]/reviews) —
      // so every row here IS a verified purchase by construction.
      verifiedPurchase: true,
      createdAt: review.createdAt,
      productName: null,
      productId: null,
      productThumbnail: null,
      buyerName:
        review.buyer.buyerProfile?.businessName ||
        review.buyer.buyerProfile?.fullName ||
        'Anonymous buyer',
    }))

    // Newest first across both rails, capped at 50 combined.
    const merged = [...productRows, ...storeRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)

    const avg = (rows: Array<{ rating: number }>) =>
      rows.length > 0
        ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 10) / 10
        : 0

    return NextResponse.json({
      success: true,
      data: {
        // Headline aggregates stay the PRODUCT rating (the marketplace-facing
        // number); the store rail carries its own honest pair below.
        averageRating: avg(productRows),
        totalReviews: productRows.length,
        storeAverageRating: avg(storeRows),
        storeTotalReviews: storeRows.length,
        reviews: merged,
      },
    })
  } catch (error) {
    console.error('Supplier reviews GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
