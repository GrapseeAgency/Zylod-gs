import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const categoryId = searchParams.get('categoryId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'newest' // newest | price_low | price_high | popular

    // Get all active categories for the catalog
    const categories = await db.categories.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: {
              where: { isActive: true, isApproved: true },
            },
          },
        },
      },
    })

    // Build category tree
    const categoryTree = categories
      .filter(c => !c.parentId)
      .map(parent => ({
        id: parent.id,
        name: parent.name,
        slug: parent.slug,
        iconUrl: parent.iconUrl,
        productCount: parent._count.products,
        children: categories
          .filter(c => c.parentId === parent.id)
          .map(child => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
            iconUrl: child.iconUrl,
            productCount: child._count.products,
          })),
      }))

    // Get featured products (top-rated, with bulk pricing)
    const featuredProducts = await db.products.findMany({
      where: {
        isActive: true,
        isApproved: true,
        ...(categoryId ? { categoryId } : {}),
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
        },
        reviews: {
          select: { rating: true },
        },
      },
      take: 8,
      orderBy: { createdAt: 'desc' },
    })

    // Get catalog products with pagination
    const where: Record<string, unknown> = {
      isActive: true,
      isApproved: true,
    }
    if (categoryId) {
      where.categoryId = categoryId
    }

    const total = await db.products.count({ where })

    const orderBy: Prisma.productsOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'price_low':
          return { basePrice: 'asc' }
        case 'price_high':
          return { basePrice: 'desc' }
        case 'popular':
          return { stockQuantity: 'desc' }
        default:
          return { createdAt: 'desc' }
      }
    })()

    const catalogProducts = await db.products.findMany({
      where,
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
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })

    // Map catalog products
    const mappedCatalog = catalogProducts.map(product => {
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
        category: product.category,
        supplier: {
          id: product.supplier.id,
          companyName: product.supplier.companyName,
          verificationStatus: product.supplier.verificationStatus,
          ratingAvg: product.supplier.ratingAvg,
        },
        bulkPricing: product.priceTiers.map(tier => ({
          minQty: tier.minQty,
          maxQty: tier.maxQty,
          pricePerUnit: tier.pricePerUnit,
          savings: product.basePrice > 0
            ? Math.round(((product.basePrice - tier.pricePerUnit) / product.basePrice) * 100)
            : 0,
        })),
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: product.reviews.length,
        isWholesaleEligible: product.moq > 1,
        maxSavings: product.priceTiers.length > 0 && product.basePrice > 0
          ? Math.round(((product.basePrice - product.priceTiers[product.priceTiers.length - 1].pricePerUnit) / product.basePrice) * 100)
          : 0,
      }
    })

    // Map featured products
    const mappedFeatured = featuredProducts.map(product => {
      const avgRating = product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        currency: product.currency,
        unit: product.unit,
        moq: product.moq,
        thumbnailUrl: product.thumbnailUrl,
        image: product.images[0]?.imageUrl || null,
        category: product.category,
        supplier: {
          id: product.supplier.id,
          companyName: product.supplier.companyName,
          verificationStatus: product.supplier.verificationStatus,
        },
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: product.reviews.length,
        bulkPricing: product.priceTiers.map(tier => ({
          minQty: tier.minQty,
          maxQty: tier.maxQty,
          pricePerUnit: tier.pricePerUnit,
        })),
        maxSavings: product.priceTiers.length > 0 && product.basePrice > 0
          ? Math.round(((product.basePrice - product.priceTiers[product.priceTiers.length - 1].pricePerUnit) / product.basePrice) * 100)
          : 0,
      }
    })

    // Compute catalog stats
    const totalProducts = await db.products.count({
      where: { isActive: true, isApproved: true },
    })
    const totalSuppliers = await db.supplierProfiles.count({
      where: { verificationStatus: 'approved' },
    })

    return NextResponse.json({
      success: true,
      data: {
        catalog: {
          categories: categoryTree,
          featuredProducts: mappedFeatured,
          products: mappedCatalog,
          stats: {
            totalProducts,
            totalSuppliers,
            totalCategories: categoryTree.length,
          },
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Wholesale catalog GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
