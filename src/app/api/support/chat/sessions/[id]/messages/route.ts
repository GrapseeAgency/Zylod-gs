import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/support/chat/sessions/[id]/messages
 * POST /api/support/chat/sessions/[id]/messages
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

    const messages = await db.chatMessages.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: messages })
  } catch (error) {
    console.error('Chat messages GET error:', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}

export async function POST(
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
    })

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    const body = await request.json()
    const { message, attachments } = body

    if (!message || String(message).trim().length < 1) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    const userMessage = await db.chatMessages.create({
      data: {
        sessionId: id,
        senderId: auth.user.id,
        senderType: 'user',
        message: String(message).trim(),
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
    })

    await db.chatSessions.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    // If it is a chatbot session, automatically generate response from knowledge base
    let botReply: any = null
    if (session.type === 'chatbot') {
      const q = String(message).toLowerCase()
      let replyText = "I'm checking our wholesale policies. For complex order disputes or custom RFQ terms, you can also submit a support ticket or request human live chat."

      // Match against DB FAQs or Articles
      const matchingFaq = await db.faqItems.findFirst({
        where: {
          isActive: true,
          OR: [
            { questionEn: { contains: q } },
            { answerEn: { contains: q } },
          ],
        },
      })

      if (matchingFaq) {
        replyText = `${matchingFaq.answerEn}\n\n*Source: Official FAQ — ${matchingFaq.category.toUpperCase()}*`
      } else if (q.includes('escrow') || q.includes('safepay') || q.includes('payment')) {
        replyText = "With Zylod SafePay, your funds remain securely in escrow when you checkout. The seller only receives the payout once you inspect your delivered stock within 48 hours."
      } else if (q.includes('moq') || q.includes('minimum order')) {
        replyText = "Every wholesale product defines a Minimum Order Quantity (MOQ). Ordering higher quantities unlocks superior volume tier discounts."
      } else if (q.includes('return') || q.includes('damaged') || q.includes('broken')) {
        replyText = "If products arrive damaged or do not meet stated specifications, raise a dispute within 48 hours of delivery with photo/video unboxing evidence for an escrow refund or replacement."
      } else if (q.includes('verify') || q.includes('seller') || q.includes('trade license')) {
        replyText = "Verified suppliers must submit their Trade License, National ID (NID), TIN Certificate, and commercial bank details. Look for the 'Verified Supplier' badge on storefronts."
      }

      botReply = await db.chatMessages.create({
        data: {
          sessionId: id,
          senderId: 'chatbot',
          senderType: 'chatbot',
          message: replyText,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: userMessage,
      botReply,
    }, { status: 201 })
  } catch (error) {
    console.error('Chat message POST error:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
