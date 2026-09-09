import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/support/contact
 * Form submission for Contact Us page
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const body = await request.json()
    const { name, email, phone, category, subject, message, attachmentUrl } = body

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Name, email, subject, and message are required' }, { status: 400 })
    }

    const submission = await db.contactSubmissions.create({
      data: {
        userId: auth.authenticated && auth.user ? auth.user.id : null,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        category: category || 'general',
        subject: String(subject).trim(),
        message: String(message).trim(),
        attachmentUrl: attachmentUrl || null,
        status: 'new',
      },
    })

    return NextResponse.json({
      success: true,
      data: submission,
      message: 'Your inquiry has been submitted. Our support team will contact you within 24 hours.',
    }, { status: 201 })
  } catch (error) {
    console.error('Contact submission error:', error)
    return NextResponse.json({ error: 'Failed to submit contact message' }, { status: 500 })
  }
}
