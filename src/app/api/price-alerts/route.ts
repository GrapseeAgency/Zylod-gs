import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/price-alerts
 * List user's price drop alerts.
 * Query: status (active|triggered|expired|cancelled), page, limit
 *
 * POST /api/price-alerts
 * Create a new price alert.
 * Body: { productId: string, targetPrice: number }
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId: auth.user.id }
    if (status) where.status = status

    const [alerts, total] = await Promise.all([
      db.priceAlerts.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.priceAlerts.count({ where }),
    ])

    // Fetch current prices for active alerts
    const productIds = [...new Set(alerts.map(a => a.productId))]
    const products = productIds.length > 0
      ? await db.products.findMany({
          where: { id: { in: productIds } },
          select: { id: true, basePrice: true, stockQuantity: true, thumbnailUrl: true, name: true },
        })
      : []
    const prodMap = new Map(products.map(p => [p.id, p]))

    const data = alerts.map(a => {
      const prod = prodMap.get(a.productId)
      return {
        id: a.id,
        productId: a.productId,
        productName: a.productName,
        productImage: a.productImage ?? prod?.thumbnailUrl ?? null,
        currentPrice: prod?.basePrice ?? a.currentPrice,
        targetPrice: a.targetPrice,
        status: a.status,
        inStock: (prod?.stockQuantity ?? 0) > 0,
        savings: prod ? Math.max(0, prod.basePrice - a.targetPrice) : 0,
        savingsPercent: prod && prod.basePrice > 0
          ? Math.round(((prod.basePrice - a.targetPrice) / prod.basePrice) * 100)
          : 0,
        lastNotifiedAt: a.lastNotifiedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Price alerts GET error:', error)
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
    const { productId, targetPrice } = body

    if (!productId || typeof targetPrice !== 'number' || targetPrice <= 0) {
      return NextResponse.json({ error: 'productId and targetPrice are required' }, { status: 400 })
    }

    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, thumbnailUrl: true, basePrice: true, isActive: true },
    })

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Prevent duplicate active alerts
    const existing = await db.priceAlerts.findFirst({
      where: { userId: auth.user.id, productId, status: 'active' },
    })
    if (existing) {
      return NextResponse.json({ error: 'Active price alert already exists for this product' }, { status: 409 })
    }

    const alert = await db.priceAlerts.create({
      data: {
        userId: auth.user.id,
        productId,
        productName: product.name,
        productImage: product.thumbnailUrl,
        currentPrice: product.basePrice,
        targetPrice,
        status: 'active',
      },
    })

    // Dispatch real in-app price watch confirmation notification
    await sendNotification({
      userId: auth.user.id,
      type: 'price_drop',
      title: `Price Watch Activated: ${product.name}`,
      body: `We are monitoring ${product.name}. Current wholesale rate is ৳${product.basePrice.toLocaleString()}. You will be alerted when it falls to ৳${targetPrice.toLocaleString()} or lower.`,
      relatedEntityId: productId,
    })

    return NextResponse.json({ success: true, data: alert }, { status: 201 })
  } catch (error) {
    console.error('Price alerts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
