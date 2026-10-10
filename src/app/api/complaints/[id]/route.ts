import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeComplaint } from '@/lib/complaints'
import { listEvidence } from '@/lib/evidence'

/**
 * GET /api/complaints/[id] — one real complaint.
 * Visible to its owner (the buyer who filed it) or an admin
 * (auth.user.userType === 'admin' — the same detection used by
 * /api/returns/[id]); everyone else gets an honest 403, unknown ids 404.
 * Evidence (Task 49-b): the response carries evidencePhotos metadata (id,
 * mimeType, sizeBytes, note, createdAt, url) — the same owner-or-admin rule
 * governs the bytes via /api/attachments/[id].
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'complaint-detail', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const complaint = await db.complaints.findUnique({ where: { id } })
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    // Owner or admin only — no other buyer can read someone else's complaint.
    if (complaint.buyerId !== auth.user.id && auth.user.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized to view this complaint' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        ...serializeComplaint(complaint),
        evidencePhotos: await listEvidence('complaint', complaint.id),
      },
    })
  } catch (error) {
    console.error('Complaint detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
