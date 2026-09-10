import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const cursor = searchParams.get('cursor')

    const items = await (db as any).recentlyViewed.findMany({
      where: { buyerId: auth.user.id },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true, basePrice: true, currency: true,
            unit: true, moq: true, stockQuantity: true, ratingAvg: true,
            reviewCount: true, thumbnailUrl: true,
            supplier: { select: { companyName: true,  isVerified: true } },
            priceTiers: { orderBy: { minQty: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = items.length > limit
    if (hasMore) items.pop()

    return NextResponse.json({
      success: true,
      data: items,
      meta: { count: items.length, hasMore, nextCursor: hasMore ? items[items.length - 1]?.id : null },
    })
  } catch (error) {
    console.error('RecentlyViewed GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    if (productId) {
      await (db as any).recentlyViewed.deleteMany({ where: { buyerId: auth.user.id, productId } })
    } else {
      await (db as any).recentlyViewed.deleteMany({ where: { buyerId: auth.user.id } })
    }
    return NextResponse.json({ success: true, message: 'History cleared' })
  } catch (error) {
    console.error('RecentlyViewed DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
