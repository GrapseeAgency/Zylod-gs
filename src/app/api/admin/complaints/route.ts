import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { serializeComplaint, complaintCategoryLabel } from '@/lib/complaints'
import { listEvidence } from '@/lib/evidence'

/**
 * GET /api/admin/complaints — admin review queue for buyer complaints.
 *
 * Real behavior (no fake data):
 * - Admin auth is checked FIRST (401 before any query work).
 * - Rows come newest-first from the real complaints table (plain string FKs).
 * - Buyers are joined from buyerProfiles (users has NO name column — the
 *   Task-46 pattern: one query where userId in buyers, use fullName). A buyer
 *   without a profile shows null — never a fabricated name.
 * - Counts per status are real groupBy aggregates on the same table; `total`
 *   is a real count. Every row carries its orderId passthrough (null when the
 *   complaint was not order-related).
 * - Evidence (Task 49-b): each row carries its real evidence[] metadata (id,
 *   mimeType, sizeBytes, note) in ONE batched query — admins review what the
 *   buyer actually filed; the bytes themselves are served by
 *   /api/attachments/[id] (owner-or-admin gated).
 */

const QuerySchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'rejected', 'withdrawn', 'all']).default('all'),
  take: z.coerce.number().int().min(1).max(200).default(100),
})

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-complaints-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const parsed = QuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { status, take } = parsed.data

    const where = status === 'all' ? {} : { status }
    const complaints = await db.complaints.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })

    // Buyer display names via buyerProfiles (users has no name column).
    const buyerIds = [...new Set(complaints.map((c) => c.buyerId))]
    const profiles = buyerIds.length
      ? await db.buyerProfiles.findMany({
          where: { userId: { in: buyerIds } },
          select: { userId: true, fullName: true },
        })
      : []
    const nameByUserId = new Map(profiles.map((p) => [p.userId, p.fullName]))

    // Evidence metadata for the queue — ONE batched query over the plain FK
    // (metadata only: id/mimeType/sizeBytes/note; never the data column).
    const complaintIds = complaints.map((c) => c.id)
    const allEvidence = complaintIds.length
      ? await db.evidencePhotos.findMany({
          where: { ownerType: 'complaint', complaintId: { in: complaintIds } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, complaintId: true, mimeType: true, sizeBytes: true, note: true },
        })
      : []
    const evidenceByComplaint = new Map<string, typeof allEvidence>()
    for (const photo of allEvidence) {
      // ownerType 'complaint' rows always carry complaintId (enforced by every
      // write path) — the guard keeps types honest instead of asserting.
      if (!photo.complaintId) continue
      const list = evidenceByComplaint.get(photo.complaintId) ?? []
      list.push(photo)
      evidenceByComplaint.set(photo.complaintId, list)
    }

    // Real per-status counts (groupBy) + total (count).
    const [statusRows, total] = await Promise.all([
      db.complaints.groupBy({ by: ['status'], _count: { _all: true } }),
      db.complaints.count(),
    ])
    const counts: Record<string, number> = {
      open: 0,
      in_review: 0,
      resolved: 0,
      rejected: 0,
      withdrawn: 0,
    }
    for (const row of statusRows) counts[row.status] = row._count._all

    return NextResponse.json({
      success: true,
      data: {
        complaints: complaints.map((c) => ({
          ...serializeComplaint(c),
          buyerName: nameByUserId.get(c.buyerId) ?? null,
          categoryLabel: complaintCategoryLabel(c.category),
          evidence: (evidenceByComplaint.get(c.id) ?? []).map((p) => ({
            id: p.id,
            mimeType: p.mimeType,
            sizeBytes: p.sizeBytes,
            note: p.note,
            url: `/api/attachments/${p.id}`,
          })),
        })),
        counts: { ...counts, total },
        dataNotes: [
          'Buyer names come from buyerProfiles (users has no name column); a missing profile is shown as null.',
          'Statuses are server-guarded: open → in_review → resolved/rejected, and open → withdrawn by the buyer. resolved/rejected are terminal.',
          'The complaint id is the real database identifier — no separate complaint numbers exist.',
          'Evidence photos are buyer-provided: they can only be attached while a complaint is open and are locked from review onwards. Bytes are served by /api/attachments/[id] to the uploading buyer and admins only.',
        ],
      },
    })
  } catch (error) {
    console.error('Admin complaints GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
