import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/deals/exclusive — REAL active promotion deals (t187-d).
 *
 * The old route invented a 15–35% discount by list index, a fake
 * "Verified Direct Mill" factory name, a fake requiredTier assigned by idx
 * parity, and a fake expiresInHours countdown — none of which exist in the
 * schema. The only REAL deal engine on Zylod is the promotions table, so
 * this returns currently-active campaigns joined to their live, approved
 * products. dealPriceBDT is derived from the campaign's REAL type/value
 * terms — the same terms the checkout pricing engine applies. For campaign
 * types that have no per-unit price (bogo/bundle) dealPriceBDT is null and
 * the UI shows the real base price without an invented discount.
 */
export async function GET(_request: NextRequest) {
  try {
    const now = new Date()
    const promoProducts = await db.promotionProducts.findMany({
      where: {
        promotion: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
        product: { isActive: true, isApproved: true },
      },
      include: {
        promotion: {
          select: {
            id: true, name: true, description: true, type: true, value: true,
            minOrderAmount: true, maxDiscount: true, validUntil: true,
          },
        },
        product: {
          select: {
            id: true, name: true, slug: true, basePrice: true, moq: true,
            stockQuantity: true, thumbnailUrl: true,
            supplier: { select: { companyName: true } },
          },
        },
      },
    })

    // Soonest-ending campaigns first (real urgency, not an invented clock).
    promoProducts.sort(
      (a, b) => a.promotion.validUntil.getTime() - b.promotion.validUntil.getTime()
    )

    const deals = promoProducts.slice(0, 20).map((pp) => {
      const p = pp.product
      const promo = pp.promotion
      let dealPriceBDT: number | null = null
      if (promo.type === 'percentage') {
        const discount = promo.maxDiscount != null
          ? Math.min((p.basePrice * promo.value) / 100, promo.maxDiscount)
          : (p.basePrice * promo.value) / 100
        dealPriceBDT = Math.max(0, Math.round(p.basePrice - discount))
      } else if (promo.type === 'fixed') {
        dealPriceBDT = Math.max(0, Math.round(p.basePrice - promo.value))
      }
      return {
        id: `promo-deal-${pp.id}`,
        productId: p.id,
        name: p.name,
        slug: p.slug,
        thumbnailUrl: p.thumbnailUrl,
        supplierName: p.supplier?.companyName || null,
        regularPriceBDT: p.basePrice,
        dealPriceBDT,
        promotionName: promo.name,
        promotionType: promo.type,
        minOrderAmount: promo.minOrderAmount,
        validUntil: promo.validUntil.toISOString(),
        moq: p.moq,
        stockAvailable: p.stockQuantity,
      }
    })

    return NextResponse.json({ success: true, data: deals })
  } catch (error) {
    console.error('Exclusive deals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
