import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/categories/tree
 * Returns nested category tree with sub-categories and product counts
 */
export async function GET(request: NextRequest) {
  try {
    const categories = await db.categories.findMany({
      where: {
        isActive: true,
        parentId: null
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        iconUrl: true,
        sortOrder: true,
        _count: {
          select: { products: true }
        },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: { products: true }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Categories tree error:', error)
    return NextResponse.json({ error: 'Failed to load category tree' }, { status: 500 })
  }
}
