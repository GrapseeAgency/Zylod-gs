import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/support/faqs?category=...&q=...&lang=en|bn
 * Retrieve categorized FAQs with live helpful feedback counts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const q = (searchParams.get('q') || '').trim()

    const where: any = {
      isActive: true,
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (q) {
      where.OR = [
        { questionEn: { contains: q } },
        { answerEn: { contains: q } },
        { questionBn: { contains: q } },
        { answerBn: { contains: q } },
      ]
    }

    const faqs = await db.faqItems.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({
      success: true,
      data: faqs,
      total: faqs.length,
    })
  } catch (error) {
    console.error('FAQs GET error:', error)
    return NextResponse.json({ error: 'Failed to load FAQs' }, { status: 500 })
  }
}

/**
 * POST /api/support/faqs — admin or internal FAQ creator
 */
export async function POST(request: NextRequest) {
  // Admin-only: FAQ entries are site-wide support content rendered on the
  // public help pages. This POST previously had NO auth — anyone on the
  // internet could publish isActive:true FAQ content instantly (found in the
  // Task 152 full-app audit).
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'support-faqs-write', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json()
    const { category, questionEn, answerEn, questionBn, answerBn, sortOrder } = body

    if (!category || !questionEn || !answerEn) {
      return NextResponse.json({ error: 'category, questionEn, and answerEn are required' }, { status: 400 })
    }

    const faq = await db.faqItems.create({
      data: {
        category,
        questionEn,
        answerEn,
        questionBn: questionBn || null,
        answerBn: answerBn || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, data: faq }, { status: 201 })
  } catch (error) {
    console.error('FAQ POST error:', error)
    return NextResponse.json({ error: 'Failed to create FAQ item' }, { status: 500 })
  }
}
