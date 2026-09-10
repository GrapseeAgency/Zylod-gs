import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/legal/faq?docType=terms_of_service
 * Returns all FAQs for a given legal document type.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docType = searchParams.get('docType')

    const faqs = await db.faqItems.findMany({
      where: {
        isActive: true,
        ...(docType ? { category: docType } : {}),
      },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    })

    return NextResponse.json({ success: true, data: faqs, total: faqs.length })
  } catch (error) {
    console.error('Legal FAQ GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
