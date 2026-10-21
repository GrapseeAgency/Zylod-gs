import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { attemptsToday, recordGameResult } from '@/lib/game-points'
import { BOX_OPENS_PER_DAY, BOX_VOUCHER_VALUES, BOX_WIN_WEIGHT_PERCENT } from '@/lib/mini-games-catalog'

/**
 * Task 112: open a mystery crate. Pure luck, so the SERVER rolls — the
 * same doctrine as the spin wheel. 2 opens/day; roughly one crate in three
 * holds a small voucher (real userCoupons row, 7-day validity), the rest
 * hold packing straw and the empty result is a real recorded attempt.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'mini-games-box', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body === 'object' && Object.keys(body).length > 0) {
      return NextResponse.json({ error: 'This endpoint takes no fields — the server sealed the crates' }, { status: 400 })
    }

    const used = await attemptsToday(auth.user.id, 'box_picker')
    if (used >= BOX_OPENS_PER_DAY) {
      return NextResponse.json(
        { error: `All ${BOX_OPENS_PER_DAY} crates for today are opened — come back tomorrow` },
        { status: 429 }
      )
    }

    const roll = Math.random() * 100
    const won = roll < BOX_WIN_WEIGHT_PERCENT

    if (!won) {
      await recordGameResult({
        userId: auth.user.id,
        gameType: 'box_picker',
        score: 0,
        pointsWon: 0,
        description: 'Mystery crate: packing straw',
      })
      return NextResponse.json({
        success: true,
        data: {
          won: false,
          prize: null,
          message: 'Packing straw — this crate was empty. Try the next one tomorrow.',
        },
      })
    }

    const value = BOX_VOUCHER_VALUES[Math.floor(Math.random() * BOX_VOUCHER_VALUES.length)]
    const code = `CRATE-${randomBytes(4).toString('hex').toUpperCase()}`
    const coupon = await db.userCoupons.create({
      data: {
        userId: auth.user.id,
        couponId: 'mystery-crate',
        code,
        title: 'Mystery Crate Reward',
        discountStyle: 'fixed',
        discountLabel: `৳${value} OFF`,
        status: 'active',
        validUntil: new Date(Date.now() + 7 * 86400000),
        savingsBDT: value,
        minOrderBDT: value * 5,
        categoryLabel: 'Mystery Crate',
        categoryColor: '#B45309',
      },
    })

    await recordGameResult({
      userId: auth.user.id,
      gameType: 'box_picker',
      score: 1,
      pointsWon: 0,
      description: `Mystery crate: ৳${value} voucher`,
    })

    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `The crate held a voucher: ৳${value} OFF`,
      body: `Code ${code} is in your voucher vault — 7 days to use it.`,
      relatedEntityId: coupon.id,
    })

    return NextResponse.json({
      success: true,
      data: {
        won: true,
        prize: { code, value, discountLabel: `৳${value} OFF`, validUntil: coupon.validUntil },
        message: `The crate held a ৳${value} voucher — it is in your vault`,
      },
    })
  } catch (error) {
    console.error('Box open error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
