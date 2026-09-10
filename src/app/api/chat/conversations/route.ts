import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/chat/conversations — list conversations for the authenticated user
 * Query params: role (buyer|supplier), page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const { searchParams } = request.nextUrl
    const role = searchParams.get('role') || auth.user.userType || 'buyer'
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))

    const skip = (page - 1) * limit
    const where = role === 'supplier'
      ? { supplierId: userId }
      : { buyerId: userId }

    const [conversations, total] = await Promise.all([
      db.conversations.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, thumbnailUrl: true, basePrice: true, unit: true, moq: true } },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { messageText: true, sentAt: true, senderId: true, attachmentUrl: true, attachmentType: true, attachmentName: true },
          },
        },
      }),
      db.conversations.count({ where }),
    ])

    // Resolve other party info (buyer or supplier)
    const data = await Promise.all(
      conversations.map(async (conv) => {
        const otherPartyId = role === 'supplier' ? conv.buyerId : conv.supplierId
        const otherParty = await db.users.findUnique({
          where: { id: otherPartyId },
          select: {
            id: true,
            buyerProfile: { select: { fullName: true, businessName: true } },
            supplierProfile: { select: { companyName: true } },
          },
        })

        const unreadCount = await db.messages.count({
          where: { conversationId: conv.id, isRead: false, senderId: { not: userId } },
        })

        return {
          id: conv.id,
          otherPartyId,
          otherPartyName:
            role === 'supplier'
              ? otherParty?.buyerProfile?.fullName || 'Unknown Buyer'
              : otherParty?.supplierProfile?.companyName || 'Unknown Supplier',
          otherPartyBusiness:
            role === 'supplier'
              ? otherParty?.buyerProfile?.businessName || ''
              : '',
          product: conv.product ? {
            id: conv.product.id,
            name: conv.product.name,
            thumbnailUrl: conv.product.thumbnailUrl,
            basePrice: conv.product.basePrice,
            unit: conv.product.unit,
            moq: conv.product.moq,
          } : null,
          lastMessage: conv.messages[0] || null,
          messageCount: conv._count.messages,
          unreadCount,
          lastMessageAt: conv.lastMessageAt,
          createdAt: conv.createdAt,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Conversations GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/chat/conversations — create a new conversation or get existing one
 * Body: { supplierId, productId? } — buyerId is taken from auth token
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const buyerId = auth.user.id
    const { supplierId, productId } = body

    if (!supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 })
    }

    // Check if conversation already exists
    const existing = await db.conversations.findFirst({
      where: { buyerId, supplierId, productId: productId || null },
    })

    if (existing) {
      return NextResponse.json({ success: true, data: existing })
    }

    const conversation = await db.conversations.create({
      data: {
        buyerId,
        supplierId,
        productId: productId || null,
      },
    })

    return NextResponse.json({ success: true, data: conversation }, { status: 201 })
  } catch (error) {
    console.error('Conversation POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
