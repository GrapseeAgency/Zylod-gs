import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/rfq — list RFQ requests for the authenticated user
 * Query params: role (buyer|supplier), status, page, limit
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
    const status = searchParams.get('status') || ''
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))

    const skip = (page - 1) * limit
    const where: Record<string, unknown> =
      role === 'supplier'
        ? { quotes: { some: { supplierId: userId } } }
        : { buyerId: userId }
    if (status) Object.assign(where, { status })

    const [rfqs, total] = await Promise.all([
      db.rfqRequests.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: true,
          quotes: role === 'supplier'
            ? { where: { supplierId: userId } }
            : { take: 5, orderBy: { createdAt: 'desc' } },
          _count: { select: { quotes: true } },
        },
      }),
      db.rfqRequests.count({ where }),
    ])

    const data = rfqs.map(r => ({
      id: r.id,
      buyerId: r.buyerId,
      title: r.title,
      description: r.description,
      categorySlug: r.categorySlug,
      quantity: r.quantity,
      unit: r.unit,
      targetPrice: r.targetPrice,
      deliveryCity: r.deliveryCity,
      deadline: r.deadline,
      status: r.status,
      items: r.items,
      quotes: r.quotes,
      quoteCount: r._count.quotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('RFQ GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/rfq — create a new RFQ request
 * Body: { title, description, categorySlug?, quantity?, unit?, targetPrice?, deliveryCity?, deadline?, items? }
 * buyerId is taken from auth token.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const buyerId = auth.user.id

    const body = await request.json()
    const { title, description, categorySlug, quantity, unit, targetPrice, deliveryCity, deadline, items } = body

    if (!title || !description) {
      return NextResponse.json({ error: 'title and description are required' }, { status: 400 })
    }

    const rfq = await db.rfqRequests.create({
      data: {
        buyerId,
        title,
        description,
        categorySlug: categorySlug || null,
        quantity: quantity || null,
        unit: unit || 'pcs',
        targetPrice: targetPrice || null,
        deliveryCity: deliveryCity || null,
        deadline: deadline ? new Date(deadline) : null,
        items: items
          ? { create: items.map((item: { productName: string; specifications?: string; quantity: number; unit?: string; targetPrice?: number }) => ({
              productName: item.productName,
              specifications: item.specifications || null,
              quantity: item.quantity,
              unit: item.unit || 'pcs',
              targetPrice: item.targetPrice || null,
            })) }
          : undefined,
      },
      include: { items: true },
    })

    return NextResponse.json({ success: true, data: rfq }, { status: 201 })
  } catch (error) {
    console.error('RFQ POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
