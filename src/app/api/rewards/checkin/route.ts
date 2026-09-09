import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/rewards/checkin
 * Retrieve today's checkin status, current streak, and weekly reward schedule.
 *
 * POST /api/rewards/checkin
 * Claim today's checkin reward.
 */

const STREAK_REWARDS = [50, 75, 100, 150, 200, 300, 500] // Day 1 to Day 7

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const [todayCheckin, yesterdayCheckin, allCheckins] = await Promise.all([
      db.dailyCheckins.findUnique({
        where: { userId_checkinDate: { userId: auth.user.id, checkinDate: todayStr } },
      }),
      db.dailyCheckins.findUnique({
        where: { userId_checkinDate: { userId: auth.user.id, checkinDate: yesterday } },
      }),
      db.dailyCheckins.findMany({
        where: { userId: auth.user.id },
        orderBy: { checkinDate: 'desc' },
        take: 30,
      }),
    ])

    const currentStreak = todayCheckin
      ? todayCheckin.streakCount
      : yesterdayCheckin
        ? yesterdayCheckin.streakCount
        : 0

    return NextResponse.json({
      success: true,
      data: {
        checkedInToday: !!todayCheckin,
        currentStreak,
        todayReward: STREAK_REWARDS[Math.min(currentStreak, 6)],
        schedule: STREAK_REWARDS,
        history: allCheckins,
      },
    })
  } catch (error) {
    console.error('Daily checkin GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Check if already checked in today
    const existing = await db.dailyCheckins.findUnique({
      where: { userId_checkinDate: { userId: auth.user.id, checkinDate: todayStr } },
    })

    if (existing) {
      return NextResponse.json({
        error: 'You have already checked in today! Come back tomorrow.',
        alreadyCheckedIn: true,
      }, { status: 409 })
    }

    // Check yesterday's streak
    const yesterdayCheckin = await db.dailyCheckins.findUnique({
      where: { userId_checkinDate: { userId: auth.user.id, checkinDate: yesterday } },
    })

    const streakCount = yesterdayCheckin ? (yesterdayCheckin.streakCount % 7) + 1 : 1
    const pointsAwarded = STREAK_REWARDS[streakCount - 1] || 50

    // Record checkin
    const checkin = await db.dailyCheckins.create({
      data: {
        userId: auth.user.id,
        checkinDate: todayStr,
        streakCount,
        pointsAwarded,
      },
    })

    // Credit loyalty points
    await db.buyerRewards.upsert({
      where: { buyerId: auth.user.id },
      create: {
        buyerId: auth.user.id,
        pointsBalance: pointsAwarded,
        totalEarned: pointsAwarded,
      },
      update: {
        pointsBalance: { increment: pointsAwarded },
        totalEarned: { increment: pointsAwarded },
      },
    })

    await db.rewardTransactions.create({
      data: {
        buyerId: auth.user.id,
        type: 'earn',
        points: pointsAwarded,
        description: `Daily Check-in Day ${streakCount} Streak Reward`,
      },
    })

    // Real in-app notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Daily Check-in Day ${streakCount}! 🔥`,
      body: `You received +${pointsAwarded} loyalty points for your ${streakCount}-day check-in streak.`,
      relatedEntityId: checkin.id,
    })

    return NextResponse.json({
      success: true,
      message: `Checked in! +${pointsAwarded} points awarded.`,
      data: checkin,
    }, { status: 201 })
  } catch (error) {
    console.error('Daily checkin POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
