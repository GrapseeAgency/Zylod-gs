import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { recordGameResult } from '@/lib/game-points'
import { MEMORY_POINTS_PER_POSITION, MEMORY_SEQUENCE_LENGTH, MEMORY_SYMBOLS } from '@/lib/mini-games-catalog'

/**
 * Task 112: submit a memory reproduction. Graded position-by-position
 * against the server-dealt sequence; the challenge is consumed exactly
 * once and expired challenges are refused — the clock is part of the game.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'mini-games-submit', 30, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = z.object({
      challengeId: z.string().min(5),
      sequence: z.array(z.enum(MEMORY_SYMBOLS)).length(MEMORY_SEQUENCE_LENGTH),
    }).strict().safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || `Send challengeId and a sequence of ${MEMORY_SEQUENCE_LENGTH} cargo symbols` },
        { status: 400 }
      )
    }
    const { challengeId, sequence } = parsed.data

    const challenge = await db.gameChallenges.findUnique({ where: { id: challengeId } })
    if (!challenge || challenge.userId !== auth.user.id || challenge.game !== 'memory_match') {
      return NextResponse.json({ error: 'Memory challenge not found' }, { status: 404 })
    }
    if (challenge.consumedAt) {
      return NextResponse.json({ error: 'This round was already submitted' }, { status: 409 })
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Time ran out — the deal expired' }, { status: 410 })
    }

    const { sequence: dealt } = JSON.parse(challenge.payload) as { sequence: string[] }
    let correct = 0
    for (let i = 0; i < MEMORY_SEQUENCE_LENGTH; i++) {
      if (sequence[i] === dealt[i]) correct++
    }
    const pointsWon = correct * MEMORY_POINTS_PER_POSITION

    await db.gameChallenges.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    await recordGameResult({
      userId: auth.user.id,
      gameType: 'memory_match',
      score: correct,
      pointsWon,
      description: `Cargo matcher: ${correct}/${MEMORY_SEQUENCE_LENGTH} positions`,
    })

    if (pointsWon > 0) {
      await sendNotification({
        userId: auth.user.id,
        type: 'promotion',
        title: `Cargo matcher: ${correct}/${MEMORY_SEQUENCE_LENGTH}`,
        body: `You earned ${pointsWon} loyalty points matching the cargo sequence.`,
        relatedEntityId: challenge.id,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        correct,
        total: MEMORY_SEQUENCE_LENGTH,
        dealtSequence: dealt,
        pointsWon,
        message: correct === MEMORY_SEQUENCE_LENGTH ? 'Perfect run!' : `${correct} of ${MEMORY_SEQUENCE_LENGTH} positions matched`,
      },
    })
  } catch (error) {
    console.error('Memory submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
