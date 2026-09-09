import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/stock-alerts
 * List user's back-in-stock alerts.
 * Query: status (active|notified|cancelled), page, limit
 *
 * POST /api/stock-alerts
 * Create a new back-in-stock alert.
 * Body: { productId: string }
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
      db.stockAlerts.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.stockAlerts.count({ where }),
    ])

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
      const isNowInStock = (prod?.stockQuantity ?? 0) > 0
      return {
        id: a.id,
        productId: a.productId,
        productName: a.productName,
        productImage: a.productImage ?? prod?.thumbnailUrl ?? null,
        currentPrice: prod?.basePrice ?? 0,
        stockQuantity: prod?.stockQuantity ?? 0,
        inStock: isNowInStock,
        status: a.status === 'active' && isNowInStock ? 'notified' : a.status,
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
    console.error('Stock alerts GET error:', error)
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
    const { productId } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, thumbnailUrl: true, stockQuantity: true, isActive: true },
    })

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Prevent duplicate active alerts
    const existing = await db.stockAlerts.findFirst({
      where: { userId: auth.user.id, productId, status: 'active' },
    })
    if (existing) {
      return NextResponse.json({ error: 'Active stock alert already exists for this product' }, { status: 409 })
    }

    const alert = await db.stockAlerts.create({
      data: {
        userId: auth.user.id,
        productId,
        productName: product.name,
        productImage: product.thumbnailUrl,
        status: 'active',
      },
    })

    // Dispatch real in-app restock watch confirmation notification
    await sendNotification({
      userId: auth.user.id,
      type: 'back_in_stock',
      title: `Restock Watch Activated: ${product.name}`,
      body: `We are monitoring ${product.name}. As soon as factory inventory is replenished, you will receive an immediate restock alert.`,
      relatedEntityId: productId,
    })

    return NextResponse.json({ success: true, data: alert }, { status: 201 })
  } catch (error) {
    console.error('Stock alerts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
