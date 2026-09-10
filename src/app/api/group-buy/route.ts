import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/group-buy
 * List active volume pooling group buy campaigns.
 *
 * POST /api/group-buy
 * Create a new group buy campaign for a product.
 */
export async function GET(request: NextRequest) {
  try {
    const campaigns = await db.groupBuyCampaigns.findMany({
      where: { status: 'active', expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    const productIds = [...new Set(campaigns.map(c => c.productId))]
    const products = productIds.length > 0
      ? await db.products.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, thumbnailUrl: true, basePrice: true },
        })
      : []
    const prodMap = new Map(products.map(p => [p.id, p]))

    const data = campaigns.map(c => {
      const prod = prodMap.get(c.productId)
      const progressPercent = Math.min(100, Math.round((c.currentQty / c.targetQty) * 100))
      return {
        id: c.id,
        productId: c.productId,
        title: c.title,
        productName: prod?.name || c.title,
        productImage: prod?.thumbnailUrl,
        targetQty: c.targetQty,
        currentQty: c.currentQty,
        progressPercent,
        discountedPrice: c.discountedPrice,
        originalPrice: c.originalPrice,
        savingsPercent: Math.round(((c.originalPrice - c.discountedPrice) / c.originalPrice) * 100),
        status: c.status,
        expiresAt: c.expiresAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Group buy GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, title, targetQty, discountedPrice, durationHours = 48 } = body

    if (!productId || !targetQty || !discountedPrice) {
      return NextResponse.json({ error: 'productId, targetQty, discountedPrice are required' }, { status: 400 })
    }

    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, basePrice: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const campaign = await db.groupBuyCampaigns.create({
      data: {
        productId,
        title: title || `Group Buy: ${product.name}`,
        targetQty: Number(targetQty),
        currentQty: 0,
        discountedPrice: Number(discountedPrice),
        originalPrice: product.basePrice,
        expiresAt: new Date(Date.now() + durationHours * 3600000),
        status: 'active',
      },
    })

    return NextResponse.json({ success: true, data: campaign }, { status: 201 })
  } catch (error) {
    console.error('Group buy POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
