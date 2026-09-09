import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/coupons
 * List all active platform & supplier coupons.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 30)))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      isActive: true,
      validUntil: { gte: new Date() },
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
 * POST /api/coupons (Admin coupon creation)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      code,
      discountType = 'percentage',
      discountPercent,
      minOrderAmount = 0,
      maxDiscount,
      validFrom,
      validUntil,
      usageLimit = 1000,
    } = body

    if (!code || discountPercent === undefined || !validUntil) {
      return NextResponse.json({ error: 'code, discountPercent, and validUntil are required' }, { status: 400 })
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
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: new Date(validUntil),
        usageLimit: Number(usageLimit),
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, data: coupon }, { status: 201 })
  } catch (error) {
    console.error('Coupons POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
