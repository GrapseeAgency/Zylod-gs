import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withApiCache } from '@/lib/api-cache'

/**
 * GET /api/suppliers — list suppliers with pagination, search, filtering
 * Query params: page, limit, search, verificationStatus, category, sort
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const search = searchParams.get('search') || ''
    const verificationStatus = searchParams.get('verificationStatus') || ''
    const categorySlug = searchParams.get('category') || ''
    const sort = searchParams.get('sort') || 'newest' // newest | rating | products

    const skip = (page - 1) * limit

    const { data: payload } = await withApiCache(
      `suppliers:list:${request.nextUrl.search}`,
      { ttlMs: 60_000, staleMs: 30 * 60_000 },
      async () => {
        const where: Record<string, unknown> = {}
        if (verificationStatus) where.verificationStatus = verificationStatus
        if (search) {
          where.companyName = { contains: search }
        }
        if (categorySlug) {
          where.products = { some: { category: { slug: categorySlug, isActive: true, isApproved: true } } }
        }

        const orderBy =
          sort === 'rating' ? { ratingAvg: 'desc' as const } :
          sort === 'products' ? { products: { _count: 'desc' as const } } :
          { createdAt: 'desc' as const }

        const [suppliers, total] = await Promise.all([
          db.supplierProfiles.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            include: {
              user: { select: { id: true, email: true, phone: true, accountStatus: true } },
              warehouseAddress: { select: { city: true, district: true } },
              _count: {
                select: {
                  products: { where: { isActive: true, isApproved: true } },
                  supplierReviews: true,
                },
              },
            },
          }),
          db.supplierProfiles.count({ where }),
        ])

        const data = suppliers.map(s => ({
          id: s.id,
          userId: s.userId,
          companyName: s.companyName,
          verificationStatus: s.verificationStatus,
          ratingAvg: s.ratingAvg,
          ratingCount: s._count.supplierReviews,
          productCount: s._count.products,
          city: s.warehouseAddress?.city || '',
          district: s.warehouseAddress?.district || '',
          createdAt: s.createdAt,
          accountStatus: s.user.accountStatus,
        }))

        return {
          data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        }
      }
    )

    return NextResponse.json({ success: true, ...payload })
  } catch (error) {
    console.error('Suppliers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
