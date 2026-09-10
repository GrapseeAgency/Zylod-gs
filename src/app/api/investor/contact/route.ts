import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/investor/contact
 * Submit an investor relations inquiry.
 * Body: { name, email, phone?, company?, inquiryType, message }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, company, inquiryType, message } = body

    if (!name || !email || !inquiryType || !message) {
      return NextResponse.json({ error: 'name, email, inquiryType, and message are required' }, { status: 400 })
    }

    const validInquiryTypes = [
      'general', 'annual_report', 'financial_data',
      'media_request', 'analyst_coverage', 'shareholder_services', 'esg'
    ]
    if (!validInquiryTypes.includes(inquiryType)) {
      return NextResponse.json({ error: 'Invalid inquiry type' }, { status: 400 })
    }

    const submission = await db.contactSubmissions.create({
      data: {
        name,
        email,
        phone: phone || null,
        category: 'investor_relations',
        subject: `IR Inquiry [${inquiryType}]: ${company ? `${company} — ` : ''}${name}`,
        message,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Your investor inquiry has been received. Our IR team will respond within 2 business days.',
      data: {
        inquiryId: submission.id,
        ref: `IR-${submission.id.slice(-8).toUpperCase()}`,
        submittedAt: submission.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Investor contact POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
