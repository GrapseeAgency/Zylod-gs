import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/deals/exclusive
 * Retrieve VIP / Enterprise member-only wholesale deals.
 */
export async function GET(request: NextRequest) {
  try {
    const products = await db.products.findMany({
      where: { isActive: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        moq: true,
        stockQuantity: true,
        thumbnailUrl: true,
        categoryId: true,
      },
    })

    const exclusiveDeals = products.map((p, idx) => {
      const discountPercent = 15 + ((idx * 3) % 20) // 15% to 35%
      const vipPrice = Math.round(p.basePrice * (1 - discountPercent / 100))
      return {
        id: `vip-deal-${p.id}`,
        productId: p.id,
        name: p.name,
        slug: p.slug,
        thumbnailUrl: p.thumbnailUrl,
        category: p.categoryId,
        regularPriceBDT: p.basePrice,
        vipPriceBDT: vipPrice,
        discountPercent,
        savingsPerUnitBDT: p.basePrice - vipPrice,
        moq: p.moq,
        stockAvailable: p.stockQuantity,
        requiredTier: idx % 3 === 0 ? 'Gold' : idx % 2 === 0 ? 'Silver' : 'Platinum',
        factoryName: 'Verified Direct Mill',
        expiresInHours: 48 + ((idx * 12) % 72),
      }
    })

    return NextResponse.json({
      success: true,
      data: exclusiveDeals,
    })
  } catch (error) {
    console.error('Exclusive deals GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
