import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { maintenanceSchema, shapeMaintenance } from '@/lib/app-status'

/**
 * Task 109: MAINTENANCE WINDOWS (admin side). GET /api/app/maintenance has
 * always checked isActive + windows + the IP whitelist correctly — with
 * nothing able to create a window, it could only ever answer "no
 * maintenance". This is the writer: real windows with start<end enforced,
 * the affectedServices vocabulary the reader implies (all|checkout|api|
 * search), and a comma-separated IP whitelist.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-maint-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.maintenanceSchedules.findMany({ orderBy: { scheduledStart: 'desc' } })
    return NextResponse.json({ success: true, data: rows.map(shapeMaintenance) })
  } catch (error) {
    console.error('Admin maintenance GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-maint-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = maintenanceSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.maintenanceSchedules.create({
      data: {
        title: d.title,
        messageEn: d.messageEn,
        messageBn: d.messageBn ?? null,
        scheduledStart: new Date(d.scheduledStart),
        scheduledEnd: new Date(d.scheduledEnd),
        isActive: d.isActive ?? false,
        allowedIps: d.allowedIps ?? null,
        affectedServices: d.affectedServices ?? 'all',
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'maintenance_created',
        entityType: 'maintenanceSchedules',
        entityId: row.id,
        metadata: JSON.stringify({ title: row.title, isActive: row.isActive, services: row.affectedServices }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'maintenance-created', title: row.title, isActive: row.isActive })
    return NextResponse.json({ success: true, data: shapeMaintenance(row), message: 'Maintenance window saved' }, { status: 201 })
  } catch (error) {
    console.error('Admin maintenance POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
