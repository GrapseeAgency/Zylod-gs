import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '4')

    const currentProduct = await db.products.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        supplierId: true,
        basePrice: true,
        currency: true,
        unit: true,
      },
    })

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const [sameSupplierProducts, sameCategoryProducts] = await Promise.all([
      db.products.findMany({
        where: {
          supplierId: currentProduct.supplierId,
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
            },
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
      }),
      db.products.findMany({
        where: {
          categoryId: currentProduct.categoryId,
          supplierId: { not: currentProduct.supplierId },
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
            },
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
      }),
    ])

    const combinedProducts = [...sameSupplierProducts, ...sameCategoryProducts]
      .filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx)
      .slice(0, limit)

    const frequentlyBoughtTogether = combinedProducts.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0

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
        reason: 'Frequently bought together',
        isCurrent: false,
        colorFrom: '#E53935',
        colorTo: '#FF8A80',
      }
    })

    // Add current product as first item
    frequentlyBoughtTogether.unshift({
      id: currentProduct.id,
      name: currentProduct.name,
      slug: currentProduct.slug,
      basePrice: currentProduct.basePrice,
      unit: currentProduct.unit,
      moq: 1,
      stock: 0,
      thumbnailUrl: null,
      image: null,
      reason: 'Current product',
      isCurrent: true,
      colorFrom: '#E53935',
      colorTo: '#FF8A80',
    })

    const totalBundlePrice = frequentlyBoughtTogether.reduce((sum, p) => sum + p.basePrice, 0)
    const bundleDiscount = Math.round(totalBundlePrice * 0.10)

    return NextResponse.json({
      success: true,
      data: {
        currentProduct: {
          id: currentProduct.id,
          name: currentProduct.name,
          basePrice: currentProduct.basePrice,
          currency: currentProduct.currency,
          unit: currentProduct.unit,
        },
        frequentlyBoughtTogether,
        bundleOffer: {
          totalItems: frequentlyBoughtTogether.length,
          totalOriginalPrice: totalBundlePrice,
          bundleDiscount,
          bundlePrice: totalBundlePrice - bundleDiscount,
          savingsPercent: 10,
          currency: currentProduct.currency,
        },
      },
    })
  } catch (error) {
    console.error('Frequently bought together GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
