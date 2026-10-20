import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * THE RECENTLY-VIEWED RAIL (Task 104) — backed by the REAL `browsingHistory`
 * table. The previous implementation queried `(db as any).recentlyViewed` — a
 * model the schema has NEVER had — so every call was a guaranteed 500 hidden
 * from tsc by the `as any` cast, while `browsingHistory` sat with zero writers
 * and zero readers. This route is the whole circuit:
 *
 * - POST   record a view (upsert on buyerId+productId — a re-visit bumps
 *          viewedAt; hidden/pending products are refused with the same 404 as
 *          phantoms, the no-leak doctrine). History is capped at the newest
 *          HISTORY_CAP rows per user — the oldest are pruned, never silently
 *          accumulated forever.
 * - GET    newest-first cursor pagination for the owner only.
 * - DELETE ?productId=<id> removes one row; no param clears ALL of the
 *          caller's rows (deleteMany is always scoped by the session user —
 *          a foreign productId is an honest no-op, not an error).
 *
 * Guests are 401 by design: the model requires a buyerId, and a client-side
 * only history would be a second source of truth. The PDP fires POST
 * fire-and-forget; unauthenticated visits simply leave no server history.
 */

const HISTORY_CAP = 100

function shapeRow(row: {
  id: string
  viewedAt: Date
  product: {
    id: string
    name: string
    slug: string
    basePrice: number
    currency: string
    unit: string
    moq: number
    stockQuantity: number
    ratingAvg: number
    reviewCount: number
    thumbnailUrl: string | null
    isActive: boolean
    maxOrderQty: number | null
    bundleSize: number | null
    weightKg: number | null
    supplier: { id: string; companyName: string; verificationStatus: string }
    priceTiers: { minQty: number; maxQty: number | null; pricePerUnit: number }[]
  }
}) {
  return {
    id: row.id,
    viewedAt: row.viewedAt.toISOString(),
    product: {
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      basePrice: row.product.basePrice,
      currency: row.product.currency,
      unit: row.product.unit,
      moq: row.product.moq,
      stockQuantity: row.product.stockQuantity,
      ratingAvg: row.product.ratingAvg,
      reviewCount: row.product.reviewCount,
      thumbnailUrl: row.product.thumbnailUrl,
      isActive: row.product.isActive,
      maxOrderQty: row.product.maxOrderQty,
      bundleSize: row.product.bundleSize,
      weightKg: row.product.weightKg,
      supplier: {
        id: row.product.supplier?.id || '',
        companyName: row.product.supplier?.companyName || 'Supplier',
        // same vocabulary the PDP + storefront render: 'approved' == verified
        isVerified: row.product.supplier?.verificationStatus === 'approved',
      },
      priceTiers: row.product.priceTiers.map((t) => ({
        minQty: t.minQty,
        maxQty: t.maxQty,
        pricePerUnit: t.pricePerUnit,
      })),
    },
  }
}

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'recently-viewed-list', 120, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 50)
    const cursor = searchParams.get('cursor')

    const rows = await db.browsingHistory.findMany({
      where: { buyerId: auth.user.id },
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
            maxOrderQty: true,
            bundleSize: true,
            weightKg: true,
            supplier: { select: { id: true, companyName: true, verificationStatus: true } },
            priceTiers: { orderBy: { minQty: 'asc' }, take: 3, select: { minQty: true, maxQty: true, pricePerUnit: true } },
          },
        },
      },
      orderBy: { viewedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = rows.length > limit
    if (hasMore) rows.pop()

    return NextResponse.json({
      success: true,
      data: rows.map(shapeRow),
      meta: {
        count: rows.length,
        hasMore,
        nextCursor: hasMore ? rows[rows.length - 1].id : null,
      },
    })
  } catch (error) {
    console.error('RecentlyViewed GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'recently-viewed-write', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Visible-product doctrine: only an ACTIVE + APPROVED listing is viewable,
    // so only such a listing can enter history. A hidden or pending product is
    // the SAME 404 as a phantom one — never discoverable through this rail.
    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, isApproved: true },
    })
    if (!product || !product.isActive || !product.isApproved) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const row = await db.browsingHistory.upsert({
      where: { buyerId_productId: { buyerId: auth.user.id, productId } },
      create: { buyerId: auth.user.id, productId },
      update: { viewedAt: new Date() },
    })

    // Cap enforcement: prune everything older than the newest HISTORY_CAP
    // rows (viewedAt desc, id desc as the deterministic tiebreak).
    const keep = await db.browsingHistory.findMany({
      where: { buyerId: auth.user.id },
      orderBy: [{ viewedAt: 'desc' }, { id: 'desc' }],
      take: HISTORY_CAP,
      select: { viewedAt: true, id: true },
    })
    if (keep.length === HISTORY_CAP) {
      const pivot = keep[keep.length - 1]
      const removed = await db.browsingHistory.deleteMany({
        where: {
          buyerId: auth.user.id,
          OR: [
            { viewedAt: { lt: pivot.viewedAt } },
            { viewedAt: pivot.viewedAt, id: { lt: pivot.id } },
          ],
        },
      })
      if (removed.count > 0) {
        console.log(`[recently-viewed] pruned ${removed.count} rows for user ${auth.user.id}`)
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: { productId, viewedAt: row.viewedAt.toISOString() },
        message: 'View recorded',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('RecentlyViewed POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'recently-viewed-write', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    // Both branches are scoped by the session user. A productId the caller
    // never viewed (or that belongs to someone else) deletes 0 rows — the
    // honest count comes back in the body.
    const result = productId
      ? await db.browsingHistory.deleteMany({ where: { buyerId: auth.user.id, productId } })
      : await db.browsingHistory.deleteMany({ where: { buyerId: auth.user.id } })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: result.count === 1 ? 'Removed from history' : 'History cleared',
    })
  } catch (error) {
    console.error('RecentlyViewed DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
