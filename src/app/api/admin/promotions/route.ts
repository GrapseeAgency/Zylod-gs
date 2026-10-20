import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { promotionAdminSchema, normalizePromotionInput, shapePromotion } from '@/lib/promotions-admin'

/**
 * Task 100 — PLATFORM PROMOTION ADMIN RAIL. "Everything here connects to
 * admin": campaigns are admin-curated, pinned to real products through
 * promotionProducts, and the public/pricing rails only ever serve what this
 * console wrote. House contract: requireUserType 401-first, rate limits,
 * Zod STRICT, at-least-one product pin with phantom rejection, audits +
 * admin-room taps.
 */

/** Validate every pinned id is a REAL product row — a phantom pin is a 400 naming it. */
async function validatePinnedProducts(ids: string[]) {
  const unique = [...new Set(ids)]
  const found = await db.products.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  })
  const foundIds = new Set(found.map((p) => p.id))
  const missing = unique.filter((id) => !foundIds.has(id))
  return { found, missing }
}

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-promotions-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const [promotions, groupBy] = await Promise.all([
      db.promotions.findMany({
        orderBy: { createdAt: 'desc' },
        include: { products: { include: { product: { select: { id: true, name: true } } } } },
      }),
      db.promotions.groupBy({ by: ['isActive'], _count: { isActive: true } }),
    ])
    const stats = { total: 0, live: 0, notActive: 0 }
    for (const g of groupBy) {
      stats.total += g._count.isActive
      if (g.isActive) stats.live += g._count.isActive
      else stats.notActive += g._count.isActive
    }
    return NextResponse.json({
      success: true,
      data: promotions.map((p) =>
        shapePromotion(
          p,
          p.products.map((pp) => ({ id: pp.product.id, name: pp.product.name }))
        )
      ),
      stats,
    })
  } catch (error) {
    console.error('Admin promotions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-promotions-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = promotionAdminSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid promotion payload' },
        { status: 400 }
      )
    }
    const input = normalizePromotionInput(parsed.data)

    const { found, missing } = await validatePinnedProducts(parsed.data.productIds)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Unknown product${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.promotions.create({ data: input })
      await tx.promotionProducts.createMany({
        data: found.map((p) => ({ promotionId: row.id, productId: p.id })),
      })
      return row
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'promotion_created',
        entityType: 'promotions',
        entityId: created.id,
        metadata: JSON.stringify({
          name: created.name,
          type: created.type,
          value: created.value,
          pinnedCount: found.length,
          isActive: created.isActive,
        }),
      },
    })
    void tapAllAdmins('promotion:changed', {
      action: 'created',
      promotionId: created.id,
      name: created.name,
      pinnedCount: found.length,
    })

    return NextResponse.json({ success: true, data: shapePromotion(created, found) }, { status: 201 })
  } catch (error) {
    console.error('Admin promotions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
