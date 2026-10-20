import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/promotion-participation — the SELLER side of the
 * platform promotion rail (Task 102). "Everything here connects to admin":
 * when the platform's admin pins a supplier's product into a campaign, the
 * supplier SEES it — campaign, rule, window, which products — instead of
 * discovering it from a discounted order.
 *
 * Only LIVE campaigns are served (active + inside the window — the same
 * filter the pricing engine applies). Only THIS supplier's products are
 * counted; another supplier's pins never leak into the payload. The
 * economic truth rides in the UI copy: the platform funds the discount —
 * the supplier is always paid the full line value (escrow = subOrder
 * subtotal, drill-proven in t100/t101).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }
    const rl = checkRateLimit(request, 'supplier-promotion-participation', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const now = new Date()
    const pins = await db.promotionProducts.findMany({
      where: {
        product: { supplierId: profile.id },
        promotion: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now } },
      },
      select: {
        promotion: {
          select: {
            id: true, name: true, description: true, type: true, value: true,
            minOrderAmount: true, maxDiscount: true, validFrom: true, validUntil: true,
          },
        },
        product: { select: { id: true, name: true } },
      },
    })

    // Group by campaign, preserve the ends-soonest order the public rail uses.
    const byCampaign = new Map<string, { promotion: (typeof pins)[number]['promotion']; products: Array<{ id: string; name: string }> }>()
    for (const pin of pins) {
      let entry = byCampaign.get(pin.promotion.id)
      if (!entry) {
        entry = { promotion: pin.promotion, products: [] }
        byCampaign.set(pin.promotion.id, entry)
      }
      if (!entry.products.some((p) => p.id === pin.product.id)) {
        entry.products.push(pin.product)
      }
    }

    const data = [...byCampaign.values()]
      .sort((a, b) => a.promotion.validUntil.getTime() - b.promotion.validUntil.getTime())
      .map(({ promotion, products }) => ({
        id: promotion.id,
        name: promotion.name,
        description: promotion.description,
        type: promotion.type,
        value: promotion.value,
        minOrderAmount: promotion.minOrderAmount,
        maxDiscount: promotion.maxDiscount,
        validFrom: promotion.validFrom.toISOString(),
        validUntil: promotion.validUntil.toISOString(),
        products,
      }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Supplier promotion participation GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
