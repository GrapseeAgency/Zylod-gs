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
      select: { id: true, name: true, basePrice: true, unit: true, moq: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const priceTiers = await db.productPriceTiers.findMany({
      where: { productId: id },
      orderBy: { minQty: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          unit: product.unit,
          moq: product.moq,
        },
        priceTiers,
      },
    })
  } catch (error) {
    console.error('Price tiers error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
