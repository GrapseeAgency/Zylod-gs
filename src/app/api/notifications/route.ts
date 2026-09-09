import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications — fetch the authenticated user's notification feed.
 * Query params: page, limit, unreadOnly (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: Record<string, unknown> = { userId: auth.user.id }
    if (unreadOnly) where.isRead = false

    const skip = (page - 1) * limit

    const [notifications, total, unreadCount] = await Promise.all([
      db.notifications.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notifications.count({ where }),
      db.notifications.count({ where: { userId: auth.user.id, isRead: false } }),
    ])

    const data = notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.body,
      timestamp: n.createdAt.toISOString(),
      isRead: n.isRead,
      relatedId: n.relatedEntityId,
      actionUrl: null,
      actionLabel: null,
      priority: 'medium',
    }))

    return NextResponse.json({
      success: true,
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications — mark notification(s) as read.
 * Body: { id: string } | { markAll: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    if (body.markAll) {
      await db.notifications.updateMany({
        where: { userId: auth.user.id, isRead: false },
        data: { isRead: true },
      })
    } else if (body.id) {
      await db.notifications.updateMany({
        where: { id: body.id, userId: auth.user.id },
        data: { isRead: true },
      })
    } else {
      return NextResponse.json({ error: 'id or markAll required' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notifications PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Helper to create a notification. Call from other API routes. */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  relatedEntityId?: string,
) {
  try {
    return await db.notifications.create({
      data: { userId, type, title, body, relatedEntityId: relatedEntityId || null },
    })
  } catch (e) {
    console.error('Failed to create notification:', e)
    return null
  }
}