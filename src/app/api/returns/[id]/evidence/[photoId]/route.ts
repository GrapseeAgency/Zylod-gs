import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * DELETE /api/returns/[id]/evidence/[photoId] — the return's buyer removes one
 * of their own evidence photos while the request is still pending.
 *
 * Real behavior (no fake success):
 * - authenticateRequest FIRST → 401.
 * - Owner-only: the authenticated buyer must own the return request → 403
 *   otherwise (admins review, they do not rewrite buyer evidence).
 * - Pending-only: evidence locks at the review decision → 409 with the real
 *   current status.
 * - The photo row must belong to THIS return request AND to THIS buyer —
 *   otherwise 404 "Evidence photo not found" (existence is not leaked for
 *   photos attached to someone else's return).
 * - The delete is audit-logged ('evidence_deleted') with the authenticated
 *   buyer as actor.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'returns-evidence-delete', 30, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id, photoId } = await params

    const ret = await db.returnRequests.findUnique({ where: { id } })
    if (!ret) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }
    if (ret.buyerId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Not authorized — only the buyer who filed this return request can remove its evidence.' },
        { status: 403 }
      )
    }
    if (ret.status !== 'pending') {
      return NextResponse.json(
        {
          error: `This return request (${ret.returnNumber}) is already '${ret.status}' — evidence is locked once the review decision is made.`,
        },
        { status: 409 }
      )
    }

    // Scoped to THIS return + THIS buyer — a foreign photo id is honestly 404.
    const photo = await db.evidencePhotos.findFirst({
      where: {
        id: photoId,
        ownerType: 'return',
        returnRequestId: id,
        buyerId: auth.user.id,
      },
    })
    if (!photo) {
      return NextResponse.json({ error: 'Evidence photo not found' }, { status: 404 })
    }

    await db.evidencePhotos.delete({ where: { id: photo.id } })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'evidence_deleted',
        entityType: 'evidencePhotos',
        entityId: photo.id,
        metadata: JSON.stringify({
          ownerType: 'return',
          returnRequestId: id,
          returnNumber: ret.returnNumber,
          buyerId: auth.user.id,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          note: photo.note,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Evidence photo removed from the return request.',
    })
  } catch (error) {
    console.error('Return evidence delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
