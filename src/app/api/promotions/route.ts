import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/promotions — the PUBLIC marketing rail for platform promotions
 * (Task 100). No auth by design: a campaign is storefront content.
 *
 * Only campaigns that are active AND inside their window are served. Pinned
 * products are only listed when they are ACTIVE + APPROVED right now — a
 * hidden or unapproved product must never surface through a marketing rail
 * (the same visible-product doctrine the collections rail enforces). No
 * operational fields leave (usedCount, usageLimit, audit trail).
 */
export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'promotions-public', 120, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const now = new Date()
    const campaigns = await db.promotions.findMany({
      // Task 115: this rail stays PLATFORM-ONLY (supplierId null). Seller
      // campaigns are storefront content of THEIR store page and are served
      // by /api/suppliers/[id]/campaigns — mixing owners here would make
      // the platform rail a seller marketing channel.
      where: { supplierId: null, isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      orderBy: { validUntil: 'asc' },
      take: 20,
      include: {
        products: {
          take: 12,
          where: { product: { isActive: true, isApproved: true } },
          select: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                unit: true,
                bundleSize: true,
                stockQuantity: true,
                images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } },
              },
            },
          },
        },
      },
    })

    const data = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      value: c.value,
      minOrderAmount: c.minOrderAmount,
      maxDiscount: c.maxDiscount,
      validFrom: c.validFrom.toISOString(),
      validUntil: c.validUntil.toISOString(),
      products: c.products.map((p) => ({
        id: p.product.id,
        name: p.product.name,
        unitPrice: p.product.basePrice,
        unit: p.product.unit,
        bundleSize: p.product.bundleSize,
        inStock: p.product.stockQuantity > 0,
        image: p.product.images[0]?.imageUrl ?? null,
      })),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Public promotions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
