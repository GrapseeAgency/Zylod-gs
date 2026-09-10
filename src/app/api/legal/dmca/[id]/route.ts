import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/legal/dmca/[id]
 * Returns the status of a specific DMCA report by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const report = await db.dmcaReports.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        complainantName: true,
        complainantEmail: true,
        infringingUrl: true,
        copyrightOwner: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'DMCA report not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        ticketRef: `DMCA-${report.id.slice(-8).toUpperCase()}`,
        estimatedResponseDays: report.status === 'pending' ? 3 : 0,
      },
    })
  } catch (error) {
    console.error('DMCA report GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
