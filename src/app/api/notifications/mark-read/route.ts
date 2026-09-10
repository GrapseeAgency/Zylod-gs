import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/notifications/mark-read
 * Mark specific notifications as read.
 * Body variants:
 *   { ids: string[] }           — mark specific IDs as read
 *   { type: string }            — mark all of a type as read
 *   { markAll: true }           — mark all as read
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    if (body.markAll) {
      const result = await db.notifications.updateMany({
        where: { userId: auth.user.id, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    if (body.type) {
      const result = await db.notifications.updateMany({
        where: { userId: auth.user.id, type: body.type, isRead: false },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      const result = await db.notifications.updateMany({
        where: {
          id: { in: body.ids },
          userId: auth.user.id,
        },
        data: { isRead: true },
      })
      return NextResponse.json({ success: true, updated: result.count })
    }

    return NextResponse.json({ error: 'Provide ids[], type, or markAll: true' }, { status: 400 })
  } catch (error) {
    console.error('Notifications mark-read POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
