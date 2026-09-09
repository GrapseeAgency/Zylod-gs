import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/coupons/claim
 * Claim/collect an active coupon code to the user's personal voucher vault.
 * Body: { couponId?: string, code?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { couponId, code } = body

    if (!couponId && !code) {
      return NextResponse.json({ error: 'couponId or code is required' }, { status: 400 })
    }

    // Lookup original coupon
    const coupon = couponId
      ? await db.coupons.findUnique({ where: { id: couponId } })
      : await db.coupons.findUnique({ where: { code: String(code).toUpperCase() } })

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Coupon not found or inactive' }, { status: 404 })
    }

    if (new Date(coupon.validUntil) < new Date()) {
      return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })
    }

    // Check if user already claimed this coupon
    const alreadyClaimed = await db.userCoupons.findFirst({
      where: {
        userId: auth.user.id,
        code: coupon.code,
        status: 'active',
      },
    })
    if (alreadyClaimed) {
      return NextResponse.json({ error: 'You have already collected this coupon' }, { status: 409 })
    }

    const discountLabel = coupon.discountType === 'percentage'
      ? `${coupon.discountPercent}% OFF`
      : `৳${coupon.discountPercent} FLAT`

    const userCoupon = await db.userCoupons.create({
      data: {
        userId: auth.user.id,
        couponId: coupon.id,
        code: coupon.code,
        title: `Coupon: ${coupon.code}`,
        discountStyle: coupon.discountType === 'percentage' ? 'percentage' : 'fixed',
        discountLabel,
        status: 'active',
        validUntil: coupon.validUntil,
        savingsBDT: coupon.discountPercent,
        minOrderBDT: coupon.minOrderAmount || 0,
        categoryLabel: 'Wholesale',
        categoryColor: '#E53935',
      },
    })

    // Increment coupon use count
    await db.coupons.update({
      where: { id: coupon.id },
      data: { usedCount: { increment: 1 } },
    })

    // Dispatch real in-app confirmation notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Coupon Collected: ${coupon.code}`,
      body: `You claimed ${discountLabel} discount for your next wholesale order. Valid until ${new Date(coupon.validUntil).toLocaleDateString('en-GB')}.`,
      relatedEntityId: userCoupon.id,
    })

    return NextResponse.json({
      success: true,
      message: 'Coupon claimed successfully!',
      data: userCoupon,
    }, { status: 201 })
  } catch (error) {
    console.error('Coupon claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
