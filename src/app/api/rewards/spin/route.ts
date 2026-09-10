import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * POST /api/rewards/spin
 * Spin the lucky prize wheel with genuine weighted odds, daily spin limits, and prize distribution.
 */

const PRIZE_SEGMENTS = [
  { id: 'p1', label: '৳100 Voucher', type: 'fixed', value: 100, weight: 25 },
  { id: 'p2', label: '50 Loyalty Points', type: 'points', value: 50, weight: 30 },
  { id: 'p3', label: '৳250 Off ৳2000', type: 'fixed', value: 250, weight: 15 },
  { id: 'p4', label: 'Free Cargo Delivery', type: 'free-shipping', value: 300, weight: 10 },
  { id: 'p5', label: '200 Loyalty Points', type: 'points', value: 200, weight: 12 },
  { id: 'p6', label: '৳500 VIP Voucher', type: 'fixed', value: 500, weight: 5 },
  { id: 'p7', label: '500 Loyalty Points', type: 'points', value: 500, weight: 3 },
]

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const todayStr = new Date().toISOString().split('T')[0]

    // Check daily spins
    const todaySpins = await db.spinWinResults.count({
      where: { userId: auth.user.id, spinDate: todayStr },
    })

    const MAX_DAILY_SPINS = 3
    if (todaySpins >= MAX_DAILY_SPINS) {
      return NextResponse.json({
        error: `Daily spin limit reached (${MAX_DAILY_SPINS}/${MAX_DAILY_SPINS}). Come back tomorrow at 00:00 AM!`,
        spinsRemaining: 0,
      }, { status: 429 })
    }

    // Weighted random selection
    const totalWeight = PRIZE_SEGMENTS.reduce((sum, p) => sum + p.weight, 0)
    let randomNum = Math.random() * totalWeight
    let selectedPrize = PRIZE_SEGMENTS[0]

    for (const segment of PRIZE_SEGMENTS) {
      if (randomNum < segment.weight) {
        selectedPrize = segment
        break
      }
      randomNum -= segment.weight
    }

    const segmentIndex = PRIZE_SEGMENTS.findIndex(s => s.id === selectedPrize.id)
    let generatedCouponId: string | null = null

    // If prize is a voucher, create user coupon
    if (selectedPrize.type === 'fixed' || selectedPrize.type === 'free-shipping') {
      const code = `SPIN-${selectedPrize.value}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      const coupon = await db.userCoupons.create({
        data: {
          userId: auth.user.id,
          couponId: 'spin-win',
          code,
          title: `Lucky Wheel: ${selectedPrize.label}`,
          discountStyle: selectedPrize.type === 'fixed' ? 'fixed' : 'free-shipping',
          discountLabel: selectedPrize.label,
          status: 'active',
          validUntil: new Date(Date.now() + 7 * 86400000),
          savingsBDT: selectedPrize.value,
          minOrderBDT: selectedPrize.value * 4,
          categoryLabel: 'Lucky Spin',
          categoryColor: '#E53935',
        },
      })
      generatedCouponId = coupon.id
    } else if (selectedPrize.type === 'points') {
      // Award loyalty points
      await db.buyerRewards.upsert({
        where: { buyerId: auth.user.id },
        create: {
          buyerId: auth.user.id,
          pointsBalance: selectedPrize.value,
          totalEarned: selectedPrize.value,
        },
        update: {
          pointsBalance: { increment: selectedPrize.value },
          totalEarned: { increment: selectedPrize.value },
        },
      })

      await db.rewardTransactions.create({
        data: {
          buyerId: auth.user.id,
          type: 'earn',
          points: selectedPrize.value,
          description: `Won from Lucky Spin & Win`,
        },
      })
    }

    // Save spin result
    const result = await db.spinWinResults.create({
      data: {
        userId: auth.user.id,
        prizeType: selectedPrize.type,
        prizeLabel: selectedPrize.label,
        prizeValue: selectedPrize.value,
        couponId: generatedCouponId,
        spinsToday: todaySpins + 1,
        spinDate: todayStr,
      },
    })

    // Real in-app notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Lucky Spin Winner! 🎁`,
      body: `Congratulations! You won ${selectedPrize.label} on the Spin & Win wheel.`,
      relatedEntityId: result.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        prize: selectedPrize,
        segmentIndex,
        spinsRemaining: MAX_DAILY_SPINS - (todaySpins + 1),
        spinsToday: todaySpins + 1,
      },
    })
  } catch (error) {
    console.error('Spin win POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
