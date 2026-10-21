import { db } from '@/lib/db'

/**
 * Task 112: server-side helpers for the real games round — daily attempt
 * accounting and the points award that every game shares. Points are
 * platform currency (redeemable for vouchers via /api/rewards/redeem), so
 * every award writes a real rewardTransactions ledger row; the score row
 * is written even for a zero (an attempt is an attempt — the honest history
 * shows the misses too).
 */

export function startOfToday(): Date {
  return new Date(new Date().toISOString().split('T')[0] + 'T00:00:00.000Z')
}

export async function attemptsToday(userId: string, gameType: string): Promise<number> {
  return db.miniGameScores.count({
    where: { userId, gameType, playedAt: { gte: startOfToday() } },
  })
}

/** Write the score row and, when points were actually won, the ledger + balance. */
export async function recordGameResult(opts: {
  userId: string
  gameType: string
  score: number
  pointsWon: number
  description: string
}): Promise<void> {
  await db.miniGameScores.create({
    data: { userId: opts.userId, gameType: opts.gameType, score: opts.score, pointsWon: opts.pointsWon },
  })
  if (opts.pointsWon > 0) {
    await db.buyerRewards.upsert({
      where: { buyerId: opts.userId },
      create: { buyerId: opts.userId, pointsBalance: opts.pointsWon, totalEarned: opts.pointsWon },
      update: { pointsBalance: { increment: opts.pointsWon }, totalEarned: { increment: opts.pointsWon } },
    })
    await db.rewardTransactions.create({
      data: { buyerId: opts.userId, type: 'earn', points: opts.pointsWon, description: opts.description },
    })
  }
}
