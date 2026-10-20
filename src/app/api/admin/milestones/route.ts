import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { milestoneSchema, shapeAdminMilestone } from '@/lib/company-content'

/**
 * Task 106: THE COMPANY CONTENT RAIL (company milestones, admin side).
 * The About timeline has fetched /api/about/milestones (isPublished only)
 * since day one; nothing could write a row, so the page was an empty frame
 * forever. This is the writer — full list for the console (published AND
 * drafts), create/publish/delete with audits + admin-room taps.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-milestones-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const [rows, groupBy] = await Promise.all([
      db.companyMilestones.findMany({
        orderBy: [{ year: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      db.companyMilestones.groupBy({ by: ['isPublished'], _count: { isPublished: true } }),
    ])
    const stats = { total: 0, published: 0, drafts: 0 }
    for (const g of groupBy) {
      stats.total += g._count.isPublished
      if (g.isPublished) stats.published += g._count.isPublished
      else stats.drafts += g._count.isPublished
    }
    return NextResponse.json({ success: true, data: rows.map(shapeAdminMilestone), stats })
  } catch (error) {
    console.error('Admin milestones GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-milestones-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = milestoneSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const row = await db.companyMilestones.create({
      data: {
        year: d.year,
        month: d.month ?? null,
        title: d.title,
        description: d.description,
        iconType: d.iconType ?? 'star',
        sortOrder: d.sortOrder ?? 0,
        isPublished: d.isPublished ?? true,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'milestone_created',
        entityType: 'companyMilestones',
        entityId: row.id,
        metadata: JSON.stringify({ year: row.year, title: row.title, isPublished: row.isPublished }),
      },
    })
    await tapAllAdmins('milestone:changed', {
      action: 'created',
      id: row.id,
      title: row.title,
      year: row.year,
      isPublished: row.isPublished,
    })
    return NextResponse.json({ success: true, data: shapeAdminMilestone(row), message: 'Milestone created' }, { status: 201 })
  } catch (error) {
    console.error('Admin milestones POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
