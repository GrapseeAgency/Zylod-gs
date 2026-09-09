import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateSession, createSession, destroySession, getClientIP } from '@/lib/auth'
import crypto from 'crypto'

/**
 * POST /api/auth/refresh
 * Validates the caller's existing session token and, if valid, rotates it:
 *   - old session is destroyed
 *   - a fresh session token is issued (new 7-day expiry)
 * Returns the new token. The client must replace its stored token with the new one.
 *
 * This is a real session-rotation flow — not a mock. The token is verified against
 * the `sessions` table (SHA-256 hashed) and the user must be active.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const refreshToken =
      body.refreshToken ||
      request.headers.get('Authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth-token')?.value

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token is required' }, { status: 400 })
    }

    // 1. Validate the presented token against the sessions table
    const result = await validateSession(refreshToken)
    if (!result.authenticated || !result.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session', detail: result.error },
        { status: 401 }
      )
    }

    const userId = result.user.id

    // 2. Destroy the old session (single-use rotation)
    await destroySession(refreshToken)

    // 3. Issue a fresh session token bound to the same user
    const ip = getClientIP(request)
    const deviceInfo = request.headers.get('user-agent') || undefined
    const newToken = await createSession(userId, ip, deviceInfo)

    // 4. Optionally clean up other expired sessions for this user (best-effort)
    await db.sessions
      .deleteMany({
        where: { userId, expiresAt: { lt: new Date() } },
      })
      .catch(() => {})

    return NextResponse.json({
      success: true,
      token: newToken,
      expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
      user: {
        id: result.user.id,
        userType: result.user.userType,
        email: result.user.email,
        phone: result.user.phone,
      },
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}