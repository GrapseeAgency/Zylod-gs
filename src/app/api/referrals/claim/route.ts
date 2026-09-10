import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/referrals/claim
 * Apply a friend's referral code to receive welcome points and credit the referrer.
 * Body: { referralCode: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { referralCode } = body

    if (!referralCode) {
      return NextResponse.json({ error: 'referralCode is required' }, { status: 400 })
    }

    const ref = await db.referralCodes.findUnique({
      where: { code: String(referralCode).toUpperCase() },
      include: { buyer: true },
    })

    if (!ref || !ref.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive referral code' }, { status: 404 })
    }

    if (ref.buyerId === auth.user.id) {
      return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }

    // Check if user already used any referral code
    const alreadyUsed = await db.referralUses.findFirst({
      where: { referredUserId: auth.user.id },
    })
    if (alreadyUsed) {
      return NextResponse.json({ error: 'You have already applied a referral code' }, { status: 409 })
    }

    // Record referral use
    const usage = await db.referralUses.create({
      data: {
        referralCodeId: ref.id,
        referredUserId: auth.user.id,
        rewardGiven: true,
      },
    })

    // Increment referrer stats
    await db.referralCodes.update({
      where: { id: ref.id },
      data: { usedCount: { increment: 1 } },
    })

    // Credit referrer with 500 points
    await db.buyerRewards.upsert({
      where: { buyerId: ref.buyerId },
      create: { buyerId: ref.buyerId, pointsBalance: 500, totalEarned: 500 },
      update: { pointsBalance: { increment: 500 }, totalEarned: { increment: 500 } },
    })
    await db.rewardTransactions.create({
      data: {
        buyerId: ref.buyerId,
        type: 'earn',
        points: 500,
        description: `Referral Reward for inviting user ${auth.user.email || auth.user.id}`,
      },
    })

    // Credit referee (current user) with 300 welcome points + ৳200 voucher
    await db.buyerRewards.upsert({
      where: { buyerId: auth.user.id },
      create: { buyerId: auth.user.id, pointsBalance: 300, totalEarned: 300 },
      update: { pointsBalance: { increment: 300 }, totalEarned: { increment: 300 } },
    })
    await db.rewardTransactions.create({
      data: {
        buyerId: auth.user.id,
        type: 'earn',
        points: 300,
        description: `Welcome Bonus from referral code ${ref.code}`,
      },
    })

    // Create welcome coupon for new user
    await db.userCoupons.create({
      data: {
        userId: auth.user.id,
        couponId: 'referral-welcome',
        code: `WELCOME-${ref.code}`,
        title: 'Referral Welcome Voucher',
        discountStyle: 'fixed',
        discountLabel: '৳200 FLAT OFF',
        status: 'active',
        validUntil: new Date(Date.now() + 30 * 86400000),
        savingsBDT: 200,
        minOrderBDT: 1000,
        categoryLabel: 'Referral Welcome',
        categoryColor: '#E53935',
      },
    })

    // Notify both parties
    await sendNotification({
      userId: ref.buyerId,
      type: 'promotion',
      title: 'Referral Reward Unlocked! ৳500 Points 🎉',
      body: `A new wholesale merchant registered using your invite code ${ref.code}. You received +500 points!`,
    })

    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: 'Welcome Bonus Claimed! 🎁',
      body: `You received +300 loyalty points and a ৳200 voucher from referral code ${ref.code}.`,
    })

    return NextResponse.json({
      success: true,
      message: 'Referral code claimed! +300 Points and ৳200 voucher added to your account.',
      data: usage,
    }, { status: 201 })
  } catch (error) {
    console.error('Referral claim error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
