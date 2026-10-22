import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

    // Task 65: variant watches report THEIR variant's real stock — a product
    // may have come back in some other variant while the watched one is still
    // at zero, and the row must not claim otherwise.
    const variantIds = [...new Set(alerts.map(a => a.variantId).filter((v): v is string => Boolean(v)))]
    const variants = variantIds.length > 0
      ? await db.productVariants.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, variantName: true, variantValue: true, stockQuantity: true },
        })
      : []
    const variantMap = new Map(variants.map(v => [v.id, v]))

    const data = alerts.map(a => {
      const prod = prodMap.get(a.productId)
      const variant = a.variantId ? variantMap.get(a.variantId) : undefined
      const variantLabel = variant
        ? `${variant.variantName}: ${variant.variantValue}`.replace(/\s+/g, ' ').trim()
        : a.variantLabel ?? null
      const relevantStock = variant ? variant.stockQuantity : (prod?.stockQuantity ?? 0)
      const isNowInStock = relevantStock > 0
      return {
        id: a.id,
        productId: a.productId,
        productName: a.productName,
        productImage: a.productImage ?? prod?.thumbnailUrl ?? null,
        variantId: a.variantId ?? null,
        variantLabel,
        currentPrice: prod?.basePrice ?? 0,
        stockQuantity: relevantStock,
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
    const rl = checkRateLimit(request, 'stock-alerts-create', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)


    const body = await request.json()
    const productId: unknown = body.productId
    const variantId: unknown = body.variantId

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }
    if (variantId !== undefined && variantId !== null && typeof variantId !== 'string') {
      return NextResponse.json({ error: 'variantId must be a string' }, { status: 400 })
    }

    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, thumbnailUrl: true, stockQuantity: true, isActive: true, supplierId: true },
    })

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Task 65: a variant watch pins THIS exact variant — it must exist on
    // the product, otherwise the watch could never fire honestly.
    let variantRow: { id: string; variantName: string; variantValue: string; stockQuantity: number } | null = null
    if (variantId) {
      const v = await db.productVariants.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, variantName: true, variantValue: true, stockQuantity: true },
      })
      if (!v || v.productId !== productId) {
        return NextResponse.json({ error: 'Variant not found on this product' }, { status: 404 })
      }
      variantRow = v
    }

    // Task 61/65: a restock watch exists to fire when stock RETURNS. Watching
    // an in-stock product (or variant) is a contradiction — and would turn any
    // later stock edit into a fake "restocked!" push — refuse it honestly.
    if (variantRow) {
      if (variantRow.stockQuantity > 0) {
        return NextResponse.json(
          { error: 'This variant is already in stock — there is nothing to watch' },
          { status: 409 }
        )
      }
    } else if (product.stockQuantity > 0) {
      return NextResponse.json(
        { error: 'This product is already in stock — there is nothing to watch' },
        { status: 409 }
      )
    }

    // Prevent duplicate active alerts — scoped to the same watch kind
    // (product-level or the exact same variant).
    const existing = await db.stockAlerts.findFirst({
      where: {
        userId: auth.user.id,
        productId,
        variantId: variantRow ? variantRow.id : null,
        status: 'active',
      },
    })
    if (existing) {
      return NextResponse.json({ error: 'Active stock alert already exists for this product' }, { status: 409 })
    }

    const variantLabel = variantRow
      ? `${variantRow.variantName}: ${variantRow.variantValue}`.replace(/\s+/g, ' ').trim()
      : null

    const alert = await db.stockAlerts.create({
      data: {
        userId: auth.user.id,
        productId,
        variantId: variantRow ? variantRow.id : null,
        variantLabel,
        productName: product.name,
        productImage: product.thumbnailUrl,
        status: 'active',
      },
    })

    // Dispatch real in-app restock watch confirmation notification
    await sendNotification({
      userId: auth.user.id,
      type: 'back_in_stock',
      title: variantLabel
        ? `Restock Watch Activated: ${product.name} — ${variantLabel}`
        : `Restock Watch Activated: ${product.name}`,
      body: variantLabel
        ? `We are monitoring ${variantLabel} of ${product.name}. As soon as its factory inventory is replenished, you will receive an immediate restock alert.`
        : `We are monitoring ${product.name}. As soon as factory inventory is replenished, you will receive an immediate restock alert.`,
      relatedEntityId: productId,
    })

    // Task 62: the seller's demand signal — a buyer is waiting for THIS
    // product. Push the REAL active-watcher count into the seller room so a
    // live dashboard tick is backed by the same number a GET returns.
    // Task 65: the payload carries the variant so the demand queue can show
    // exactly what is being waited on.
    if (product.supplierId) {
      const watchers = await db.stockAlerts.count({
        where: { productId, status: 'active' },
      })
      void broadcastToRoom(`seller:${product.supplierId}`, 'stock:watch', {
        productId,
        productName: product.name,
        ...(variantRow ? { variantId: variantRow.id, variantLabel } : {}),
        watchers,
      })
    }

    return NextResponse.json({ success: true, data: alert }, { status: 201 })
  } catch (error) {
    console.error('Stock alerts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
