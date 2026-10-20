import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'

/**
 * PATCH /api/inspections/[id] — the inspection state machine, ADMIN-ONLY
 * (Task 91). The buyer requests; the platform disposes:
 *
 *   pending → scheduled    SCHEDULE  {scheduledAt} — an inspection slot is
 *                                     booked (self or third party).
 *   scheduled → completed  COMPLETE  {reportUrl} — REQUIRED: a completed
 *                                     inspection without its report is a
 *                                     lie, so the URL is a hard guard.
 *   scheduled → failed     FAIL      {note} — REQUIRED: the finding must be
 *                                     recorded, verbatim, for the buyer.
 *
 * Illegal moves are REAL 409s naming the current state. The requester's own
 * id-space is preserved: only the inspection's BUYER is notified at every
 * step (durable, prefs-checked, with the report URL or the failure note
 * verbatim). Unknown id → real 404. Every transition audits
 * (entityType 'inspectionRequests').
 */

const InspectionPatchSchema = z
  .object({
    action: z.enum(['schedule', 'complete', 'fail']),
    scheduledAt: z.coerce.date().optional(),
    reportUrl: z.string().trim().url().max(2048).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => v.action !== 'schedule' || Boolean(v.scheduledAt), {
    message: 'schedule requires scheduledAt',
    path: ['scheduledAt'],
  })
  .refine((v) => v.action !== 'complete' || Boolean(v.reportUrl), {
    message: 'complete requires reportUrl',
    path: ['reportUrl'],
  })
  .refine((v) => v.action !== 'fail' || Boolean(v.note), {
    message: 'fail requires note',
    path: ['note'],
  })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-inspections-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const inspection = await db.inspectionRequests.findUnique({
      where: { id },
      include: { order: { select: { orderNumber: true } } },
    })
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => null)
    const parsed = InspectionPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid inspection action', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { action, scheduledAt, reportUrl, note } = parsed.data

    if (action === 'schedule' && inspection.status !== 'pending') {
      return NextResponse.json({ error: `Cannot schedule — the inspection is already ${inspection.status}` }, { status: 409 })
    }
    if ((action === 'complete' || action === 'fail') && inspection.status !== 'scheduled') {
      return NextResponse.json({ error: `Cannot ${action} — the inspection is ${inspection.status}, not scheduled` }, { status: 409 })
    }

    const nextStatus = action === 'schedule' ? 'scheduled' : action === 'complete' ? 'completed' : 'failed'
    const updated = await db.inspectionRequests.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(action === 'schedule' && scheduledAt ? { scheduledAt } : {}),
        ...(action === 'complete' && reportUrl ? { reportUrl, completedAt: new Date() } : {}),
        ...(action === 'fail' ? { completedAt: new Date() } : {}),
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: `inspection_${nextStatus}`,
        entityType: 'inspectionRequests',
        entityId: id,
        metadata: JSON.stringify({
          orderId: inspection.orderId,
          orderNumber: inspection.order?.orderNumber ?? null,
          scheduledAt: scheduledAt?.toISOString() ?? null,
          reportUrl: reportUrl ?? null,
          note: note ?? null,
        }),
      },
    })

    // The BUYER is told — every step, durably (prefs-checked + live push):
    const orderLabel = inspection.order?.orderNumber || 'your order'
    if (action === 'schedule' && scheduledAt) {
      await sendNotification({
        userId: inspection.buyerId,
        type: 'order',
        title: `Inspection scheduled — ${orderLabel}`,
        body: `Your ${inspection.inspectorType === 'third_party' ? 'third-party' : 'self'} inspection is booked for ${scheduledAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.`,
        relatedEntityId: id,
      })
    } else if (action === 'complete' && reportUrl) {
      await sendNotification({
        userId: inspection.buyerId,
        type: 'order',
        title: `Inspection passed — ${orderLabel}`,
        body: 'The inspection completed and the report is ready in your order page.',
        relatedEntityId: id,
      })
    } else if (action === 'fail' && note) {
      await sendNotification({
        userId: inspection.buyerId,
        type: 'order',
        title: `Inspection failed — ${orderLabel}`,
        body: `Finding: "${note}"`,
        relatedEntityId: id,
      })
    }

    return NextResponse.json({ success: true, data: { inspection: updated } })
  } catch (err) {
    console.error('PATCH /api/inspections/[id] error:', err)
    return NextResponse.json({ error: 'Failed to update inspection' }, { status: 500 })
  }
}
