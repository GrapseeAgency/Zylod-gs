import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { rewardTaskPatchSchema } from '@/lib/reward-tasks'

/**
 * Task 111: reward tasks — PATCH and DELETE per row.
 * PATCH touches only the keys that arrived; the audit carries the REAL
 * before/after. isActive=false parks a task — the day-one public reader
 * already filters isActive, so parking genuinely removes it from the
 * buyer earn page without deleting the row. DELETE is real deletion;
 * vouchers already earned keep existing (userCoupons rows are standalone
 * records — buyer earnings never vanish with the task), and the deletion
 * audit stamps how many claims were live so the removal is on the record.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-reward-tasks-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.couponEarningTasks.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Reward task not found' }, { status: 404 })
    }
    const parsed = rewardTaskPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    if (Object.keys(d).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    const row = await db.couponEarningTasks.update({
      where: { id },
      data: {
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.rewardLabel !== undefined ? { rewardLabel: d.rewardLabel } : {}),
        ...(d.rewardBDT !== undefined ? { rewardBDT: d.rewardBDT } : {}),
        ...(d.iconColor !== undefined ? { iconColor: d.iconColor } : {}),
        ...(d.targetCount !== undefined ? { targetCount: d.targetCount } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'reward_task_updated',
        entityType: 'couponEarningTasks',
        entityId: row.id,
        metadata: JSON.stringify({
          before: { title: existing.title, rewardBDT: existing.rewardBDT, targetCount: existing.targetCount, isActive: existing.isActive, sortOrder: existing.sortOrder },
          after: { title: row.title, rewardBDT: row.rewardBDT, targetCount: row.targetCount, isActive: row.isActive, sortOrder: row.sortOrder },
        }),
      },
    })
    await tapAllAdmins('reward:changed', {
      action: 'updated',
      id: row.id,
      title: row.title,
      isActive: row.isActive,
    })
    return NextResponse.json({ success: true, data: row, message: 'Reward task updated' })
  } catch (error) {
    console.error('Admin reward tasks PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-reward-tasks-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.couponEarningTasks.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Reward task not found' }, { status: 404 })
    }
    const liveClaims = await db.userCoupons.count({ where: { couponId: id } })
    await db.couponEarningTasks.delete({ where: { id } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'reward_task_deleted',
        entityType: 'couponEarningTasks',
        entityId: existing.id,
        metadata: JSON.stringify({ title: existing.title, type: existing.type, liveClaimsAtDeletion: liveClaims }),
      },
    })
    await tapAllAdmins('reward:changed', {
      action: 'deleted',
      id: existing.id,
      title: existing.title,
    })
    return NextResponse.json({ success: true, message: 'Reward task deleted' })
  } catch (error) {
    console.error('Admin reward tasks DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
