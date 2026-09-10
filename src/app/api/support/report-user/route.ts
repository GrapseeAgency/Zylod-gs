import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/support/report-user
 * Report fraudulent seller, counterfeit goods, scam, or harassment
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { reportedUserId, reason, description, evidence, relatedOrderId } = body

    if (!reportedUserId || !reason || !description) {
      return NextResponse.json({ error: 'Reported user ID, reason, and description are required' }, { status: 400 })
    }

    const report = await db.reportedUsers.create({
      data: {
        reporterId: auth.user.id,
        reportedUserId,
        reason: String(reason),
        description: String(description).trim(),
        evidence: evidence ? JSON.stringify(evidence) : null,
        relatedOrderId: relatedOrderId || null,
        status: 'pending',
      },
    })

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Report submitted. Our Trust & Safety team will review this violation within 24 hours.',
    }, { status: 201 })
  } catch (error) {
    console.error('Report user error:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}
