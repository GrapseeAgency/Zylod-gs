import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { recordGameResult } from '@/lib/game-points'
import { gradeTrivia, TRIVIA_POINTS_PER_CORRECT, type TriviaDealItem } from '@/lib/mini-games-catalog'

/**
 * Task 112: submit a trivia answer sheet. The server grades the sheet
 * against the deal it stored at start time — the score is earned, not
 * declared. The challenge is consumed exactly once (a replayed submit is a
 * 409), expired papers are refused, and an all-wrong sheet is still a real
 * recorded attempt (score 0, no points, ledger untouched).
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
      answers: z.array(z.object({ id: z.number().int().min(0).max(999), choice: z.number().int().min(0).max(9) })).length(10),
    }).strict().safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Send challengeId and exactly 10 answers' },
        { status: 400 }
      )
    }
    const { challengeId, answers } = parsed.data

    const challenge = await db.gameChallenges.findUnique({ where: { id: challengeId } })
    if (!challenge || challenge.userId !== auth.user.id || challenge.game !== 'wholesale_trivia') {
      return NextResponse.json({ error: 'Quiz paper not found' }, { status: 404 })
    }
    if (challenge.consumedAt) {
      return NextResponse.json({ error: 'This paper was already submitted' }, { status: 409 })
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'This paper expired — start a fresh quiz' }, { status: 410 })
    }

    const { deal } = JSON.parse(challenge.payload) as { deal: TriviaDealItem[] }
    const correct = gradeTrivia(deal, answers)
    const pointsWon = correct * TRIVIA_POINTS_PER_CORRECT

    await db.gameChallenges.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    await recordGameResult({
      userId: auth.user.id,
      gameType: 'wholesale_trivia',
      score: correct,
      pointsWon,
      description: `Wholesale trivia: ${correct}/10 correct`,
    })

    if (pointsWon > 0) {
      await sendNotification({
        userId: auth.user.id,
        type: 'promotion',
        title: `Quiz graded: ${correct}/10 correct`,
        body: `You earned ${pointsWon} loyalty points from the B2B Wholesale Master Quiz.`,
        relatedEntityId: challenge.id,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        correct,
        total: deal.length,
        pointsWon,
        message: correct === deal.length
          ? 'Perfect paper!'
          : correct > 0
            ? `You answered ${correct} of ${deal.length} correctly`
            : 'None correct this time — the paper is still real',
      },
    })
  } catch (error) {
    console.error('Trivia submit error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
