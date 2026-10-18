import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/reviews — REAL buyer reviews for the signed-in supplier's
 * products (reviews joined via products.supplierId = my profile). Includes
 * the honest rating average computed from those rows. A supplier with no
 * reviews gets an honest empty list — never fabricated praise.
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-reviews', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const reviews = await db.reviews.findMany({
      where: { product: { supplierId: profile.id } },
      include: {
        product: { select: { id: true, name: true, thumbnailUrl: true } },
        buyer: {
          select: {
            id: true,
            buyerProfile: { select: { fullName: true, businessName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const totalReviews = reviews.length
    const ratingAvg = totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : 0

    const data = reviews.map((review) => ({
      id: review.id,
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

    return NextResponse.json({
      success: true,
      data: {
        averageRating: ratingAvg,
        totalReviews,
        reviews: data,
      },
    })
  } catch (error) {
    console.error('Supplier reviews GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
