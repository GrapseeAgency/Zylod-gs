import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeComplaint } from '@/lib/complaints'

/**
 * POST /api/complaints/[id]/withdraw — the complaint's OWNER pulls it back.
 *
 * Real behavior (no fake success):
 * - Owner ONLY: the authenticated buyer must match complaint.buyerId. Admins
 *   cannot withdraw on a buyer's behalf (the buyer owns this decision).
 * - Only an 'open' complaint can be withdrawn — anything else gets a 409 with
 *   the REAL current status in the message (never a fake success).
 * - The withdrawal is audit-logged ('complaint_withdrawn') with the real
 *   actor id, mirroring the auditLogs write used by the returns review APIs.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'complaint-withdraw', 10, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const complaint = await db.complaints.findUnique({ where: { id } })
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }

    // Owner ONLY — even an admin gets an honest 403 here.
    if (complaint.buyerId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Only the buyer who filed this complaint can withdraw it' },
        { status: 403 }
      )
    }

    // Server-guarded transition: open → withdrawn. Everything else is honest 409.
    if (complaint.status !== 'open') {
      return NextResponse.json(
        {
          error: `This complaint is currently '${complaint.status}' — only open complaints can be withdrawn.`,
        },
        { status: 409 }
      )
    }

    const updated = await db.complaints.update({
      where: { id },
      data: { status: 'withdrawn' },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'complaint_withdrawn',
        entityType: 'complaints',
        entityId: updated.id,
        metadata: JSON.stringify({
          previousStatus: complaint.status,
          newStatus: updated.status,
          buyerId: auth.user.id,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      data: serializeComplaint(updated),
      message: 'Complaint withdrawn. It is closed and will no longer be reviewed.',
    })
  } catch (error) {
    console.error('Complaint withdraw error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
