import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/search/suggestions?q=...
 * Live typeahead suggestions from real DB entities:
 *   - products (name/brand/sku contains)
 *   - categories (name contains)
 *   - suppliers (company name contains)
 *   - fallbackSuggestions: popular/trending searches related to the query
 */
export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
    const limit = Math.min(8, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 8)))

    if (!q) {
      return NextResponse.json({ success: true, data: { products: [], categories: [], suppliers: [], fallbackSuggestions: [] } })
    }

    const contains = { contains: q }

    const [products, categories, suppliers, popular] = await Promise.all([
      db.products.findMany({
        where: {
          isActive: true, isApproved: true,
          OR: [{ name: contains }, { brand: contains }, { sku: contains }],
        },
        select: {
          id: true, name: true, basePrice: true, thumbnailUrl: true,
          category: { select: { name: true } },
        },
        orderBy: { soldCount: 'desc' },
        take: limit,
      }),
      db.categories.findMany({
        where: { name: contains },
        select: { id: true, name: true, slug: true },
        take: 4,
      }),
      db.supplierProfiles.findMany({
        where: { companyName: contains },
        select: { id: true, companyName: true, ratingAvg: true },
        take: 4,
      }),
      db.popularSearches.findMany({
        where: { query: contains },
        orderBy: [{ trendingScore: 'desc' }, { searchCount: 'desc' }],
        select: { query: true },
        take: limit,
      }),
    ])

    // Top product-name completions when nothing else matches
    let fallbackSuggestions = popular.map(p => p.query)
    if (fallbackSuggestions.length === 0 && products.length === 0 && categories.length === 0 && suppliers.length === 0) {
      const anyProducts = await db.products.findMany({
        where: { isActive: true, isApproved: true },
        orderBy: { soldCount: 'desc' },
        select: { name: true },
        take: limit,
      })
      fallbackSuggestions = anyProducts.map(p => p.name.split(' - ')[0])
    }

    return NextResponse.json({
      success: true,
      data: {
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          basePrice: p.basePrice,
          thumbnailUrl: p.thumbnailUrl,
          category: p.category,
        })),
        categories,
        suppliers,
        fallbackSuggestions,
      },
    })
  } catch (error) {
    console.error('Search suggestions error:', error)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}
