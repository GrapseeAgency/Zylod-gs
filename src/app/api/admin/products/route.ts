import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/admin/products — list products pending approval (or all if approved=true)
 * Query params: page, limit, approved (true|false), search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
    const approved = searchParams.get('approved') === 'true'
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { isActive: true, isApproved: approved }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { supplier: { companyName: { contains: search, mode: 'insensitive' as const } } },
      ]
    }

    const [products, total] = await Promise.all([
      db.products.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          supplier: { select: { id: true, companyName: true } },
          category: { select: { name: true, slug: true } },
          _count: { select: { reviews: true } },
        },
      }),
      db.products.count({ where }),
    ])

    const data = products.map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      unit: p.unit,
      moq: p.moq,
      stockQuantity: p.stockQuantity,
      supplierName: p.supplier.companyName,
      categoryName: p.category.name,
      reviewCount: p._count.reviews,
      createdAt: p.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/products — approve/reject a product
 * Body: { productId, action: 'approve' | 'reject', reason?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, action, reason } = body

    if (!productId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'productId and valid action are required' }, { status: 400 })
    }

    const update = action === 'approve'
      ? { isApproved: true }
      : { isApproved: false }

    const product = await db.products.update({
      where: { id: productId },
      data: update,
    })

    // Log the action
    await db.auditLogs.create({
      data: {
        actorId: body.actorId || null,
        action: `product_${action}`,
        entityType: 'products',
        entityId: productId,
        metadata: JSON.stringify({ reason }),
      },
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Admin products PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
