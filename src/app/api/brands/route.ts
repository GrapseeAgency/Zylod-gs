import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiCache } from '@/lib/api-cache'

/**
 * GET /api/brands — brand directory for the Brand Showcase.
 * Returns every brand that has active approved products, with product counts,
 * an aggregated rating, and a representative product thumbnail.
 * Query params: search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 60)))

    const { data: payload } = await withApiCache(
      `brands:list:${request.nextUrl.search}`,
      { ttlMs: 60_000, staleMs: 30 * 60_000 },
      async () => {
        const where = {
          isActive: true,
          isApproved: true,
          brand: { not: null as string | null },
          ...(search ? { brand: { contains: search } } : {}),
        }

        const grouped = await db.products.groupBy({
          by: ['brand'],
          where,
          _count: { _all: true },
          _avg: { ratingAvg: true },
          _min: { basePrice: true },
          orderBy: { _count: { brand: 'desc' } },
        })

        const total = grouped.length
        const paged = grouped.slice((page - 1) * limit, page * limit)

        // Representative thumbnail + top product per brand
        const brands = await Promise.all(
          paged.map(async (g) => {
            const rep = await db.products.findFirst({
              where: { ...where, brand: g.brand },
              orderBy: { soldCount: 'desc' },
              select: {
                id: true,
                name: true,
                slug: true,
                thumbnailUrl: true,
                images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } },
                category: { select: { name: true, slug: true } },
              },
            })

            return {
              name: g.brand,
              productCount: g._count._all,
              avgRating: g._avg.ratingAvg ? Number(g._avg.ratingAvg.toFixed(1)) : null,
              startingPrice: g._min.basePrice,
              representativeProduct: rep
                ? {
                    id: rep.id,
                    name: rep.name,
                    slug: rep.slug,
                    image: rep.images[0]?.imageUrl || rep.thumbnailUrl || null,
                    categoryName: rep.category?.name || null,
                  }
                : null,
            }
          })
        )

        return {
          data: brands.filter((b) => b.representativeProduct !== null),
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
      }
    )

    return NextResponse.json({ success: true, ...payload })
  } catch (error) {
    console.error('Brands list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
