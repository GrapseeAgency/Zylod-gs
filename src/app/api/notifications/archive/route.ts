import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/archive
 * Notifications older than 30 days, paginated.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const skip = (page - 1) * limit

    const archiveCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [notifications, total] = await Promise.all([
      db.notifications.findMany({
        where: { userId: auth.user.id, createdAt: { lt: archiveCutoff } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.notifications.count({
        where: { userId: auth.user.id, createdAt: { lt: archiveCutoff } },
      }),
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Notifications archive GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications/archive
 * Delete all archived (>30 days old) notifications for the user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const archiveCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = await db.notifications.deleteMany({
      where: { userId: auth.user.id, createdAt: { lt: archiveCutoff } },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Notifications archive DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
