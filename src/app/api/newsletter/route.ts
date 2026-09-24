import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * REAL newsletter subscription — persisted in `newsletterSubscribers`,
 * deduplicated by email. No localStorage, no fake success.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const source = typeof body?.source === 'string' ? body.source.trim().slice(0, 40) : 'footer'

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const existing = await db.newsletterSubscribers.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: true, data: { alreadySubscribed: true } })
    }

    await db.newsletterSubscribers.create({ data: { email, source } })
    return NextResponse.json({ success: true, data: { alreadySubscribed: false } }, { status: 201 })
  } catch (error) {
    console.error('Newsletter POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
