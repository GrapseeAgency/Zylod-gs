import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * THE SELLER-REVIEW WRITER (Task 105) — supplierReviews was a
 * read-without-writer table: the storefront SERVED reviews and labeled
 * reviewers "Verified buyer", yet no surface could create one, so the
 * promise could never be kept. This route is the whole circuit:
 *
 * - POST: a signed-in BUYER who has a REAL order under this supplier
 *   (subOrders.supplierId + orders.buyerId) reviews them. Rating-only is
 *   honest (comment optional, bounded when present). ONE per buyer per
 *   supplier (the same honest 409 the product-review rail uses — stacking
 *   reviews to skew the average is refused). Aggregates
 *   (supplierProfiles.ratingAvg/ratingCount) are recomputed from actual
 *   rows inside the same transaction. Audited + live-tapped to the
 *   supplier's room and the admin room.
 * - DELETE: the buyer removes their OWN review (a foreign/phantom id is
 *   the same 404 — no-leak). Aggregates recomputed from the rows that
 *   remain.
 *
 * Guests and non-buyers are 401-first per the house pattern; a phantom
 * supplier is 404 exactly like a hidden one.
 */

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
  comment: z.string().trim().min(1, 'Comment cannot be empty').max(1000, 'Comment is limited to 1000 characters').optional(),
  // STRICT: unknown keys are refused, never silently stripped — the payload
  // the buyer sent is the payload that gets judged (house doctrine).
}).strict()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'You must be signed in as a buyer to review a supplier' }, { status: 401 })
  }
  const buyerId = auth.user.id

  const rl = checkRateLimit(request, 'supplier-review-write', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const body = await request.json().catch(() => null)
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid review payload' },
        { status: 400 },
      )
    }
    const { rating, comment } = parsed.data

    const supplier = await db.supplierProfiles.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // "Verified buyer" is the storefront's own label — it can only stay
    // honest if the reviewer has actually transacted with this supplier.
    const purchase = await db.subOrders.findFirst({
      where: { supplierId: supplier.id, order: { buyerId } },
      select: { id: true },
    })
    if (!purchase) {
      return NextResponse.json(
        { error: 'Only buyers with a real order from this supplier can review them' },
        { status: 403 },
      )
    }

    const already = await db.supplierReviews.findUnique({
      where: { supplierId_buyerId: { supplierId: supplier.id, buyerId } },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json(
        { error: 'You have already reviewed this supplier — one review per buyer per supplier.' },
        { status: 409 },
      )
    }

    const review = await db.$transaction(async (tx) => {
      const created = await tx.supplierReviews.create({
        data: { supplierId: supplier.id, buyerId, rating, comment: comment ?? null },
      })
      const agg = await tx.supplierReviews.aggregate({
        where: { supplierId: supplier.id },
        _avg: { rating: true },
        _count: { _all: true },
      })
      await tx.supplierProfiles.update({
        where: { id: supplier.id },
        data: {
          // The SAME convention the product-review rail uses: avg rounded
          // to one decimal, count from the rows that actually exist.
          ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
          ratingCount: agg._count._all,
        },
      })
      return created
    })

    await db.auditLogs.create({
      data: {
        actorId: buyerId,
        action: 'supplier_review_added',
        entityType: 'supplierReviews',
        entityId: review.id,
        metadata: JSON.stringify({
          supplierId: supplier.id,
          rating,
          hasComment: !!comment,
        }),
      },
    })

    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })

    await Promise.allSettled([
      broadcastToRoom(`seller:${supplier.id}`, 'supplier:reviewed', {
        supplierId: supplier.id,
        action: 'added',
        reviewId: review.id,
        rating,
      }),
      ...admins.map((admin) => broadcastToRoom(`admin:${admin.id}`, 'supplier:reviewed', {
        supplierId: supplier.id,
        action: 'added',
        reviewId: review.id,
        rating,
      })),
    ])

    return NextResponse.json(
      {
        success: true,
        data: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt },
        message: 'Review published',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('SupplierReview POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const buyerId = auth.user.id

  const rl = checkRateLimit(request, 'supplier-review-write', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const supplier = await db.supplierProfiles.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const deleted = await db.supplierReviews.deleteMany({
      where: { supplierId: supplier.id, buyerId },
    })
    if (deleted.count === 0) {
      // A review the caller doesn't have is the SAME 404 as a phantom one.
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    const agg = await db.supplierReviews.aggregate({
      where: { supplierId: supplier.id },
      _avg: { rating: true },
      _count: { _all: true },
    })
    await db.supplierProfiles.update({
      where: { id: supplier.id },
      data: {
        ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        ratingCount: agg._count._all,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: buyerId,
        action: 'supplier_review_removed',
        entityType: 'supplierReviews',
        entityId: supplier.id,
        metadata: JSON.stringify({ supplierId: supplier.id }),
      },
    })

    const admins = await db.users.findMany({ where: { userType: 'admin' }, select: { id: true } })

    await Promise.allSettled([
      broadcastToRoom(`seller:${supplier.id}`, 'supplier:reviewed', {
        supplierId: supplier.id,
        action: 'removed',
      }),
      ...admins.map((admin) => broadcastToRoom(`admin:${admin.id}`, 'supplier:reviewed', {
        supplierId: supplier.id,
        action: 'removed',
      })),
    ])

    return NextResponse.json({ success: true, message: 'Review removed' })
  } catch (error) {
    console.error('SupplierReview DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
