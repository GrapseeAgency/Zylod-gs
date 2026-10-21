import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { attemptsToday } from '@/lib/game-points'
import { GAMES_CATALOG } from '@/lib/mini-games-catalog'

/**
 * Task 112: THE REAL GAMES — catalog + the player's real score history.
 * The old POST that accepted any client-declared {gameType, score} for
 * unbounded loyalty points is GONE — gameplay is proven on dedicated
 * server endpoints (/api/mini-games/trivia|memory|box). This GET serves
 * the honest catalog (with each game's real daily limit) and the player's
 * own score history for the games page and game-history page.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)

    let userScores: Array<Record<string, unknown>> = []
    let usage: Record<string, number> | null = null
    if (auth.authenticated && auth.user) {
      const rows = await db.miniGameScores.findMany({
        where: { userId: auth.user.id },
        orderBy: { playedAt: 'desc' },
        take: 20,
      })
      userScores = rows.map((r) => ({
        id: r.id,
        gameType: r.gameType,
        score: r.score,
        pointsWon: r.pointsWon,
        playedAt: r.playedAt,
      }))
      usage = {
        wholesale_trivia: await attemptsToday(auth.user.id, 'wholesale_trivia'),
        memory_match: await attemptsToday(auth.user.id, 'memory_match'),
        box_picker: await attemptsToday(auth.user.id, 'box_picker'),
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        games: GAMES_CATALOG,
        recentScores: userScores,
        usage,
        signedIn: !!(auth.authenticated && auth.user),
      },
    })
  } catch (error) {
    console.error('Mini games GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
