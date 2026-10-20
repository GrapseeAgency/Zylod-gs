import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

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

    const rl = checkRateLimit(request, 'chat-conversations-list', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

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

    const rl = checkRateLimit(request, 'chat-conversation-create', 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const buyerId = auth.user.id
    const { supplierId, productId } = body as { supplierId?: unknown; productId?: unknown }

    if (!supplierId || typeof supplierId !== 'string') {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 })
    }

    // Task 88 — a conversation is only real when the supplier is real: the id
    // must resolve to an actual SUPPLIER user account (users.id, the same
    // space the PDP sends via product.supplier.userId). No more conversations
    // with phantom accounts.
    const supplierUser = await db.users.findUnique({
      where: { id: supplierId },
      select: { id: true, userType: true },
    })
    if (!supplierUser || supplierUser.userType !== 'supplier') {
      return NextResponse.json({ error: 'supplierId must reference a real supplier account' }, { status: 400 })
    }

    // The linked product must be real AND belong to THAT supplier — a buyer
    // cannot open a chat claiming another seller's product.
    if (productId != null) {
      if (typeof productId !== 'string') {
        return NextResponse.json({ error: 'productId must be a string when provided' }, { status: 400 })
      }
      const product = await db.products.findUnique({
        where: { id: productId },
        select: { id: true, supplier: { select: { userId: true } } },
      })
      if (!product || product.supplier.userId !== supplierId) {
        return NextResponse.json(
          { error: 'productId must reference a product that belongs to this supplier' },
          { status: 400 }
        )
      }
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
