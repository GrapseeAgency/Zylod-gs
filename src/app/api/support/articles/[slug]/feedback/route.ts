import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/support/articles/[slug]/feedback
 * Body: { helpful: boolean, comment?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { helpful, comment } = body

    const article = await db.helpArticles.findFirst({
      where: { slug },
      select: { id: true, titleEn: true },
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    await db.feedbackSubmissions.create({
      data: {
        userId: auth.authenticated && auth.user ? auth.user.id : null,
        type: 'rating',
        subject: `Article Feedback: ${article.titleEn}`,
        description: `Helpful: ${helpful ? 'Yes' : 'No'}. Comment: ${comment || 'None'}`,
        rating: helpful ? 5 : 1,
        pageContext: `article/${slug}`,
        status: 'new',
      },
    })

    return NextResponse.json({ success: true, message: 'Thank you for your feedback!' })
  } catch (error) {
    console.error('Article feedback error:', error)
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 })
  }
}
