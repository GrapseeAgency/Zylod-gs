import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/auth/session-info — Task 124's non-destructive expiry probe.
 *
 * The shell calls this once per page load to decide whether a rotation is
 * warranted: rotating EVERY load would destroy the very token the page's
 * Bearer fetches are about to use (single-use rotation). Instead the shell
 * rotates only when the session is near expiry, so normal page loads never
 * race their own authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const expiresAt = auth.sessionExpiresAt ?? null
    const expiresInMs = expiresAt ? expiresAt.getTime() - Date.now() : null

    return NextResponse.json({
      success: true,
      data: {
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        expiresInMs,
      },
    })
  } catch (error) {
    console.error('Session info error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
