import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { attemptsToday } from '@/lib/game-points'
import { dealMemorySequence, MEMORY_ROUNDS_PER_DAY, MEMORY_EXPIRY_MS } from '@/lib/mini-games-catalog'

/**
 * Task 112: deal a memory challenge. The server generates the cargo
 * sequence (a client-chosen score would be a self-awarded prize), stores it
 * in a gameChallenges row with a 90-second expiry, and hands the sequence
 * to the player to flash on screen — the reproduction is graded at submit
 * time, position by position, and the challenge is consumed exactly once.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'mini-games-start', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const used = await attemptsToday(auth.user.id, 'memory_match')
    if (used >= MEMORY_ROUNDS_PER_DAY) {
      return NextResponse.json(
        { error: `You have played all ${MEMORY_ROUNDS_PER_DAY} memory rounds for today — come back tomorrow` },
        { status: 429 }
      )
    }

    await db.gameChallenges.deleteMany({
      where: { userId: auth.user.id, game: 'memory_match', consumedAt: null },
    })

    const sequence = dealMemorySequence()
    const challenge = await db.gameChallenges.create({
      data: {
        userId: auth.user.id,
        game: 'memory_match',
        payload: JSON.stringify({ sequence }),
        expiresAt: new Date(Date.now() + MEMORY_EXPIRY_MS + 30_000), // flash window + reproduce window
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        challengeId: challenge.id,
        sequence,
        flashMs: 4200,
        roundsLeft: MEMORY_ROUNDS_PER_DAY - used - 1,
      },
    })
  } catch (error) {
    console.error('Memory start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
