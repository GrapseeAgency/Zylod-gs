import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/search?q=...&category=...&minPrice=...&maxPrice=...&moq=...&sort=...&page=...&limit=...
 * Real DB full-text search with faceted filtering and pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || searchParams.get('query') || '').trim()
    const category = searchParams.get('category') || undefined
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined
    const maxMoq = searchParams.get('maxMoq') || searchParams.get('moq') ? parseInt(searchParams.get('maxMoq') || searchParams.get('moq')!) : undefined
    const sortBy = searchParams.get('sortBy') || searchParams.get('sort') || 'soldCount'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
      isApproved: true,
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { brand: { contains: q } },
        { sku: { contains: q } },
        { tags: { has: q } }
      ]
    }

    if (category) {
      where.category = {
        slug: category
      }
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {}
      if (minPrice !== undefined) where.basePrice.gte = minPrice
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice
    }

    if (maxMoq !== undefined) {
      where.moq = { lte: maxMoq }
    }

    let orderBy: any = {}
    if (sortBy === 'price' || sortBy === 'basePrice') {
      orderBy = { basePrice: order }
    } else if (sortBy === 'newest' || sortBy === 'createdAt') {
      orderBy = { createdAt: 'desc' }
    } else if (sortBy === 'rating' || sortBy === 'ratingAvg') {
      orderBy = { ratingAvg: 'desc' }
    } else {
      orderBy = { soldCount: 'desc' }
    }

    const [products, total] = await Promise.all([
      db.products.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          brand: true,
          basePrice: true,
          currency: true,
          unit: true,
          moq: true,
          stockQuantity: true,
          ratingAvg: true,
          reviewCount: true,
          soldCount: true,
          thumbnailUrl: true,
          images: { select: { imageUrl: true }, take: 1 },
          supplier: {
            select: {
              id: true,
              companyName: true,
              verificationStatus: true
            }
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          priceTiers: {
            orderBy: { minQty: 'asc' },
            select: { minQty: true, maxQty: true, pricePerUnit: true }
          }
        }
      }),
      db.products.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Search operation failed' }, { status: 500 })
  }
}
