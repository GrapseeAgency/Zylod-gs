import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '8')

    const currentProduct = await db.products.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        basePrice: true,
        name: true,
      },
    })

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const similarProducts = await db.products.findMany({
      where: {
        categoryId: currentProduct.categoryId,
        id: { not: id },
        isActive: true,
        isApproved: true,
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
        images: {
          where: { sortOrder: 0 },
          take: 1,
        },
        priceTiers: {
          orderBy: { minQty: 'asc' },
          take: 1,
        },
        reviews: {
          select: { rating: true },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    const enrichedProducts = similarProducts.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0
      const priceDiff = Math.abs(product.basePrice - currentProduct.basePrice)
      const maxPrice = Math.max(product.basePrice, currentProduct.basePrice)
      const priceSimilarity = maxPrice > 0 ? 1 - (priceDiff / maxPrice) : 1

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        unit: product.unit,
        moq: product.moq,
        stock: product.stockQuantity,
        thumbnailUrl: product.thumbnailUrl,
        image: product.images[0]?.imageUrl || null,
        category: product.category,
        categorySlug: product.category?.slug,
        similarityScore: Math.round(priceSimilarity * 100),
        matchPercentage: Math.round(priceSimilarity * 100),
        bulkPrice: product.priceTiers[0]?.pricePerUnit || product.basePrice,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: product.reviews.length,
      }
    })

    enrichedProducts.sort((a, b) => b.similarityScore - a.similarityScore)

    return NextResponse.json({
      success: true,
      data: {
        currentProduct: {
          id: currentProduct.id,
          name: currentProduct.name,
        },
        similarProducts: enrichedProducts,
        total: enrichedProducts.length,
      },
    })
  } catch (error) {
    console.error('Similar products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
