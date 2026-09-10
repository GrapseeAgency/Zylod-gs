import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/legal
 * Returns list of all active legal documents (TOC only, no full content).
 */
export async function GET(request: NextRequest) {
  try {
    const docs = await db.legalDocuments.findMany({
      where: { isActive: true },
      select: {
        id: true,
        docType: true,
        titleEn: true,
        titleBn: true,
        version: true,
        effectiveDate: true,
        updatedAt: true,
      },
      orderBy: { effectiveDate: 'asc' },
    })

    const grouped = {
      platformPolicies: docs.filter(d =>
        ['terms_of_service', 'privacy_policy', 'cookie_policy', 'dmca_policy'].includes(d.docType)
      ),
      transactionPolicies: docs.filter(d =>
        ['return_policy', 'shipping_policy', 'payment_terms', 'refund_policy'].includes(d.docType)
      ),
      wholesaleSpecific: docs.filter(d =>
        ['wholesale_terms'].includes(d.docType)
      ),
    }

    return NextResponse.json({
      success: true,
      data: {
        all: docs,
        grouped,
        lastUpdated: docs.length > 0 ? docs.reduce((a, b) =>
          new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b
        ).updatedAt : null,
      },
    })
  } catch (error) {
    console.error('Legal docs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
