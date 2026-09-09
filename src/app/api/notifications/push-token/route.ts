import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/push-token
 * List registered push tokens for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const tokens = await db.pushTokens.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: tokens })
  } catch (error) {
    console.error('Push token GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/notifications/push-token
 * Register or update a browser Web Push / device push token.
 * Body: { token: string, platform?: 'web' | 'android' | 'ios' }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { token, platform = 'web' } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Push token string is required' }, { status: 400 })
    }

    // Check if this token is already registered for this user
    const existing = await db.pushTokens.findFirst({
      where: { userId: auth.user.id, token },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Token already registered',
        data: existing,
      })
    }

    const created = await db.pushTokens.create({
      data: {
        userId: auth.user.id,
        token,
        platform,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
      data: created,
    }, { status: 201 })
  } catch (error) {
    console.error('Push token POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications/push-token
 * Unregister a push token.
 * Body or query param: { token: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let token = request.nextUrl.searchParams.get('token')
    if (!token) {
      const body = await request.json().catch(() => ({}))
      token = body.token
    }

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    await db.pushTokens.deleteMany({
      where: { userId: auth.user.id, token },
    })

    return NextResponse.json({ success: true, message: 'Push token unregistered' })
  } catch (error) {
    console.error('Push token DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
