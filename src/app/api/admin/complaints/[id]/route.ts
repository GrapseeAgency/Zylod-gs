import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeComplaint, notifyComplaintDecided } from '@/lib/complaints'
import { listEvidence } from '@/lib/evidence'

/**
 * PATCH /api/admin/complaints/[id] — review a buyer complaint (ADMIN ONLY).
 *
 * Real behavior (no fake success):
 * - Server-guarded transitions only; the client can never set a status:
 *     open        → in_review            (action 'start_review')
 *     in_review   → resolved | rejected  (actions 'resolve'/'reject')
 * - resolve/reject REQUIRE a real resolutionNote (≥ 3 chars) — the buyer sees
 *   it → 422 when missing or too short.
 * - resolved/rejected are TERMINAL: further attempts get a 409 with the REAL
 *   current status in the message. withdrawn/open rows are not resolvable.
 * - resolve/reject set resolvedById = the authenticated admin's id (never
 *   client-supplied) and resolvedAt = now.
 * - Every decision is audit-logged ('complaint_reviewed') with metadata
 *   {action, before, after, adminId}.
 */

const BodySchema = z.object({
  action: z.enum(['start_review', 'resolve', 'reject']),
  resolutionNote: z.string().max(5000).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-complaints-action', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { action } = parsed.data
    const trimmedNote = (parsed.data.resolutionNote ?? '').trim()

    // Resolving or rejecting requires a real, visible note (honest record).
    if ((action === 'resolve' || action === 'reject') && trimmedNote.length < 3) {
      return NextResponse.json(
        {
          error:
            'A resolution note of at least 3 characters is required — the buyer will see this decision on their complaint.',
        },
        { status: 422 }
      )
    }

    const existing = await db.complaints.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    // Server-guarded transitions.
    if (action === 'start_review' && existing.status !== 'open') {
      return NextResponse.json(
        {
          error: `This complaint is currently '${existing.status}' — only open complaints can move into review.`,
        },
        { status: 409 }
      )
    }
    if ((action === 'resolve' || action === 'reject') && existing.status !== 'in_review') {
      return NextResponse.json(
        {
          error:
            existing.status === 'open'
              ? `This complaint is still '${existing.status}' — start the review first before resolving or rejecting it.`
              : `This complaint is currently '${existing.status}' — only complaints in review can be resolved or rejected.`,
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const updated = await db.complaints.update({
      where: { id },
      data:
        action === 'start_review'
          ? { status: 'in_review' }
          : {
              status: action === 'resolve' ? 'resolved' : 'rejected',
              resolutionNote: trimmedNote,
              resolvedById: auth.user.id,
              resolvedAt: now,
            },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'complaint_reviewed',
        entityType: 'complaints',
        entityId: updated.id,
        metadata: JSON.stringify({
          action,
          before: existing.status,
          after: updated.status,
          adminId: auth.user.id,
          ...(trimmedNote.length > 0 ? { resolutionNote: updated.resolutionNote } : {}),
        }),
      },
    })

    // Task 86 cohesion rail — the filer HEARS every move: start_review,
    // resolve and reject each land a durable notification on the buyer AND a
    // live 'notification:new' push into their user:<buyerId> room
    // (sendNotification broadcasts it). Awaited: the notification is part of
    // the decision, not decoration.
    await notifyComplaintDecided(
      { ...existing, resolutionNote: updated.resolutionNote },
      action
    )

    return NextResponse.json({
      success: true,
      // Serialized with the row's real evidence[] metadata so the queue UI can
      // replace state without losing the evidence section (same shape as the
      // list endpoint).
      data: {
        ...serializeComplaint(updated),
        evidence: await listEvidence('complaint', updated.id),
      },
      message:
        action === 'start_review'
          ? 'Complaint moved into review.'
          : action === 'resolve'
            ? 'Complaint resolved. The buyer can see the resolution note on their complaint.'
            : 'Complaint rejected. The buyer can see the resolution note on their complaint.',
    })
  } catch (error) {
    console.error('Admin complaints PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
