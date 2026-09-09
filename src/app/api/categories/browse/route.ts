import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/categories/browse
 * Returns detailed category directory with metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))

    const categories = await db.categories.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' }
      ],
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true,
        sortOrder: true,
        _count: {
          select: { products: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Categories browse error:', error)
    return NextResponse.json({ error: 'Failed to browse categories' }, { status: 500 })
  }
}
