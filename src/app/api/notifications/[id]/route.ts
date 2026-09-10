import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/notifications/[id]
 * Fetch a single notification and mark it as read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    const notification = await db.notifications.findFirst({
      where: { id, userId: auth.user.id },
    })

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    // Auto mark as read on open
    if (!notification.isRead) {
      await db.notifications.update({
        where: { id },
        data: { isRead: true },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.body,
        timestamp: notification.createdAt.toISOString(),
        isRead: true,
        relatedId: notification.relatedEntityId,
      },
    })
  } catch (error) {
    console.error('Notification GET [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete a single notification.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.notifications.findFirst({
      where: { id, userId: auth.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    await db.notifications.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notification DELETE [id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
