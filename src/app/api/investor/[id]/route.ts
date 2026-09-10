import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/investor/[id]
 * Returns a specific investor document by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const doc = await db.investorDocuments.findFirst({
      where: { id, isPublished: true },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Investor document not found' }, { status: 404 })
    }

    // Related docs of same type
    const related = await db.investorDocuments.findMany({
      where: { isPublished: true, docType: doc.docType, id: { not: doc.id } },
      take: 4,
      orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, fiscalYear: true, fiscalQ: true, publishedAt: true },
    })

    return NextResponse.json({
      success: true,
      data: { ...doc, related },
    })
  } catch (error) {
    console.error('Investor doc detail GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
