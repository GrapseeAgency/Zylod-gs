import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * REAL reviews API — every review is persisted in the `reviews` table.
 * - POST requires buyer auth, a real productId, rating 1–5.
 * - verifiedPurchase is computed from the buyer's REAL order history.
 * - Product ratingAvg/reviewCount are recomputed from actual rows.
 * - Failures return the real error; success is never simulated.
 */
export async function GET(request: NextRequest) {
  try {
    const productId = request.nextUrl.searchParams.get('productId')
    if (!productId) {
      return NextResponse.json({ error: 'productId query parameter is required' }, { status: 400 })
    }

    const reviews = await db.reviews.findMany({
      where: { productId, replyToId: null },
      include: {
        buyer: { select: { buyerProfile: { select: { fullName: true, businessName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({
      success: true,
      data: reviews.map((r) => ({
        id: r.id,
        productId: r.productId,
        rating: r.rating,
        comment: r.comment,
        images: r.images ? JSON.parse(r.images) : [],
        verifiedPurchase: r.verifiedPurchase,
        createdAt: r.createdAt.toISOString(),
        buyerName: r.buyer?.buyerProfile?.businessName || r.buyer?.buyerProfile?.fullName || 'Buyer',
      })),
    })
  } catch (error) {
    console.error('Reviews GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['buyer'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'You must be signed in as a buyer to write a review' }, { status: 401 })
    }
    const buyerId = auth.user.id

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const productId = typeof body.productId === 'string' ? body.productId.trim() : ''
    const rating = Math.floor(Number(body.rating))
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
    const durability = typeof body.durability === 'string' ? body.durability.trim() : ''

    // Media: ONLY real files previously uploaded to this server are accepted.
    // External URLs (unsplash, blob:, data:, absolute http links) are rejected
    // so fake/broken imagery can never enter the reviews system.
    let imagesJson: string | null = null
    if (Array.isArray(body.images) && body.images.length > 0) {
      const urls = body.images
        .filter((u: unknown): u is string => typeof u === 'string')
        .map((u: string) => u.trim())
        .filter((u: string) => u.startsWith('/uploads/review-media/'))
        .slice(0, 5)
      if (urls.length !== body.images.length) {
        return NextResponse.json(
          { error: 'Review images must be uploaded through the media upload endpoint first' },
          { status: 400 }
        )
      }
      imagesJson = JSON.stringify(urls)
    }

    if (!productId || productId === 'sample-product-id') {
      return NextResponse.json({ error: 'A real productId is required to review' }, { status: 400 })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }
    if (!comment && !title) {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 })
    }

    const product = await db.products.findUnique({ where: { id: productId }, select: { id: true, name: true } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found — you can only review real catalog products' }, { status: 404 })
    }

    // Verified purchase = the buyer actually has this product in a real order
    const purchased = await db.orderItems.findFirst({
      where: {
        productId,
        subOrder: { order: { buyerId } },
      },
      select: { id: true },
    })

    // Store title (and durability context) inside comment — the schema keeps
    // one text field, and no user-provided text is silently dropped.
    const storedComment = [title, comment, durability ? `(Durability: ${durability})` : '']
      .filter(Boolean)
      .join('\n\n')

    const review = await db.$transaction(async (tx) => {
      const created = await tx.reviews.create({
        data: {
          productId,
          buyerId,
          rating,
          comment: storedComment,
          images: imagesJson,
          verifiedPurchase: Boolean(purchased),
        },
      })

      // Recompute aggregates from REAL rows only
      const agg = await tx.reviews.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true },
      })
      await tx.products.update({
        where: { id: productId },
        data: {
          ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
          reviewCount: agg._count.id,
        },
      })

      return created
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: review.id,
          verifiedPurchase: review.verifiedPurchase,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Reviews POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
