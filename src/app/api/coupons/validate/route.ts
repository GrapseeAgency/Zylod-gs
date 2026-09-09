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

    // Calculate discount
    let discountAmount = 0
    if (orderAmount) {
      discountAmount = orderAmount * (coupon.discountPercent / 100)
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount)
      }
    }

    return NextResponse.json({
      success: true,
      valid: true,
      data: {
        code: coupon.code,
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
