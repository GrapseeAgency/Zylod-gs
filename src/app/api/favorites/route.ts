import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id

    // Favorites = top wishlist items by ratingAvg of product, plus recently added
    const favorites = await db.wishlists.findMany({
      where: { buyerId: userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            currency: true,
            unit: true,
            moq: true,
            stockQuantity: true,
            ratingAvg: true,
            reviewCount: true,
            thumbnailUrl: true,
            soldCount: true,
            supplier: {
              select: {
                companyName: true,
                
                verificationStatus: true,
                ratingAvg: true,
              },
            },
            priceTiers: {
              orderBy: { minQty: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: [
        { product: { ratingAvg: 'desc' } },
        { createdAt: 'desc' },
      ],
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: favorites,
      meta: { count: favorites.length },
    })
  } catch (error) {
    console.error('Favorites GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
