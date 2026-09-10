import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const product = await db.products.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
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

    // Serialize reviews (parse images JSON, map replies)
    const serialized = {
      ...product,
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
