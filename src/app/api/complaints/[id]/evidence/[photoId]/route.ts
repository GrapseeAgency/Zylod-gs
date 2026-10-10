import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * DELETE /api/complaints/[id]/evidence/[photoId] — the complaint's buyer
 * removes one of their own evidence photos while the complaint is still open.
 *
 * Real behavior (no fake success):
 * - authenticateRequest FIRST → 401.
 * - Owner-only: the authenticated buyer must own the complaint → 403
 *   otherwise (admins review, they do not rewrite buyer evidence).
 * - Open-only: evidence locks once review starts → 409 with the real current
 *   status.
 * - The photo row must belong to THIS complaint AND to THIS buyer — otherwise
 *   404 "Evidence photo not found" (existence is not leaked for photos
 *   attached to someone else's complaint).
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

  const rl = checkRateLimit(request, 'complaints-evidence-delete', 30, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id, photoId } = await params

    const complaint = await db.complaints.findUnique({ where: { id } })
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }
    if (complaint.buyerId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Not authorized — only the buyer who filed this complaint can remove its evidence.' },
        { status: 403 }
      )
    }
    if (complaint.status !== 'open') {
      return NextResponse.json(
        {
          error: `This complaint is currently '${complaint.status}' — evidence is locked once review starts.`,
        },
        { status: 409 }
      )
    }

    // Scoped to THIS complaint + THIS buyer — a foreign photo id is honestly 404.
    const photo = await db.evidencePhotos.findFirst({
      where: {
        id: photoId,
        ownerType: 'complaint',
        complaintId: id,
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
          ownerType: 'complaint',
          complaintId: id,
          buyerId: auth.user.id,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          note: photo.note,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Evidence photo removed from the complaint.',
    })
  } catch (error) {
    console.error('Complaint evidence delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
