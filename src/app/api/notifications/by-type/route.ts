import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/by-type
 * Filter notifications by type.
 * Query params: type, page, limit, unreadOnly
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const type = searchParams.get('type') || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const where: Record<string, unknown> = { userId: auth.user.id }
    if (type) where.type = type
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
      db.notifications.count({ where: { userId: auth.user.id, isRead: false, ...(type ? { type } : {}) } }),
    ])

    const data = notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.body,
      timestamp: n.createdAt.toISOString(),
      isRead: n.isRead,
      relatedId: n.relatedEntityId,
    }))

    return NextResponse.json({
      success: true,
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Notifications by-type GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
