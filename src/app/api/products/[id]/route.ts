import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

function mapReview(review: {
  id: string
  rating: number
  comment: string | null
  images: string | null
  verifiedPurchase: boolean
  createdAt: Date
  buyer: { id: string; buyerProfile: { fullName: string | null; businessName: string | null } | null }
}) {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    images: review.images ? JSON.parse(review.images) : [],
    verifiedPurchase: review.verifiedPurchase,
    createdAt: review.createdAt,
    buyer: {
      id: review.buyer.id,
      buyerProfile: review.buyer.buyerProfile
        ? {
            fullName: review.buyer.buyerProfile.fullName,
            businessName: review.buyer.buyerProfile.businessName,
          }
        : null,
    },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const now = new Date()
    const product = await db.products.findUnique({
      where: { id },
      include: {
        // Task 100: the campaign currently pinned to this product (if any) —
        // the PDP promo banner reads it. Window-filtered here; the payload
        // carries only buyer-safe fields (no usedCount, no audit trail).
        promotionProducts: {
          where: { promotion: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } } },
          select: {
            promotion: {
              select: {
                id: true, name: true, description: true, type: true, value: true,
                minOrderAmount: true, maxDiscount: true, validUntil: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            // userId lets the buyer open a REAL chat conversation with this
            // supplier (conversations.supplierId references users.id).
            userId: true,
            companyName: true,
            ratingAvg: true,
            ratingCount: true,
            verificationStatus: true,
          },
        },
        category: { select: { id: true, name: true, slug: true, parentId: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        priceTiers: { orderBy: { minQty: 'asc' } },
        variants: true,
        videos: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          where: { replyToId: null }, // top-level reviews only
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            buyer: {
              select: {
                id: true,
                buyerProfile: { select: { fullName: true, businessName: true } },
              },
            },
            replies: {
              take: 5,
              orderBy: { createdAt: 'asc' },
              include: {
                buyer: {
                  select: {
                    id: true,
                    buyerProfile: { select: { fullName: true, businessName: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // ─── MODERATION GATE ───
    // Hidden or unapproved products are 404 for everyone EXCEPT the owning
    // supplier (viewing their own listing) and admins. Unauthenticated
    // callers get the same 404 — no existence leak.
    if (!product.isActive || !product.isApproved) {
      const auth = await authenticateRequest(request)
      let allowed = false
      if (auth.authenticated && auth.user) {
        if (auth.user.userType === 'admin') {
          allowed = true
        } else {
          const profile = await db.supplierProfiles.findFirst({
            where: { userId: auth.user.id },
            select: { id: true },
          })
          allowed = profile?.id === product.supplierId
        }
      }
      if (!allowed) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
    }

    // Serialize reviews (parse images JSON, map replies)
    // Task 100: promotionProducts rows collapse into ONE activePromotion —
    // if several campaigns pin the same product the buyer-visible pick is
    // the one ending soonest (urgency is the honest tiebreak; the pricing
    // engine independently picks the BEST discount at order time).
    const promotedRows = [...product.promotionProducts].sort(
      (a, b) => a.promotion.validUntil.getTime() - b.promotion.validUntil.getTime()
    )
    const activePromotion = promotedRows[0]?.promotion ?? null
    const serialized = {
      ...product,
      promotionProducts: undefined,
      activePromotion,
      reviews: product.reviews.map(r => ({
        ...mapReview(r),
        replies: (r.replies || []).map(reply => mapReview(reply)),
      })),
    }

    return NextResponse.json({ success: true, data: serialized })
  } catch (error) {
    console.error('Product detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
