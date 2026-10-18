import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET  /api/supplier/promotions — REAL sellerPromotions rows for the signed-in
 *                              supplier (honest empty when none).
 * POST /api/supplier/promotions — create a promotion row (defaults to
 *                              status 'draft'; real date validation).
 */

const PROMO_TYPES = ['percentage_discount', 'fixed_discount', 'buy_one_get_one', 'free_shipping'] as const
const APPLICABLE_TO = ['all', 'category', 'selected'] as const

const createPromotionSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    type: z.enum(PROMO_TYPES),
    discountValue: z.coerce.number().min(0, 'Discount value cannot be negative').default(0),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    applicableTo: z.enum(APPLICABLE_TO).default('all'),
    categoryIds: z.array(z.string()).optional(),
    productIds: z.array(z.string()).optional(),
    minOrderAmount: z.coerce.number().min(0).default(0),
    maxDiscount: z.coerce.number().min(0).default(0),
    usageLimit: z.coerce.number().int().min(0).default(0),
    budget: z.coerce.number().min(0).optional(),
    description: z.string().max(1000).optional(),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  })

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-promotions-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const promotions = await db.sellerPromotions.findMany({
      where: { supplierId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ success: true, data: promotions })
  } catch (error) {
    console.error('Supplier promotions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-promotions-post', 20, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const parsed = createPromotionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid promotion payload' },
        { status: 400 }
      )
    }
    const body = parsed.data

    const created = await db.sellerPromotions.create({
      data: {
        supplierId: profile.id,
        name: body.name,
        type: body.type,
        discountValue: body.discountValue,
        startDate: body.startDate,
        endDate: body.endDate,
        // New promotions always start as drafts — 'active' is a state the
        // owner (or admin tooling) moves a row to, never a creation default.
        status: 'draft',
        applicableTo: body.applicableTo,
        categoryIds: body.categoryIds ? JSON.stringify(body.categoryIds) : null,
        productIds: body.productIds ? JSON.stringify(body.productIds) : null,
        minOrderAmount: body.minOrderAmount,
        maxDiscount: body.maxDiscount,
        usageLimit: body.usageLimit,
        budget: body.budget ?? null,
        description: body.description ?? null,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_promotion_created',
        entityType: 'sellerPromotions',
        entityId: created.id,
        metadata: JSON.stringify({ supplierId: profile.id, name: created.name, type: created.type }),
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Supplier promotions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
