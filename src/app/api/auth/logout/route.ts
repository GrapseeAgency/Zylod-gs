import { NextRequest, NextResponse } from 'next/server'
import { extractToken, destroySession, clearAuthCookie } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (token) {
      await destroySession(token)
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
    // Clear the session cookie server-side (destroySession above only removes
    // the DB row; the browser keeps the cookie until told to drop it).
    clearAuthCookie(response)
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
