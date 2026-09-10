import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/orders/[id]/feedback — submit an order review.
 * Persists into the real reviews table (one per product item in the order).
 * Body: { overallRating, reviewText, photos?, productIds? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      overallRating,
      productQuality,
      deliverySpeed,
      packaging,
      supplierCommunication,
      reviewTitle,
      reviewText,
      recommend,
      photos,
      productIds,
    } = body

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    if (!overallRating || overallRating < 1 || overallRating > 5) {
      return NextResponse.json({ error: 'Overall rating is required (1-5)' }, { status: 400 })
    }

    const order = await db.orders.findUnique({
      where: { id },
      select: { id: true, buyerId: true, orderNumber: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Determine which products to review (explicit productIds, else all items in order)
    const orderItems = await db.orderItems.findMany({
      where: { subOrder: { orderId: id } },
      include: { product: { select: { id: true } } },
    })
    const items = productIds && productIds.length > 0
      ? orderItems.filter(oi => productIds.includes(oi.productId))
      : orderItems

    if (items.length === 0) {
      return NextResponse.json({ error: 'No products found to review' }, { status: 404 })
    }

    const imagesJson = Array.isArray(photos) && photos.length > 0
      ? JSON.stringify(photos.filter((u): u is string => typeof u === 'string' && u.startsWith('/')).slice(0, 6))
      : null

    const created: { id: string; productId: string; rating: number }[] = []
    for (const item of items) {
      const existing = await db.reviews.findFirst({
        where: { productId: item.productId, buyerId: auth.user.id, replyToId: null },
        select: { id: true },
      })
      if (existing) continue // skip already-reviewed products

      const review = await db.reviews.create({
        data: {
          productId: item.productId,
          buyerId: auth.user.id,
          rating: overallRating,
          comment: reviewText ? `[${reviewTitle || 'Order review'}] ${reviewText}` : reviewText || null,
          images: imagesJson,
          verifiedPurchase: true,
        },
        select: { id: true, productId: true, rating: true },
      })
      created.push(review)

      // Recompute product rating
      const all = await db.reviews.findMany({
        where: { productId: item.productId, replyToId: null },
        select: { rating: true },
      })
      const avg = all.reduce((s, r) => s + r.rating, 0) / all.length
      await db.products.update({
        where: { id: item.productId },
        data: { ratingAvg: Math.round(avg * 10) / 10, reviewCount: all.length },
      })
    }

    const detailRatings = {
      productQuality: productQuality || 0,
      deliverySpeed: deliverySpeed || 0,
      packaging: packaging || 0,
      supplierCommunication: supplierCommunication || 0,
    }

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'order_feedback',
        entityType: 'orders',
        entityId: id,
        metadata: JSON.stringify({ overallRating, detailRatings, reviewTitle, recommend, created: created.length }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: `FB-${Date.now()}`,
        orderId: id,
        ratings: { overall: overallRating, ...detailRatings },
        reviewTitle: reviewTitle || '',
        reviewText: reviewText || '',
        recommend: recommend ?? true,
        photos: photos || [],
        submittedAt: new Date().toISOString(),
        createdReviews: created,
      },
      message: 'Feedback submitted successfully. Thank you for your review!',
    })
  } catch (error) {
    console.error('Order feedback API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}