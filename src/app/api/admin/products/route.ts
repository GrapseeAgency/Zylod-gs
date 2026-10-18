import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

/**
 * GET /api/admin/products — list products pending approval (or all if approved=true). ADMIN ONLY.
 * Query params: page, limit, approved (true|false), search
 *
 * Task 51-b: each product now carries its REAL uploaded media (ordered by
 * sortOrder) so moderation is an informed decision — an admin can see the
 * images and preview the videos before approving:
 *   images: [{ id, imageUrl, sortOrder }]
 *   videos: [{ id, videoUrl, thumbnailUrl, title, sortOrder }]
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-products-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

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
        { name: { contains: search } },
        { supplier: { companyName: { contains: search } } },
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
          images: { orderBy: { sortOrder: 'asc' } },
          videos: { orderBy: { sortOrder: 'asc' } },
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
      images: p.images.map(img => ({ id: img.id, imageUrl: img.imageUrl, sortOrder: img.sortOrder })),
      videos: p.videos.map(v => ({
        id: v.id,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        title: v.title,
        sortOrder: v.sortOrder,
      })),
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

const moderationActionSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
})

/**
 * PATCH /api/admin/products — approve/reject a product
 * Body: { productId, action: 'approve' | 'reject', reason?: string }
 * Zod-validated; audit-logged with the real before/after isApproved; on
 * success the decision is broadcast to the owning seller's realtime room
 * (`seller:<supplierId>`) so their feed updates without polling.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-products-write', 30, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsed = moderationActionSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid request body', issues: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const { productId, action, reason } = parsed.data

    // Real before-state — required for honest audit logging and for the
    // seller broadcast (supplierId comes from the DB row, never the client).
    const existing = await db.products.findUnique({
      where: { id: productId },
      select: { id: true, name: true, supplierId: true, isApproved: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const newIsApproved = action === 'approve'
    if (existing.isApproved === newIsApproved) {
      return NextResponse.json(
        { error: `Product is already ${newIsApproved ? 'approved' : 'not approved'}` },
        { status: 409 }
      )
    }

    const product = await db.products.update({
      where: { id: productId },
      data: { isApproved: newIsApproved },
    })

    // Audit log with the REAL before/after values.
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: `product_${action}`,
        entityType: 'products',
        entityId: productId,
        metadata: JSON.stringify({
          reason: reason ?? null,
          productName: existing.name,
          supplierId: existing.supplierId,
          before: { isApproved: existing.isApproved },
          after: { isApproved: product.isApproved },
        }),
      },
    })

    // Real-time seller feed update — fire-and-forget; the DB write above is
    // the source of truth and the socket service being down never fails this.
    await broadcastToRoom(`seller:${existing.supplierId}`, 'moderation:decision', {
      entityType: 'product',
      entityId: productId,
      decision: newIsApproved ? 'approved' : 'rejected',
      reason: reason ?? null,
    })

    return NextResponse.json({ success: true, data: product })
  } catch (error) {
    console.error('Admin products PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
