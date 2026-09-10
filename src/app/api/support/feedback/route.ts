import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/feedback — get community suggestions & feedback
 * POST /api/support/feedback — submit new suggestion or feedback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    const feedback = await db.feedbackSubmissions.findMany({
      where: {
        ...(type ? { type } : {}),
        status: { in: ['new', 'reviewed', 'implemented'] },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ success: true, data: feedback })
  } catch (error) {
    console.error('Feedback GET error:', error)
    return NextResponse.json({ error: 'Failed to load feedback' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { type, subject, description, rating, pageContext } = body

    if (!type || !subject || !description) {
      return NextResponse.json({ error: 'Type, subject, and description are required' }, { status: 400 })
    }

    const feedback = await db.feedbackSubmissions.create({
      data: {
        userId: auth.authenticated && auth.user ? auth.user.id : null,
        type: String(type),
        subject: String(subject).trim(),
        description: String(description).trim(),
        rating: typeof rating === 'number' ? rating : null,
        pageContext: pageContext || 'feedback-page',
        status: 'new',
      },
    })

    return NextResponse.json({
      success: true,
      data: feedback,
      message: 'Thank you for your feedback! It helps improve our wholesale platform.',
    }, { status: 201 })
  } catch (error) {
    console.error('Feedback POST error:', error)
    return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 })
  }
}
