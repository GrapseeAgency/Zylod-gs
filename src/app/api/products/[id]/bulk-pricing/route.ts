import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Try to get product from database
    const product = await db.products.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        unit: true,
        moq: true,
        stockQuantity: true,
        thumbnailUrl: true,
        description: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            verificationStatus: true,
            ratingAvg: true,
          },
        },
        category: {
          select: { id: true, name: true, slug: true },
        },
        priceTiers: {
          orderBy: { minQty: 'asc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Map price tiers with computed discount
    const priceTiers = product.priceTiers.map((tier, idx) => {
      const discountPercent = product.basePrice > 0
        ? Math.round(((product.basePrice - tier.pricePerUnit) / product.basePrice) * 100)
        : 0

      return {
        tier: idx + 1,
        minQty: tier.minQty,
        maxQty: tier.maxQty,
        pricePerUnit: tier.pricePerUnit,
        discountPercent,
        label: tier.maxQty === null
          ? `${tier.minQty}+`
          : `${tier.minQty}-${tier.maxQty}`,
        status: 'available' as const,
      }
    })

    // Determine current tier based on a default quantity
    const defaultQty = product.moq || 50
    let currentTierIdx = 0
    for (let i = priceTiers.length - 1; i >= 0; i--) {
      if (defaultQty >= priceTiers[i].minQty) {
        currentTierIdx = i
        break
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          slug: product.slug,
          basePrice: product.basePrice,
          unit: product.unit,
          moq: product.moq,
          stockQuantity: product.stockQuantity,
          thumbnailUrl: product.thumbnailUrl,
          description: product.description,
          supplier: product.supplier,
          category: product.category,
        },
        priceTiers,
        stockInfo: {
          inStock: product.stockQuantity > 0,
          quantity: product.stockQuantity,
          shipsBy: 'Tomorrow',
        },
        currentTier: priceTiers[currentTierIdx] || null,
      },
    })
  } catch (error) {
    console.error('Bulk pricing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
