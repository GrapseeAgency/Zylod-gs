import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/legal/dmca
 * Submit a new DMCA takedown report.
 * Body: { complainantName, complainantEmail, complainantPhone?, infringingUrl, originalWorkUrl?, copyrightOwner, copyrightWorkDesc, declarationSigned }
 *
 * GET /api/legal/dmca (admin only)
 * Lists all DMCA reports with pagination.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      complainantName, complainantEmail, complainantPhone,
      infringingUrl, originalWorkUrl, copyrightOwner,
      copyrightWorkDesc, declarationSigned
    } = body

    if (!complainantName || !complainantEmail || !infringingUrl || !copyrightOwner || !copyrightWorkDesc) {
      return NextResponse.json({ error: 'Missing required DMCA fields' }, { status: 400 })
    }

    if (!declarationSigned) {
      return NextResponse.json({ error: 'Declaration must be signed to submit DMCA report' }, { status: 400 })
    }

    const report = await db.dmcaReports.create({
      data: {
        complainantName,
        complainantEmail,
        complainantPhone: complainantPhone || null,
        infringingUrl,
        originalWorkUrl: originalWorkUrl || null,
        copyrightOwner,
        copyrightWorkDesc,
        declarationSigned: true,
        status: 'pending',
      },
    })

    // Send notification to complainant (as contact submission ack)
    await db.contactSubmissions.create({
      data: {
        name: complainantName,
        email: complainantEmail,
        phone: complainantPhone || null,
        category: 'dmca',
        subject: `DMCA Report #${report.id.slice(-6).toUpperCase()} submitted`,
        message: `Your DMCA report for "${infringingUrl}" has been received. We will review and respond within 72 hours.`,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'DMCA report submitted. We will respond within 72 business hours.',
      data: {
        reportId: report.id,
        ticketRef: `DMCA-${report.id.slice(-8).toUpperCase()}`,
        status: 'pending',
        submittedAt: report.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('DMCA POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user || auth.user.userType !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    const [reports, total] = await Promise.all([
      db.dmcaReports.findMany({
        where: status ? { status } : {},
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.dmcaReports.count({ where: status ? { status } : {} }),
    ])

    return NextResponse.json({
      success: true,
      data: reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('DMCA GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
