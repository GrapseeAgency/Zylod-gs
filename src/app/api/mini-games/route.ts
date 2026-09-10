import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'

/**
 * GET /api/mini-games
 * List available interactive mini-games and user high scores.
 *
 * POST /api/mini-games
 * Submit game completion score and award points.
 * Body: { gameType: string, score: number }
 */

const GAMES_CATALOG = [
  {
    id: 'wholesale_trivia',
    title: 'B2B Wholesale Master Quiz',
    desc: 'Test your knowledge on Bangladesh textile, NBR tax & export logistics',
    reward: 'Up to 200 Points',
    icon: 'Brain',
    color: '#3B82F6',
  },
  {
    id: 'memory_match',
    title: 'Factory Cargo Matcher',
    desc: 'Pair container logistics and manufacturing tools against the clock',
    reward: 'Up to 150 Points',
    icon: 'Layers',
    color: '#10B981',
  },
  {
    id: 'box_picker',
    title: 'Mystery Warehouse Box',
    desc: 'Open lucky wholesale shipping crates for surprise voucher codes',
    reward: 'Up to ৳500 Voucher',
    icon: 'Package',
    color: '#F59E0B',
  },
]

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    let userScores: any[] = []
    if (auth.authenticated && auth.user) {
      userScores = await db.miniGameScores.findMany({
        where: { userId: auth.user.id },
        orderBy: { playedAt: 'desc' },
        take: 20,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        games: GAMES_CATALOG,
        recentScores: userScores,
      },
    })
  } catch (error) {
    console.error('Mini games GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { gameType, score } = body

    if (!gameType || typeof score !== 'number') {
      return NextResponse.json({ error: 'gameType and score are required' }, { status: 400 })
    }

    // Compute points won from score
    const pointsWon = Math.min(250, Math.max(25, Math.floor(score * 2)))

    // Save score
    const gameScore = await db.miniGameScores.create({
      data: {
        userId: auth.user.id,
        gameType,
        score,
        pointsWon,
      },
    })

    // Award loyalty points
    await db.buyerRewards.upsert({
      where: { buyerId: auth.user.id },
      create: {
        buyerId: auth.user.id,
        pointsBalance: pointsWon,
        totalEarned: pointsWon,
      },
      update: {
        pointsBalance: { increment: pointsWon },
        totalEarned: { increment: pointsWon },
      },
    })

    await db.rewardTransactions.create({
      data: {
        buyerId: auth.user.id,
        type: 'earn',
        points: pointsWon,
        description: `Won from ${gameType.replace('_', ' ')} Game`,
      },
    })

    // In-app notification
    await sendNotification({
      userId: auth.user.id,
      type: 'promotion',
      title: `Mini Game Reward: +${pointsWon} Points! 🎮`,
      body: `You scored ${score} in ${gameType.replace('_', ' ')} and earned ${pointsWon} loyalty points.`,
      relatedEntityId: gameScore.id,
    })

    return NextResponse.json({
      success: true,
      message: `Score submitted! +${pointsWon} points awarded.`,
      data: gameScore,
    }, { status: 201 })
  } catch (error) {
    console.error('Mini games POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
