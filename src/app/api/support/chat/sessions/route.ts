import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/chat/sessions — list user's chat sessions
 * POST /api/support/chat/sessions — start a new live chat or chatbot session
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const sessions = await db.chatSessions.findMany({
      where: { userId: auth.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json({ success: true, data: sessions })
  } catch (error) {
    console.error('Chat sessions GET error:', error)
    return NextResponse.json({ error: 'Failed to load chat sessions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { type, subject, initialMessage } = body

    const session = await db.chatSessions.create({
      data: {
        userId: auth.user.id,
        type: type || 'live_chat',
        subject: subject || 'Wholesale Inquiries & Support',
        status: 'active',
      },
    })

    // Add initial system / welcome message
    await db.chatMessages.create({
      data: {
        sessionId: session.id,
        senderId: 'system',
        senderType: 'system',
        message: type === 'chatbot'
          ? 'Hello! I am the Zylod Help Assistant. I can point you to help articles about wholesale orders, supplier verification, and payment verification.'
          : 'Welcome to Zylod Support Chat. Messages are saved here for the Zylod team to review — for urgent issues, email support@zylod.com.',
      },
    })

    if (initialMessage) {
      await db.chatMessages.create({
        data: {
          sessionId: session.id,
          senderId: auth.user.id,
          senderType: 'user',
          message: String(initialMessage).trim(),
        },
      })
    }

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    console.error('Chat session POST error:', error)
    return NextResponse.json({ error: 'Failed to initiate chat session' }, { status: 500 })
  }
}
