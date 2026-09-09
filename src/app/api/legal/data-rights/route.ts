import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/legal/data-rights
 * Submit a data rights request (GDPR/PDPA): access, deletion, portability, rectification.
 * Body: { requestType, reason? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { requestType, reason } = body

    const validTypes = ['access', 'deletion', 'portability', 'rectification', 'restriction', 'objection']
    if (!requestType || !validTypes.includes(requestType)) {
      return NextResponse.json({
        error: `requestType must be one of: ${validTypes.join(', ')}`,
      }, { status: 400 })
    }

    // Log as a contact submission (reuses existing contactSubmissions table)
    const submission = await db.contactSubmissions.create({
      data: {
        userId: auth.user.id,
        name: auth.user.email || auth.user.phone || 'Authenticated User',
        email: auth.user.email || 'noreply@zylod.com',
        category: 'data_rights',
        subject: `Data Rights Request: ${requestType.toUpperCase()}`,
        message: reason || `User requests ${requestType} of their personal data under applicable data protection laws.`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Your ${requestType} request has been received. We will process it within 30 days as required by law.`,
      data: {
        requestId: submission.id,
        requestType,
        submittedAt: submission.createdAt,
        estimatedCompletionDays: requestType === 'deletion' ? 30 : 14,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Data rights POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
