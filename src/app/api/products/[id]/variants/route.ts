import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const product = await db.products.findUnique({
      where: { id },
      select: { id: true, name: true, basePrice: true, currency: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const variants = await db.productVariants.findMany({
      where: { productId: id },
      orderBy: { variantName: 'asc' },
    })

    const groupedVariants: Record<string, Array<{
      id: string
      variantValue: string
      sku: string | null
      stockQuantity: number
      priceOverride: number | null
      isAvailable: boolean
    }>> = {}

    for (const variant of variants) {
      if (!groupedVariants[variant.variantName]) {
        groupedVariants[variant.variantName] = []
      }
      groupedVariants[variant.variantName].push({
        id: variant.id,
        variantValue: variant.variantValue,
        sku: variant.sku,
        stockQuantity: variant.stockQuantity,
        priceOverride: variant.priceOverride,
        isAvailable: variant.stockQuantity > 0,
      })
    }

    const totalVariants = variants.length
    const availableVariants = variants.filter(v => v.stockQuantity > 0).length
    const totalStock = variants.reduce((sum, v) => sum + v.stockQuantity, 0)

    const allPrices = variants
      .map(v => v.priceOverride ?? product.basePrice)
      .filter((p): p is number => p !== null)
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : product.basePrice
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : product.basePrice

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          currency: product.currency,
        },
        variants: variants.map(v => ({
          id: v.id,
          variantName: v.variantName,
          variantValue: v.variantValue,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          priceOverride: v.priceOverride,
          effectivePrice: v.priceOverride ?? product.basePrice,
          isAvailable: v.stockQuantity > 0,
        })),
        groupedVariants,
        summary: {
          totalVariants,
          availableVariants,
          outOfStockVariants: totalVariants - availableVariants,
          totalStock,
          priceRange: {
            min: minPrice,
            max: maxPrice,
            currency: product.currency,
            hasVariantsPricing: minPrice !== maxPrice,
          },
        },
      },
    })
  } catch (error) {
    console.error('Product variants GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
