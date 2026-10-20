import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { milestonePatchSchema, shapeAdminMilestone } from '@/lib/company-content'

/**
 * Task 106: company milestones — PATCH and DELETE per row.
 * PATCH touches only the keys that arrived (no defaults on the shared
 * schema — the zod-v4 lesson from Task 100). A draft milestone is the SAME
 * phantom on the public rail: /api/about/milestones filters isPublished,
 * so unpublishing genuinely removes it from the timeline without deleting
 * the row. DELETE is real deletion with an audit trail.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-milestones-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.companyMilestones.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }
    const parsed = milestonePatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const row = await db.companyMilestones.update({
      where: { id },
      data: {
        ...(d.year !== undefined ? { year: d.year } : {}),
        ...(d.month !== undefined ? { month: d.month } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.iconType !== undefined ? { iconType: d.iconType } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        ...(d.isPublished !== undefined ? { isPublished: d.isPublished } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'milestone_updated',
        entityType: 'companyMilestones',
        entityId: row.id,
        metadata: JSON.stringify({
          before: { year: existing.year, title: existing.title, isPublished: existing.isPublished },
          after: { year: row.year, title: row.title, isPublished: row.isPublished },
        }),
      },
    })
    await tapAllAdmins('milestone:changed', {
      action: 'updated',
      id: row.id,
      title: row.title,
      year: row.year,
      isPublished: row.isPublished,
    })
    return NextResponse.json({ success: true, data: shapeAdminMilestone(row), message: 'Milestone updated' })
  } catch (error) {
    console.error('Admin milestones PATCH error:', error)
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
  const rl = checkRateLimit(request, 'admin-milestones-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.companyMilestones.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    }
    await db.companyMilestones.delete({ where: { id } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'milestone_deleted',
        entityType: 'companyMilestones',
        entityId: existing.id,
        metadata: JSON.stringify({ year: existing.year, title: existing.title }),
      },
    })
    await tapAllAdmins('milestone:changed', {
      action: 'deleted',
      id: existing.id,
      title: existing.title,
    })
    return NextResponse.json({ success: true, message: 'Milestone deleted' })
  } catch (error) {
    console.error('Admin milestones DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
