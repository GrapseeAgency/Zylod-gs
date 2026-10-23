import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType, authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/coupons
 * List active platform & supplier coupons. Task 143 scoping (audit unit 19):
 * personal vouchers are PRIVATE money promises — a row with a userId set is
 * served ONLY to that buyer (anonymous callers see public rows only). The
 * apply rail enforces the same binding at spend time.
 */
export async function GET(request: NextRequest) {
  try {
    // Session-aware scoping WITHOUT a login wall: anonymous callers get the
    // public list; a signed-in session additionally sees their own rows.
    const session = await authenticateRequest(request)
    const meId = session.authenticated && session.user ? session.user.id : null

    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 30)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      isActive: true,
      validUntil: { gte: new Date() },
      OR: meId ? [{ userId: null }, { userId: meId }] : [{ userId: null }],
    }

    const [coupons, total] = await Promise.all([
      db.coupons.findMany({
        where,
        orderBy: { validUntil: 'asc' },
        skip,
        take: limit,
      }),
      db.coupons.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: coupons,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Coupons GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/coupons — ADMIN coupon creation ONLY.
 *
 * 🐞 Task 74: this used to authenticate ANY user — a BUYER could mint a 99%
 * discount coupon and then apply it at checkout. House contract now: admin
 * only (401-first), rate limited, Zod-validated, audit-logged.
 */
const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Coupon code must be at least 3 characters')
      .max(24, 'Coupon code must be at most 24 characters')
      .regex(/^[A-Za-z0-9_-]+$/, 'Coupon code may contain only letters, numbers, dash and underscore'),
    discountType: z.enum(['percentage', 'fixed']).optional(),
    // percentage → 1..100 (% off); fixed → the flat ৳ amount (> 0)
    discountPercent: z.number().positive('Discount must be positive'),
    minOrderAmount: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).nullable().optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime(),
    usageLimit: z.number().int().min(1).max(1_000_000).optional(),
  })
  .strict()
  .refine((d) => d.discountType !== 'percentage' || d.discountPercent <= 100, {
    message: 'Percentage discounts cannot exceed 100',
    path: ['discountPercent'],
  })

export async function POST(request: NextRequest) {
  try {
    // 401-first, then admin-only: wrong type maps to the 401 convention.
    const auth = await requireUserType(request, ['admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'admin-coupons-create', 20, 5 * 60 * 1000)
    if (!rl.ok) return rateLimitResponse(rl)

    const parsed = couponCreateSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid coupon payload' },
        { status: 400 }
      )
    }
    const { code, discountType = 'percentage', discountPercent, minOrderAmount = 0, maxDiscount, validFrom, validUntil, usageLimit = 1000 } = parsed.data

    const validFromAt = validFrom ? new Date(validFrom) : new Date()
    const validUntilAt = new Date(validUntil)
    if (validUntilAt <= validFromAt) {
      return NextResponse.json({ error: 'validUntil must be after validFrom' }, { status: 400 })
    }

    const existing = await db.coupons.findUnique({
      where: { code: code.toUpperCase() },
    })
    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    }

    const coupon = await db.coupons.create({
      data: {
        code: code.toUpperCase(),
        discountType,
        discountPercent: Number(discountPercent),
        minOrderAmount: Number(minOrderAmount),
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        validFrom: validFromAt,
        validUntil: validUntilAt,
        usageLimit: Number(usageLimit),
        isActive: true,
      },
    })

    // Task 74: admin money-adjacent actions are audit-logged (house doctrine).
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'coupon_created',
        entityType: 'coupons',
        entityId: coupon.id,
        metadata: JSON.stringify({
          code: coupon.code,
          discountType: coupon.discountType,
          discountPercent: coupon.discountPercent,
          minOrderAmount: coupon.minOrderAmount,
          maxDiscount: coupon.maxDiscount,
          validUntil: coupon.validUntil,
          usageLimit: coupon.usageLimit,
          adminId: auth.user.id,
        }),
      },
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (error) {
    console.error('Coupons POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
