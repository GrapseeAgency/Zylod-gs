import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/press
 * Returns paginated list of press releases. Filter by category.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')

    const [releases, total] = await Promise.all([
      db.pressReleases.findMany({
        where: {
          isPublished: true,
          ...(category ? { category } : {}),
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          category: true,
          imageUrl: true,
          authorName: true,
          publishedAt: true,
          views: true,
        },
      }),
      db.pressReleases.count({
        where: { isPublished: true, ...(category ? { category } : {}) },
      }),
    ])

    const categories = await db.pressReleases.findMany({
      where: { isPublished: true },
      distinct: ['category'],
      select: { category: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        releases,
        categories: categories.map(c => c.category),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (error) {
    console.error('Press releases GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
