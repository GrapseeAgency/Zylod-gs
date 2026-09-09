import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/support/articles/[slug] — Fetch single full article and increment views
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const article = await db.helpArticles.findFirst({
      where: { slug, isPublished: true },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Increment views asynchronously
    db.helpArticles.update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    }).catch(() => {})

    return NextResponse.json({ success: true, data: article })
  } catch (error) {
    console.error('Article GET error:', error)
    return NextResponse.json({ error: 'Failed to load article' }, { status: 500 })
  }
}
