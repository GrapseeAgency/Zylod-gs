import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * POST /api/coupons/validate — the checkout preview.
 *
 * Lookup precedence mirrors the ORDER WRITE (Task 144): a personal voucher
 * in userCoupons (a claimed platform coupon, a lucky-spin prize, a mystery
 * crate drop, a referral welcome) wins the code; the platform campaigns
 * table is the fallback for unclaimed public codes. The preview never
 * consumes anything.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, orderAmount } = body

    if (!code) {
      return NextResponse.json({ error: 'Coupon code is required' }, { status: 400 })
    }

    const now = new Date()

    // ── (1) the buyer's OWN personal voucher ──
    const auth = await authenticateRequest(request)
    if (auth.authenticated && auth.user) {
      const mine = await db.userCoupons.findFirst({
        where: { code, userId: auth.user.id, status: 'active' },
      })
      if (mine) {
        if (new Date(mine.validUntil) < now) {
          return NextResponse.json({ error: 'Coupon has expired', valid: false }, { status: 400 })
        }
        if (mine.minOrderBDT && orderAmount && orderAmount < mine.minOrderBDT) {
          return NextResponse.json({ error: `Minimum order amount is ${mine.minOrderBDT} BDT`, valid: false }, { status: 400 })
        }

        // The estimate mirrors the order write EXACTLY: percentage styles
        // take a fraction of the order; fixed styles take min(৳savings,
        // order); a free-delivery prize discounts the QUOTED shipping fee
        // (unknown at preview time → 0 here, stated honestly).
        let discountAmount = 0
        if (mine.discountStyle === 'percentage') {
          discountAmount = orderAmount ? orderAmount * (mine.savingsBDT / 100) : 0
        } else if (mine.discountStyle === 'fixed') {
          discountAmount = orderAmount ? Math.min(mine.savingsBDT, orderAmount) : mine.savingsBDT
        }

        return NextResponse.json({
          success: true,
          valid: true,
          data: {
            code: mine.code,
            discountType: mine.discountStyle,
            discountPercent: mine.savingsBDT,
            maxDiscount: null,
            minOrderAmount: mine.minOrderBDT,
            discountAmount,
            validFrom: null,
            validUntil: mine.validUntil,
            remainingUses: 1,
            source: 'personal',
          },
        })
      }
    }

    const rl = checkRateLimit(request, 'coupons-validate', 30, 60000)

    if (!rl.ok) return rateLimitResponse(rl)


    // ── (2) platform campaign codes (unclaimed public codes) ──
    const coupon = await db.coupons.findUnique({ where: { code } })

    if (!coupon) {
      return NextResponse.json({ error: 'Invalid coupon code', valid: false }, { status: 404 })
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      return NextResponse.json({ error: 'Coupon is not active', valid: false }, { status: 400 })
    }

    // Check validity dates
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

    // Task 143: earned vouchers are personal money promises. The preview
    // enforces the same binding the order write does — a code bound to
    // another account never previews as spendable.
    if (coupon.userId) {
      if (!auth.authenticated || !auth.user || auth.user.id !== coupon.userId) {
        return NextResponse.json({ error: 'This voucher belongs to another account', valid: false }, { status: 400 })
      }
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
        source: 'platform',
      },
    })
  } catch (error) {
    console.error('Coupon validate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
