import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiCache } from '@/lib/api-cache'

/* ─── Allowed sort fields (must exist in Prisma schema) ─── */
const ALLOWED_SORT_FIELDS = new Set([
  'createdAt', 'basePrice', 'name', 'soldCount', 'ratingAvg', 'reviewCount',
  'stockQuantity', 'moq', 'updatedAt',
])

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const supplier = searchParams.get('supplier')
    const supplierId = searchParams.get('supplierId')
    const brand = searchParams.get('brand')
    const clearance = searchParams.get('clearance')
    const seasonal = searchParams.get('seasonal')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'

    // Validate sort field
    const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt'

    // Results are not personalized in this handler, so the cache key is the
    // raw query string — identical listing requests hit memory instead of the DB.
    const { data: result } = await withApiCache(
      `products:list:${request.nextUrl.search}`,
      { ttlMs: 60_000, staleMs: 30 * 60_000 },
      async () => {
        const where: Record<string, unknown> = {
          isActive: true,
          isApproved: true,
        }

        if (category && category !== 'all') {
          where.category = { slug: category }
        }

        if (search) {
          // Sanitize search input — case-insensitive so "COTTON", "cotton", "Cotton" all match
          const sanitizedSearch = search.trim().slice(0, 200)
          where.OR = [
            { name: { contains: sanitizedSearch } },
            { description: { contains: sanitizedSearch } },
            { brand: { contains: sanitizedSearch } },
            { sku: { contains: sanitizedSearch } },
          ]
        }

        if (minPrice || maxPrice) {
          const priceFilter: Record<string, number> = {}
          if (minPrice) priceFilter.gte = parseFloat(minPrice)
          if (maxPrice) priceFilter.lte = parseFloat(maxPrice)
          where.basePrice = priceFilter
        }

        if (supplier) {
          where.supplier = { companyName: { contains: supplier } }
        }

        if (supplierId) {
          where.supplierId = supplierId
        }

        if (brand) {
          where.brand = { equals: brand }
        }

        if (clearance === 'true') {
          where.isClearance = true
        }

        if (seasonal === 'true') {
          where.isSeasonal = true
        }

        const [total, products] = await Promise.all([
          db.products.count({ where }),
          db.products.findMany({
            where,
            include: {
              supplier: { select: { id: true, companyName: true, ratingAvg: true } },
              category: { select: { id: true, name: true, slug: true } },
              images: { orderBy: { sortOrder: 'asc' } },
              priceTiers: { orderBy: { minQty: 'asc' } },
              variants: true,
            },
            orderBy: { [safeSortBy]: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
          }),
        ])

        return {
          data: products,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      }
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Products list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
