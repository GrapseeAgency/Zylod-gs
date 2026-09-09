import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/legal/cookie-consent
 * Records user's cookie consent preferences.
 * Body: { userId?, sessionId, analyticsAllowed, marketingAllowed }
 *
 * GET /api/legal/cookie-consent?sessionId=xxx
 * Retrieves current consent for a session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, sessionId, analyticsAllowed = false, marketingAllowed = false } = body

    if (!sessionId && !userId) {
      return NextResponse.json({ error: 'sessionId or userId required' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const userAgent = request.headers.get('user-agent') || null

    const consentType = analyticsAllowed && marketingAllowed
      ? 'all'
      : analyticsAllowed
      ? 'analytics'
      : marketingAllowed
      ? 'marketing'
      : 'necessary'

    const consent = await db.cookieConsents.create({
      data: {
        userId: userId || null,
        sessionId: sessionId || null,
        consentType,
        analyticsAllowed,
        marketingAllowed,
        ipAddress,
        userAgent,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cookie preferences saved',
      data: { id: consent.id, consentType, consentedAt: consent.consentedAt },
    }, { status: 201 })
  } catch (error) {
    console.error('Cookie consent POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId')

    if (!sessionId && !userId) {
      return NextResponse.json({ error: 'sessionId or userId required' }, { status: 400 })
    }

    const consent = await db.cookieConsents.findFirst({
      where: userId ? { userId } : { sessionId: sessionId! },
      orderBy: { consentedAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: consent })
  } catch (error) {
    console.error('Cookie consent GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
