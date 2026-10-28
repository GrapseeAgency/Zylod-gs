import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/legal/dmca/[id]
 * Returns the status of a specific DMCA report by ID.
 * ADMIN-ONLY: a report carries the complainant's name and email —
 * serving it to unauthenticated callers leaks a reporter's PII to anyone
 * holding the id (same gate as the admin list at GET /api/legal/dmca).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user || auth.user.userType !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
