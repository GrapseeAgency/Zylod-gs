import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { maintenancePatchSchema, shapeMaintenance } from '@/lib/app-status'

/**
 * Task 109: maintenance windows — PATCH/DELETE. PATCH touches only arrived
 * keys; a window change re-checks start<end across the merged pair.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-maint-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.maintenanceSchedules.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Maintenance window not found' }, { status: 404 })
    }
    const parsed = maintenancePatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const start = d.scheduledStart ? new Date(d.scheduledStart) : existing.scheduledStart
    const end = d.scheduledEnd ? new Date(d.scheduledEnd) : existing.scheduledEnd
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json({ error: 'scheduledEnd must be after scheduledStart' }, { status: 400 })
    }
    const row = await db.maintenanceSchedules.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.messageEn !== undefined ? { messageEn: d.messageEn } : {}),
        ...(d.messageBn !== undefined ? { messageBn: d.messageBn } : {}),
        ...(d.scheduledStart !== undefined ? { scheduledStart: start } : {}),
        ...(d.scheduledEnd !== undefined ? { scheduledEnd: end } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        ...(d.allowedIps !== undefined ? { allowedIps: d.allowedIps } : {}),
        ...(d.affectedServices !== undefined ? { affectedServices: d.affectedServices } : {}),
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'maintenance_updated',
        entityType: 'maintenanceSchedules',
        entityId: row.id,
        metadata: JSON.stringify({
          before: { title: existing.title, isActive: existing.isActive },
          after: { title: row.title, isActive: row.isActive },
        }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'maintenance-updated', title: row.title, isActive: row.isActive })
    return NextResponse.json({ success: true, data: shapeMaintenance(row), message: 'Maintenance window updated' })
  } catch (error) {
    console.error('Admin maintenance PATCH error:', error)
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
  const rl = checkRateLimit(request, 'admin-maint-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.maintenanceSchedules.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Maintenance window not found' }, { status: 404 })
    }
    await db.maintenanceSchedules.delete({ where: { id } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'maintenance_deleted',
        entityType: 'maintenanceSchedules',
        entityId: existing.id,
        metadata: JSON.stringify({ title: existing.title }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'maintenance-deleted', title: existing.title })
    return NextResponse.json({ success: true, message: 'Maintenance window deleted' })
  } catch (error) {
    console.error('Admin maintenance DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
