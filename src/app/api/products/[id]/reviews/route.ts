import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

function mapReview(review: {
  id: string
  rating: number
  comment: string | null
  images: string | null
  verifiedPurchase: boolean
  replyToId: string | null
  createdAt: Date
  buyer: { id: string; buyerProfile: { fullName: string | null; businessName: string | null; businessType: string | null } | null }
}) {
  let images: string[] = []
  try {
    if (review.images) images = JSON.parse(review.images)
  } catch { /* ignore malformed images */ }
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    images,
    verifiedPurchase: review.verifiedPurchase,
    replyToId: review.replyToId,
    createdAt: review.createdAt,
    buyer: {
      id: review.buyer.id,
      name: review.buyer.buyerProfile?.fullName || 'Anonymous',
      businessName: review.buyer.buyerProfile?.businessName || null,
      businessType: review.buyer.buyerProfile?.businessType || null,
    },
    sentiment: review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative',
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'newest'
    const ratingFilter = searchParams.get('rating')

    // Verify product exists
    const product = await db.products.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Build where clause — top-level reviews only (replies nested)
    const where: Record<string, unknown> = { productId: id, replyToId: null }
    if (ratingFilter) {
      const rating = parseInt(ratingFilter)
      if (rating >= 1 && rating <= 5) {
        where.rating = rating
      }
    }

    // Determine sort order
    const orderBy: Prisma.reviewsOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'highest':
          return { rating: 'desc' }
        case 'lowest':
          return { rating: 'asc' }
        default:
          return { createdAt: 'desc' }
      }
    })()

    const total = await db.reviews.count({ where })

    const reviews = await db.reviews.findMany({
      where,
      include: {
        buyer: {
          select: {
            id: true,
            buyerProfile: {
              select: {
                fullName: true,
                businessName: true,
                businessType: true,
              },
            },
          },
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            buyer: {
              select: {
                id: true,
                buyerProfile: {
                  select: {
                    fullName: true,
                    businessName: true,
                    businessType: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })

    // Calculate summary stats from ALL top-level reviews
    const allReviews = await db.reviews.findMany({
      where: { productId: id, replyToId: null },
      select: { rating: true, comment: true },
    })

    const totalReviews = allReviews.length
    const avgRating = totalReviews > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0

    const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
      rating: r,
      count: allReviews.filter(rev => rev.rating === r).length,
      percentage: totalReviews > 0
        ? Math.round((allReviews.filter(rev => rev.rating === r).length / totalReviews) * 100)
        : 0,
    }))

    // Simple sentiment analysis based on rating
    const sentimentSummary = {
      positive: allReviews.filter(r => r.rating >= 4).length,
      neutral: allReviews.filter(r => r.rating === 3).length,
      negative: allReviews.filter(r => r.rating <= 2).length,
    }

    // Map reviews with buyer info + nested replies
    const mappedReviews = reviews.map(review => ({
      ...mapReview(review),
      replies: (review.replies || []).map(reply => mapReview(reply)),
    }))

    return NextResponse.json({
      success: true,
      data: {
        reviews: mappedReviews,
        summary: {
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews,
          ratingDistribution,
          sentimentSummary,
        },
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Product reviews GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate — buyer identity comes from the token, never the body
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const buyerId = auth.user.id

    const { id } = await params
    const body = await request.json()
    const { rating, comment, images, replyToId } = body

    // Validate required fields
    if (!rating && !replyToId) {
      return NextResponse.json(
        { error: 'rating or replyToId is required' },
        { status: 400 }
      )
    }

    // For a top-level review, rating must be 1-5
    if (!replyToId && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: 'rating must be a number between 1 and 5' },
        { status: 400 }
      )
    }

    // Verify product exists
    const product = await db.products.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Verify buyer exists
    const buyer = await db.users.findUnique({ where: { id: buyerId } })
    if (!buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    // If replying, verify target review exists and belongs to this product
    if (replyToId) {
      const target = await db.reviews.findFirst({
        where: { id: replyToId, productId: id },
        select: { id: true },
      })
      if (!target) {
        return NextResponse.json({ error: 'Reply target review not found' }, { status: 404 })
      }
    }

    // For a top-level review, check if buyer already reviewed this product
    if (!replyToId) {
      const existing = await db.reviews.findFirst({
        where: { productId: id, buyerId, replyToId: null },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'You have already reviewed this product' },
          { status: 409 }
        )
      }
    }

    // Check if this buyer has a verified purchase (delivered order item for this product)
    let verifiedPurchase = false
    if (!replyToId) {
      const delivered = await db.orderItems.findFirst({
        where: {
          productId: id,
          subOrder: {
            order: { buyerId },
            status: 'delivered',
          },
        },
        select: { id: true },
      })
      verifiedPurchase = !!delivered
    }

    // Validate images array (strings)
    let imagesJson: string | null = null
    if (Array.isArray(images) && images.length > 0) {
      const valid = images.filter((u): u is string => typeof u === 'string' && u.startsWith('/'))
      if (valid.length > 0) imagesJson = JSON.stringify(valid.slice(0, 6))
    }

    const review = await db.reviews.create({
      data: {
        productId: id,
        buyerId,
        rating: replyToId ? 0 : rating, // replies carry no rating
        comment: comment || null,
        images: imagesJson,
        verifiedPurchase,
        replyToId: replyToId || null,
      },
      include: {
        buyer: {
          select: {
            id: true,
            buyerProfile: {
              select: {
                fullName: true,
                businessName: true,
                businessType: true,
              },
            },
          },
        },
      },
    })

    // Recompute product rating/reviewCount from top-level reviews
    if (!replyToId) {
      const all = await db.reviews.findMany({
        where: { productId: id, replyToId: null },
        select: { rating: true },
      })
      const avg = all.length > 0
        ? all.reduce((s, r) => s + r.rating, 0) / all.length
        : 0
      await db.products.update({
        where: { id },
        data: { ratingAvg: Math.round(avg * 10) / 10, reviewCount: all.length },
      })
    }

    return NextResponse.json(
      {
        success: true,
        data: mapReview(review),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Product review POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
