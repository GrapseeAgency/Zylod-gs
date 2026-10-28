import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/legal/cookie-consent
 * Records user's cookie consent preferences.
 * Body: { sessionId, analyticsAllowed, marketingAllowed }
 *
 * GET /api/legal/cookie-consent
 * Retrieves the signed-in caller's most recent consent record.
 *
 * IDOR contract: the row's userId is stamped from the SESSION, never from
 * the request body (a client-supplied userId would let anyone file consent
 * rows against another user). GET is owner-scoped — it only ever returns
 * the caller's own latest consent, and never the recorded ipAddress /
 * userAgent (those are server-side forensics, not the caller's data to
 * read back — least of all another visitor's).
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'cookie-consent', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json()
    const { sessionId, analyticsAllowed = false, marketingAllowed = false } = body

    // The session decides whose consent this is — the body's userId is ignored.
    const auth = await authenticateRequest(request)
    const sessionUserId = auth.authenticated && auth.user ? auth.user.id : null

    if (!sessionId && !sessionUserId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
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
        userId: sessionUserId,
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
    // Owner-scoped read: the caller's own latest consent only. No
    // session — no consent data (there is no guest lookup to keep: a
    // sessionId param would let anyone read another visitor's record).
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const consent = await db.cookieConsents.findFirst({
      where: { userId: auth.user.id },
      orderBy: { consentedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        consentType: true,
        analyticsAllowed: true,
        marketingAllowed: true,
        consentedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: consent })
  } catch (error) {
    console.error('Cookie consent GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
