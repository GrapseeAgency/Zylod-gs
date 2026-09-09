import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const share = await (db as any).wishlistShares.findFirst({
      where: { token, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { buyer: { select: { name: true, avatarUrl: true, companyName: true } } }
    })
    if (!share) return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 })

    // Increment view count
    await (db as any).wishlistShares.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } })

    const items = await db.wishlists.findMany({
      where: { buyerId: share.buyerId },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true,
            ...(share.showPrices ? { basePrice: true, currency: true } : {}),
            unit: true, moq: true, thumbnailUrl: true, stockQuantity: true,
            supplier: { select: { companyName: true, verificationStatus: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        owner: share.buyer,
        items,
        settings: { allowAddToCart: share.allowAddToCart, showPrices: share.showPrices },
      }
    })
  } catch (error) {
    console.error('SharedWishlist GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
