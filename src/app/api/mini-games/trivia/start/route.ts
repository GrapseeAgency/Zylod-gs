import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { attemptsToday } from '@/lib/game-points'
import { dealTrivia, publicTriviaPaper, TRIVIA_ATTEMPTS_PER_DAY } from '@/lib/mini-games-catalog'

/**
 * Task 112: deal a REAL trivia paper. The server shuffles the bank, keeps
 * the answer map in a gameChallenges row (15-minute expiry), and hands the
 * client only the questions — the answers never leave the server until the
 * graded submit. A player with no attempts left today is refused honestly.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'mini-games-start', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const used = await attemptsToday(auth.user.id, 'wholesale_trivia')
    if (used >= TRIVIA_ATTEMPTS_PER_DAY) {
      return NextResponse.json(
        { error: `You have used all ${TRIVIA_ATTEMPTS_PER_DAY} quiz attempts for today — come back tomorrow` },
        { status: 429 }
      )
    }

    // stale unconsumed papers are dead weight — clear them
    await db.gameChallenges.deleteMany({
      where: { userId: auth.user.id, game: 'wholesale_trivia', consumedAt: null },
    })

    const deal = dealTrivia(10)
    const challenge = await db.gameChallenges.create({
      data: {
        userId: auth.user.id,
        game: 'wholesale_trivia',
        payload: JSON.stringify({ deal }),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        challengeId: challenge.id,
        questions: publicTriviaPaper(deal),
        expiresAt: challenge.expiresAt,
        attemptsLeft: TRIVIA_ATTEMPTS_PER_DAY - used - 1,
      },
    })
  } catch (error) {
    console.error('Trivia start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
