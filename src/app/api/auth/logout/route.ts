import { NextRequest, NextResponse } from 'next/server'
import { extractToken, destroySession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request)
    if (token) {
      await destroySession(token)
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
