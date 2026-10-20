import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { diagnosticSchema, shapeDiagnostic } from '@/lib/app-status'

/**
 * Task 109: SERVICE LOG (admin side). GET /api/app/diagnostics does real
 * live probes and reads the last 10 appDiagnostics rows — an ops journal
 * nobody could write. Admins log status observations here (the honest
 * shape: what was checked, what was found, when).
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-diag-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.appDiagnostics.findMany({ orderBy: { checkedAt: 'desc' }, take: 50 })
    return NextResponse.json({ success: true, data: rows.map(shapeDiagnostic) })
  } catch (error) {
    console.error('Admin diagnostics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-diag-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = diagnosticSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.appDiagnostics.create({
      data: {
        serviceName: d.serviceName,
        status: d.status,
        responseTimeMs: d.responseTimeMs ?? 0,
        detailsJson: d.details ? JSON.stringify({ note: d.details }) : null,
      },
    })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'diagnostic_logged',
        entityType: 'appDiagnostics',
        entityId: row.id,
        metadata: JSON.stringify({ service: row.serviceName, status: row.status, responseTimeMs: row.responseTimeMs }),
      },
    })
    await tapAllAdmins('appstatus:changed', { action: 'diagnostic-logged', service: row.serviceName, status: row.status })
    return NextResponse.json({ success: true, data: shapeDiagnostic(row), message: 'Observation logged' }, { status: 201 })
  } catch (error) {
    console.error('Admin diagnostics POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
