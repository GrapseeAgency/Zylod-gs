import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/support/articles?category=...&q=...
 * Lists published help and policy articles grouped by category.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const q = (searchParams.get('q') || '').trim()

    const where: any = {
      isPublished: true,
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (q) {
      where.OR = [
        { titleEn: { contains: q } },
        { contentEn: { contains: q } },
        { titleBn: { contains: q } },
        { contentBn: { contains: q } },
      ]
    }

    const articles = await db.helpArticles.findMany({
      where,
      orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        category: true,
        slug: true,
        titleEn: true,
        titleBn: true,
        views: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: articles,
      total: articles.length,
    })
  } catch (error) {
    console.error('Articles GET error:', error)
    return NextResponse.json({ error: 'Failed to load articles' }, { status: 500 })
  }
}
