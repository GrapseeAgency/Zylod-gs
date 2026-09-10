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
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const items = await db.wishlists.findMany({
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
            isActive: true,
            supplier: {
              select: {
                companyName: true,
                
                verificationStatus: true,
              },
            },
            priceTiers: {
              orderBy: { minQty: 'asc' },
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    return NextResponse.json({
      success: true,
      data: items,
      meta: {
        count: items.length,
        hasMore,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      },
    })
  } catch (error) {
    console.error('Wishlist GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const body = await request.json()
    const { productId, note } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Check product exists
    const product = await db.products.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const item = await db.wishlists.upsert({
      where: { buyerId_productId: { buyerId: userId, productId } },
      create: { buyerId: userId, productId, note },
      update: { note },
    })

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Product added to wishlist',
    })
  } catch (error) {
    console.error('Wishlist POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    await db.wishlists.deleteMany({
      where: { buyerId: userId, productId },
    })

    return NextResponse.json({
      success: true,
      message: 'Product removed from wishlist',
    })
  } catch (error) {
    console.error('Wishlist DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
