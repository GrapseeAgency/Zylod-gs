import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const productIdsParam = searchParams.get('productIds')
    const buyerId = searchParams.get('buyerId')

    // If buyerId is provided, get their compare list from the database
    if (buyerId) {
      const compareItems = await db.compareItems.findMany({
        where: { buyerId },
        include: {
          product: {
            include: {
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
              specifications: { orderBy: { sortOrder: 'asc' } },
              images: {
                where: { sortOrder: 0 },
                take: 1,
              },
              priceTiers: { orderBy: { minQty: 'asc' } },
              variants: true,
              reviews: {
                select: { rating: true },
              },
            },
          },
        },
        orderBy: { addedAt: 'desc' },
      })

      const enrichedProducts = compareItems.map(item => {
        const product = item.product
        const avgRating = product.reviews.length > 0
          ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
          : 0

        return {
          compareItemId: item.id,
          addedAt: item.addedAt,
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          brand: product.brand,
          basePrice: product.basePrice,
          currency: product.currency,
          unit: product.unit,
          moq: product.moq,
          maxOrderQty: product.maxOrderQty,
          stockQuantity: product.stockQuantity,
          thumbnailUrl: product.thumbnailUrl,
          image: product.images[0]?.imageUrl || null,
          supplier: product.supplier,
          category: product.category,
          specifications: product.specifications,
          priceTiers: product.priceTiers,
          variants: product.variants,
          avgRating: Math.round(avgRating * 10) / 10,
          totalReviews: product.reviews.length,
        }
      })

      // Build comparison matrix from specifications
      const specComparison = buildSpecComparison(enrichedProducts)

      return NextResponse.json({
        success: true,
        data: {
          products: enrichedProducts,
          specComparison,
          totalItems: enrichedProducts.length,
        },
      })
    }

    // If productIds are provided directly via query param
    if (!productIdsParam) {
      return NextResponse.json(
        { error: 'Either buyerId or productIds query parameter is required' },
        { status: 400 }
      )
    }

    const productIds = productIdsParam.split(',').filter(Boolean)

    if (productIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 product IDs are required for comparison' },
        { status: 400 }
      )
    }

    if (productIds.length > 4) {
      return NextResponse.json(
        { error: 'Maximum 4 products can be compared at a time' },
        { status: 400 }
      )
    }

    const products = await db.products.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
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
        specifications: { orderBy: { sortOrder: 'asc' } },
        images: {
          where: { sortOrder: 0 },
          take: 1,
        },
        priceTiers: { orderBy: { minQty: 'asc' } },
        variants: true,
        reviews: {
          select: { rating: true },
        },
      },
    })

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found for the given IDs' },
        { status: 404 }
      )
    }

    const enrichedProducts = products.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        brand: product.brand,
        basePrice: product.basePrice,
        currency: product.currency,
        unit: product.unit,
        moq: product.moq,
        maxOrderQty: product.maxOrderQty,
        stockQuantity: product.stockQuantity,
        thumbnailUrl: product.thumbnailUrl,
        image: product.images[0]?.imageUrl || null,
        supplier: product.supplier,
        category: product.category,
        specifications: product.specifications,
        priceTiers: product.priceTiers,
        variants: product.variants,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: product.reviews.length,
      }
    })

    // Build comparison matrix from specifications
    const specComparison = buildSpecComparison(enrichedProducts)

    return NextResponse.json({
      success: true,
      data: {
        products: enrichedProducts,
        specComparison,
        totalItems: enrichedProducts.length,
      },
    })
  } catch (error) {
    console.error('Product compare GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { buyerId, productId } = body

    if (!buyerId || !productId) {
      return NextResponse.json(
        { error: 'buyerId and productId are required' },
        { status: 400 }
      )
    }

    // Verify product exists
    const product = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if buyer exists
    const buyer = await db.users.findUnique({ where: { id: buyerId } })
    if (!buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
    }

    // Check if already in compare list
    const existing = await db.compareItems.findFirst({
      where: { buyerId, productId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Product is already in your compare list' },
        { status: 409 }
      )
    }

    // Check compare list limit (max 4)
    const currentCount = await db.compareItems.count({
      where: { buyerId },
    })

    if (currentCount >= 4) {
      return NextResponse.json(
        { error: 'Compare list can hold a maximum of 4 products. Remove one first.' },
        { status: 400 }
      )
    }

    const compareItem = await db.compareItems.create({
      data: {
        buyerId,
        productId,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: compareItem.id,
          buyerId: compareItem.buyerId,
          productId: compareItem.productId,
          addedAt: compareItem.addedAt,
        },
        message: `${product.name} added to compare list`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Product compare POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { buyerId, productId } = body

    if (!buyerId || !productId) {
      return NextResponse.json(
        { error: 'buyerId and productId are required' },
        { status: 400 }
      )
    }

    const compareItem = await db.compareItems.findFirst({
      where: { buyerId, productId },
    })

    if (!compareItem) {
      return NextResponse.json(
        { error: 'Product not found in compare list' },
        { status: 404 }
      )
    }

    await db.compareItems.delete({
      where: { id: compareItem.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Product removed from compare list',
    })
  } catch (error) {
    console.error('Product compare DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper: Build a specification comparison matrix
function buildSpecComparison(
  products: Array<{
    id: string
    basePrice: number
    moq: number
    stockQuantity: number
    specifications: Array<{ specName: string; specValue: string; sortOrder: number }>
  }>
) {
  // Collect all unique spec names across all products
  const allSpecNames = new Set<string>()
  for (const product of products) {
    for (const spec of product.specifications) {
      allSpecNames.add(spec.specName)
    }
  }

  // Build comparison matrix
  const specNames = Array.from(allSpecNames)
  const comparison = specNames.map(specName => {
    const values: Record<string, string> = {}
    for (const product of products) {
      const spec = product.specifications.find(s => s.specName === specName)
      values[product.id] = spec?.specValue || '—'
    }
    return {
      specName,
      values,
    }
  })

  // Add built-in fields for comparison
  const builtInComparison = [
    { specName: 'Price', values: Object.fromEntries(products.map(p => [p.id, String(p.basePrice)])) },
    { specName: 'MOQ', values: Object.fromEntries(products.map(p => [p.id, String(p.moq)])) },
    { specName: 'Stock', values: Object.fromEntries(products.map(p => [p.id, String(p.stockQuantity)])) },
  ]

  return [...builtInComparison, ...comparison]
}
