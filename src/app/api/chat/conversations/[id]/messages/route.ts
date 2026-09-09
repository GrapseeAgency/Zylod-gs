import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/chat/conversations/[id]/messages — get messages in a conversation
 * Query params: page, limit
 * Auth required — userId comes from token, used for marking messages as read.
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
    const userId = auth.user.id

    const { id } = await params
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

    // Verify the user is a participant in this conversation
    const conversation = await db.conversations.findUnique({ where: { id } })
    if (!conversation || (conversation.buyerId !== userId && conversation.supplierId !== userId)) {
      return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 403 })
    }

    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      db.messages.findMany({
        where: { conversationId: id },
        orderBy: { sentAt: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          senderId: true,
          messageText: true,
          attachmentUrl: true,
          attachmentType: true,
          attachmentName: true,
          replyToId: true,
          isRead: true,
          sentAt: true,
        },
      }),
      db.messages.count({ where: { conversationId: id } }),
    ])

    // Mark unread messages as read for this user
    await db.messages.updateMany({
      where: { conversationId: id, isRead: false, senderId: { not: userId } },
      data: { isRead: true },
    })

    // Resolve sender names in bulk
    const senderIds = [...new Set(messages.map(m => m.senderId))]
    const senders = await db.users.findMany({
      where: { id: { in: senderIds } },
      select: {
        id: true,
        buyerProfile: { select: { fullName: true } },
        supplierProfile: { select: { companyName: true } },
      },
    })
    const senderMap = new Map(senders.map(s => [
      s.id,
      s.buyerProfile?.fullName || s.supplierProfile?.companyName || 'Unknown',
    ]))

    // Resolve reply targets in bulk
    const replyIds = [...new Set(messages.map(m => m.replyToId).filter(Boolean))] as string[]
    let replyMap = new Map<string, { id: string; senderId: string; messageText: string; attachmentUrl: string | null; attachmentType: string | null }>()
    if (replyIds.length > 0) {
      const replies = await db.messages.findMany({
        where: { id: { in: replyIds } },
        select: { id: true, senderId: true, messageText: true, attachmentUrl: true, attachmentType: true },
      })
      replyMap = new Map(replies.map(r => [r.id, r]))
    }

    const data = messages.map(m => {
      const reply = m.replyToId ? replyMap.get(m.replyToId) : undefined
      return {
        id: m.id,
        senderId: m.senderId,
        senderName: senderMap.get(m.senderId) || 'Unknown',
        messageText: m.messageText,
        attachmentUrl: m.attachmentUrl,
        attachmentType: m.attachmentType,
        attachmentName: m.attachmentName,
        replyTo: reply ? {
          id: reply.id,
          senderId: reply.senderId,
          senderName: senderMap.get(reply.senderId) || 'Unknown',
          messageText: reply.messageText,
          attachmentUrl: reply.attachmentUrl,
          attachmentType: reply.attachmentType,
        } : null,
        isRead: m.isRead,
        sentAt: m.sentAt,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Messages GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/conversations/[id]/messages — send a message
 * Body: { messageText?, attachmentUrl?, attachmentType?, attachmentName?, replyToId? }
 * senderId comes from auth token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const senderId = auth.user.id

    const { id } = await params
    const body = await request.json()
    const { messageText, attachmentUrl, attachmentType, attachmentName, replyToId } = body

    if (!messageText && !attachmentUrl) {
      return NextResponse.json({ error: 'messageText or attachmentUrl is required' }, { status: 400 })
    }

    // Verify conversation exists and sender is a participant
    const conversation = await db.conversations.findUnique({ where: { id } })
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (conversation.buyerId !== senderId && conversation.supplierId !== senderId) {
      return NextResponse.json({ error: 'Not a participant in this conversation' }, { status: 403 })
    }

    // If replying, verify the target message exists in this conversation
    if (replyToId) {
      const replyTarget = await db.messages.findFirst({
        where: { id: replyToId, conversationId: id },
        select: { id: true },
      })
      if (!replyTarget) {
        return NextResponse.json({ error: 'Reply target not found in this conversation' }, { status: 400 })
      }
    }

    const message = await db.messages.create({
      data: {
        conversationId: id,
        senderId,
        messageText: messageText || '',
        attachmentUrl: attachmentUrl || null,
        attachmentType: attachmentType || null,
        attachmentName: attachmentName || null,
        replyToId: replyToId || null,
      },
    })

    // Update conversation's lastMessageAt
    await db.conversations.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    })

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    console.error('Message POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
