import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, orderAmount } = body

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    const coupon = await db.coupons.findUnique({ where: { code } })

    if (!coupon) {
      return NextResponse.json({ error: 'Invalid coupon code', valid: false }, { status: 404 })
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return NextResponse.json({ error: 'Coupon is not active', valid: false }, { status: 400 })
    }

    // Check validity dates
    const now = new Date()
    if (now < coupon.validFrom) {
      return NextResponse.json({ error: 'Coupon is not yet valid', valid: false }, { status: 400 })
    }
    if (now > coupon.validUntil) {
      return NextResponse.json({ error: 'Coupon has expired', valid: false }, { status: 400 })
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ error: 'Coupon usage limit reached', valid: false }, { status: 400 })
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && orderAmount && orderAmount < coupon.minOrderAmount) {
      return NextResponse.json({ error: `Minimum order amount is ${coupon.minOrderAmount} BDT`, valid: false }, { status: 400 })
    }

    // Calculate discount — Task 131: the formula now mirrors POST /api/orders
    // (the authoritative money path) EXACTLY, including discountType 'fixed'
    // (where discountPercent holds the flat ৳ amount). The old block always
    // computed percentage math, so a fixed coupon previewed the wrong ৳.
    let discountAmount = 0
    if (coupon.discountType === 'fixed') {
      discountAmount = orderAmount
        ? Math.min(coupon.discountPercent, orderAmount)
        : coupon.discountPercent
    } else if (orderAmount) {
      discountAmount = Math.min(
        orderAmount * (coupon.discountPercent / 100),
        coupon.maxDiscount ?? Number.POSITIVE_INFINITY
      )
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountPercent: coupon.discountPercent,
        maxDiscount: coupon.maxDiscount,
        minOrderAmount: coupon.minOrderAmount,
        discountAmount,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        remainingUses: coupon.usageLimit ? coupon.usageLimit - coupon.usedCount : null,
      },
    })
  } catch (error) {
    console.error('Coupon validate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
