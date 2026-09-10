import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/support/policies
 * Returns table of contents and full policy documents across all categories in EN and BN.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const articles = await db.helpArticles.findMany({
      where: {
        isPublished: true,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'asc' },
    })

    const categories = Array.from(new Set(articles.map(a => a.category)))

    const toc = categories.map(cat => ({
      category: cat,
      articles: articles
        .filter(a => a.category === cat)
        .map(a => ({
          id: a.id,
          slug: a.slug,
          titleEn: a.titleEn,
          titleBn: a.titleBn,
          views: a.views,
        })),
    }))

    return NextResponse.json({
      success: true,
      data: {
        tableOfContents: toc,
        totalArticles: articles.length,
        articles,
      },
    })
  } catch (error) {
    console.error('Policies GET error:', error)
    return NextResponse.json({ error: 'Failed to load policy documentation' }, { status: 500 })
  }
}
