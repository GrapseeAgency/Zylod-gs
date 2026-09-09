import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/chat/sessions/[id] — Fetch single session and full messages
 * PATCH /api/support/chat/sessions/[id] — End or update session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const session = await db.chatSessions.findFirst({
      where: { id, userId: auth.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: session })
  } catch (error) {
    console.error('Chat session GET error:', error)
    return NextResponse.json({ error: 'Failed to load chat session' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body

    const session = await db.chatSessions.findFirst({
      where: { id, userId: auth.user.id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    const updated = await db.chatSessions.update({
      where: { id },
      data: {
        status: status || 'ended',
        endedAt: status === 'ended' ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Chat session PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update chat session' }, { status: 500 })
  }
}
