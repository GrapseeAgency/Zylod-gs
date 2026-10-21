import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/suppliers/[id]/campaigns — the PUBLIC buyer rail for a seller's
 * own campaigns (Task 115). No auth by design: a campaign is storefront
 * content, and the store page renders it.
 *
 * Only campaigns that are active AND inside their window are served, and
 * only for a supplier whose account exists. Pinned products are only listed
 * when they are ACTIVE + APPROVED right now — a hidden or unapproved
 * product must never surface through a marketing rail (the same
 * visible-product doctrine the platform promotions rail enforces).
 * Operational fields never leave (usedCount, usageLimit).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(request, 'supplier-campaigns-public', 120, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const supplier = await db.supplierProfiles.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    })
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const now = new Date()
    const campaigns = await db.promotions.findMany({
      where: { supplierId: id, isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      orderBy: { validUntil: 'asc' },
      take: 10,
      include: {
        products: {
          take: 12,
          where: { product: { isActive: true, isApproved: true, supplierId: id } },
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

    return NextResponse.json({
      success: true,
      data: {
        supplier: { id: supplier.id, companyName: supplier.companyName },
        campaigns: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          type: c.type,
          value: c.value,
          bannerImageUrl: c.bannerImageUrl,
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
        })),
      },
    })
  } catch (error) {
    console.error('Public supplier campaigns GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
