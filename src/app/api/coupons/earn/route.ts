import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'
import { tapAllAdmins } from '@/lib/warehouses'
import { countProof, progressMessage } from '@/lib/reward-tasks'
import type { RewardTaskRow } from '@/lib/reward-tasks'

/**
 * Task 111: THE REWARD TASKS RAIL (buyer side) — rewritten.
 *
 * GET /api/coupons/earn — list active tasks (public since day one). When
 * the caller is signed in, each task also carries `claimed` (this buyer
 * already earned it) and `progress` (the buyer's REAL proof count vs the
 * target) so the page shows honest progress instead of a blind Claim
 * button. Guests get the same array without those fields.
 *
 * POST /api/coupons/earn — the claim. The old version was a money printer:
 * any authenticated user POSTing any taskId minted a ৳ voucher instantly —
 * no proof of completion, no one-claim guard, no rate limit, no audit. The
 * rewrite makes a task claim like every money rail on this platform:
 *   401-first → rate limit → STRICT body → task must be active →
 *   one claim per buyer per task (409) → the server counts the buyer's
 *   REAL rows (orders / reviews / wishlists / check-ins / winning spins /
 *   bulk lines) and refuses with the honest shortfall (403) →
 *   only then does the voucher exist (created in one tx with the
 *   duplicate re-check), audited, notified, and tapped to admins.
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const userId = auth.authenticated && auth.user ? auth.user.id : null

    const tasks = await db.couponEarningTasks.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    if (!userId || tasks.length === 0) {
      return NextResponse.json({ success: true, data: tasks })
    }

    const [claims, vouchers] = await Promise.all([
      db.userCoupons.findMany({
        where: { userId, couponId: { in: tasks.map((t) => t.id) } },
        select: { couponId: true, id: true },
      }),
      // progress reads are independent per task — run them against real rows
      Promise.all(
        tasks.map(async (t) => ({
          id: t.id,
          count: await countProof(userId, t as RewardTaskRow),
        }))
      ),
    ])

    const claimedSet = new Set(claims.map((c) => c.couponId))
    const progressMap = new Map(vouchers.map((v) => [v.id, v.count]))

    return NextResponse.json({
      success: true,
      data: tasks.map((t) => {
        const count = progressMap.get(t.id) ?? 0
        return {
          ...t,
          claimed: claimedSet.has(t.id),
          progress: { count, required: t.targetCount, met: count >= t.targetCount },
        }
      }),
    })
  } catch (error) {
    console.error('Coupon earn tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'coupon-earn-claim', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { taskId } = body as Record<string, unknown>
    const extraKeys = Object.keys(body as Record<string, unknown>).filter((k) => k !== 'taskId')
    if (extraKeys.length > 0) {
      return NextResponse.json({ error: `Unknown fields not allowed: ${extraKeys.join(', ')}` }, { status: 400 })
    }
    if (typeof taskId !== 'string' || taskId.length === 0) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const task = await db.couponEarningTasks.findUnique({ where: { id: taskId } })
    if (!task || !task.isActive) {
      return NextResponse.json({ error: 'Task not found or inactive' }, { status: 404 })
    }

    const buyerId = auth.user.id

    // One claim per buyer per task — forever. A re-claimable reward is a
    // money printer with a delay; the vault already proves the first one.
    const dup = await db.$transaction(async (tx) => {
      const existing = await tx.userCoupons.findFirst({
        where: { userId: buyerId, couponId: task.id },
        select: { id: true },
      })
      if (existing) return existing
      return null
    })
    if (dup) {
      return NextResponse.json(
        { error: 'You have already claimed this reward — it is in your voucher vault' },
        { status: 409 }
      )
    }

    // PROOF — the server counts the buyer's real rows. A claim without
    // proof is refused with the honest shortfall, never silently awarded.
    const count = await countProof(buyerId, task as RewardTaskRow)
    if (count < task.targetCount) {
      return NextResponse.json(
        { error: progressMessage(task as RewardTaskRow, count), progress: { count, required: task.targetCount } },
        { status: 403 }
      )
    }

    const typeTag = task.type.toUpperCase().replace(/_/g, '')
    const generatedCode = `EARN-${typeTag}-${randomBytes(4).toString('hex').toUpperCase()}`
    const validUntil = new Date(Date.now() + 14 * 86400000) // 14 days valid

    const earnedCoupon = await db.$transaction(async (tx) => {
      const clash = await tx.userCoupons.findFirst({
        where: { userId: buyerId, couponId: task.id },
        select: { id: true },
      })
      if (clash) throw new Error('ALREADY_CLAIMED')
      return tx.userCoupons.create({
        data: {
          userId: buyerId,
          couponId: task.id,
          code: generatedCode,
          title: `Reward: ${task.title}`,
          discountStyle: 'fixed',
          discountLabel: task.rewardLabel,
          status: 'active',
          validUntil,
          savingsBDT: task.rewardBDT,
          minOrderBDT: task.rewardBDT * 5,
          categoryLabel: 'Task Reward',
          categoryColor: task.iconColor || '#C8102E',
        },
      })
    }).catch((err: unknown) => {
      if (err instanceof Error && err.message === 'ALREADY_CLAIMED') return null
      throw err
    })

    if (!earnedCoupon) {
      return NextResponse.json(
        { error: 'You have already claimed this reward — it is in your voucher vault' },
        { status: 409 }
      )
    }

    await db.auditLogs.create({
      data: {
        actorId: buyerId,
        action: 'reward_claimed',
        entityType: 'userCoupons',
        entityId: earnedCoupon.id,
        metadata: JSON.stringify({
          taskId: task.id,
          taskTitle: task.title,
          taskType: task.type,
          rewardBDT: task.rewardBDT,
          voucherCode: earnedCoupon.code,
          proofCount: count,
        }),
      },
    })

    await sendNotification({
      userId: buyerId,
      type: 'promotion',
      title: `Task Reward Unlocked: ${task.rewardLabel}`,
      body: `You completed "${task.title}" and earned a ৳${task.rewardBDT} discount voucher! Use code ${earnedCoupon.code} at checkout.`,
      relatedEntityId: earnedCoupon.id,
    })

    await tapAllAdmins('reward:claimed', {
      voucherId: earnedCoupon.id,
      taskId: task.id,
      taskTitle: task.title,
      rewardLabel: task.rewardLabel,
    })

    return NextResponse.json({
      success: true,
      message: 'Task completed and coupon earned!',
      data: earnedCoupon,
    }, { status: 201 })
  } catch (error) {
    console.error('Coupon earn complete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
