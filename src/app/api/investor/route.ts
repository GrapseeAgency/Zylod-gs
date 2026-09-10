import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/investor
 * Returns all published investor documents grouped by type.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docType = searchParams.get('docType') || undefined
    const fiscalYear = searchParams.get('fiscalYear') || undefined

    const docs = await db.investorDocuments.findMany({
      where: {
        isPublished: true,
        ...(docType ? { docType } : {}),
        ...(fiscalYear ? { fiscalYear } : {}),
      },
      orderBy: [{ fiscalYear: 'desc' }, { publishedAt: 'desc' }],
    })

    const grouped: Record<string, typeof docs> = {}
    for (const doc of docs) {
      if (!grouped[doc.docType]) grouped[doc.docType] = []
      grouped[doc.docType].push(doc)
    }

    const years = [...new Set(docs.map(d => d.fiscalYear).filter(Boolean))].sort().reverse()

    return NextResponse.json({
      success: true,
      data: {
        documents: docs,
        grouped,
        years,
        docTypes: Object.keys(grouped),
        total: docs.length,
      },
    })
  } catch (error) {
    console.error('Investor docs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
