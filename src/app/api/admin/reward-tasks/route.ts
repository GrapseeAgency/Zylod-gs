import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { rewardTaskSchema } from '@/lib/reward-tasks'

/**
 * Task 111: THE REWARD TASKS RAIL (admin side).
 * couponEarningTasks has been served to buyers by GET /api/coupons/earn
 * since day one with zero writers — the "Earn Free Vouchers" page was an
 * empty frame forever, and its old POST was a money printer (any
 * authenticated user POSTing a taskId minted a voucher with no proof).
 * This is the console: admins may only mint tasks whose completion the
 * server can PROVE from real rows (see src/lib/reward-tasks.ts — share /
 * referral / review_photo are refused at create time because the platform
 * has no proof source for them).
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-reward-tasks-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const tasks = await db.couponEarningTasks.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    const claimsByTask = await db.userCoupons.groupBy({
      by: ['couponId'],
      where: { couponId: { in: tasks.map((t) => t.id) } },
      _count: { couponId: true },
    })
    const claimMap = new Map(claimsByTask.map((g) => [g.couponId, g._count.couponId]))

    const stats = {
      total: tasks.length,
      active: tasks.filter((t) => t.isActive).length,
      parked: tasks.filter((t) => !t.isActive).length,
      totalClaims: [...claimMap.values()].reduce((a, b) => a + b, 0),
    }

    return NextResponse.json({
      success: true,
      data: tasks.map((t) => ({ ...t, claimCount: claimMap.get(t.id) ?? 0 })),
      stats,
    })
  } catch (error) {
    console.error('Admin reward tasks GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-reward-tasks-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = rewardTaskSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const row = await db.couponEarningTasks.create({
      data: {
        type: d.type,
        title: d.title,
        description: d.description,
        rewardLabel: d.rewardLabel,
        rewardBDT: d.rewardBDT,
        iconColor: d.iconColor,
        targetCount: d.targetCount,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'reward_task_created',
        entityType: 'couponEarningTasks',
        entityId: row.id,
        metadata: JSON.stringify({ type: row.type, title: row.title, rewardBDT: row.rewardBDT, targetCount: row.targetCount, isActive: row.isActive }),
      },
    })
    await tapAllAdmins('reward:changed', {
      action: 'created',
      id: row.id,
      title: row.title,
      type: row.type,
      isActive: row.isActive,
    })
    return NextResponse.json({ success: true, data: { ...row, claimCount: 0 }, message: 'Reward task created' }, { status: 201 })
  } catch (error) {
    console.error('Admin reward tasks POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
