import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/support/report-problem
 * Report technical glitch, bug, UI error, or broken feature
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { issueType, subject, description, systemInfo, screenshotUrl, pageContext } = body

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const report = await db.feedbackSubmissions.create({
      data: {
        userId: auth.authenticated && auth.user ? auth.user.id : null,
        type: 'bug_report',
        subject: `[BUG: ${issueType || 'General'}] ${String(subject).trim()}`,
        description: `${String(description).trim()}\n\nDiagnostic: ${typeof systemInfo === 'object' ? JSON.stringify(systemInfo) : systemInfo || 'None'}`,
        pageContext: pageContext || 'app',
        status: 'new',
      },
    })

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Bug report received. Our engineering team has been notified.',
    }, { status: 201 })
  } catch (error) {
    console.error('Report problem error:', error)
    return NextResponse.json({ error: 'Failed to record problem report' }, { status: 500 })
  }
}
