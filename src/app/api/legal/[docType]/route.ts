import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/legal/[docType]
 * Returns full content of a specific legal document by docType slug.
 * Also returns related FAQs and the version history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  try {
    const { docType } = await params

    const doc = await db.legalDocuments.findUnique({
      where: { docType },
    })

    if (!doc || !doc.isActive) {
      return NextResponse.json({ error: 'Legal document not found' }, { status: 404 })
    }

    // Increment view (via helpArticles if slug matches)
    const faqs = await db.faqItems.findMany({
      where: { category: docType, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    // Related documents
    const related = await db.legalDocuments.findMany({
      where: { isActive: true, docType: { not: docType } },
      select: { id: true, docType: true, titleEn: true, updatedAt: true },
      take: 4,
    })

    return NextResponse.json({
      success: true,
      data: {
        document: doc,
        faqs,
        related,
        meta: {
          effectiveDate: doc.effectiveDate,
          version: doc.version,
          lastUpdated: doc.updatedAt,
        },
      },
    })
  } catch (error) {
    console.error('Legal doc detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
