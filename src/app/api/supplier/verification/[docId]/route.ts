import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sendNotification } from '@/lib/notifications'

/**
 * DELETE /api/supplier/verification/[docId] — a supplier removes their OWN
 * uploaded document (ownership scoped through supplierProfiles.userId; the
 * old userId fallback for admins is gone — admins act through the review
 * rail below, never through a supplier's delete).
 *
 * PATCH /api/supplier/verification/[docId] — ADMIN document review (Task 84).
 *
 * What this route WAS (and why it was a hole): an open doc-status writer that
 * authenticated ANY user, checked NO ownership, and accepted ANY status
 * string — any buyer could flip any seller's KYC document to 'verified' with
 * no audit and no rate limit. Zero UI callers. Rebuilt as the missing admin
 * review rail:
 *   1) requireUserType(['admin']) → 401 FIRST (a seller self-verifying is
 *      now structurally impossible).
 *   2) rate limit 30/min.
 *   3) Zod strict { status: under_review|verified|rejected,
 *      rejectionReason? (REQUIRED when rejected, ≤500) } → 400 verbatim.
 *   4) 404 unknown doc.
 *   5) ONE write: status + rejectionReason (cleared on non-reject) +
 *      reviewedAt; audit-logged 'verification_document_reviewed' with the
 *      real before/after.
 *   6) The SELLER is notified of the decision (real notification row with
 *      the reason when rejected).
 */
const REVIEW_LIMIT = { limit: 30, windowMs: 60_000 }

const reviewSchema = z
  .object({
    status: z.enum(['under_review', 'verified', 'rejected'], {
      message: 'status must be one of: under_review | verified | rejected',
    }),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((b) => b.status !== 'rejected' || (b.rejectionReason && b.rejectionReason.length > 0), {
    message: 'A rejection reason is required when rejecting a document',
  })

const DOC_LABELS: Record<string, string> = {
  nid_front: 'NID (front)',
  nid_back: 'NID (back)',
  trade_license: 'Trade license',
  tin_certificate: 'TIN certificate',
  bank_statement: 'Bank statement',
  utility_bill: 'Utility bill',
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  const auth = await requireUserType(request, ['supplier'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Supplier authentication required' },
      { status: 401 }
    )
  }

  try {
    const { docId } = await params
    const supplier = await db.supplierProfiles.findFirst({
      where: { userId: auth.user.id },
      select: { id: true },
    })
    if (!supplier) {
      return NextResponse.json(
        { error: 'Complete seller registration before managing verification documents' },
        { status: 403 }
      )
    }

    const deleted = await db.sellerVerificationDocuments.deleteMany({
      where: { id: docId, supplierId: supplier.id },
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Document removed successfully',
    })
  } catch (error) {
    console.error('Verification doc DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  // 1) Admin rail first — a seller (or buyer) can no longer touch doc status.
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Admin authentication required' },
      { status: 401 }
    )
  }

  // 2) Rate limit.
  const rl = checkRateLimit(request, 'admin-verification-review', REVIEW_LIMIT.limit, REVIEW_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { docId } = await params

    // 3) Zod strict — no free-form status strings.
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = reviewSchema.safeParse(body)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid payload', issues: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const { status, rejectionReason } = parsed.data

    // 4) The doc must exist.
    const existing = await db.sellerVerificationDocuments.findUnique({ where: { id: docId } })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // 5) The review write + audit in one transaction.
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.sellerVerificationDocuments.update({
        where: { id: docId },
        data: {
          status,
          rejectionReason: status === 'rejected' ? rejectionReason! : null,
          reviewedAt: new Date(),
        },
      })
      await tx.auditLogs.create({
        data: {
          actorId: auth.user!.id,
          action: 'verification_document_reviewed',
          entityType: 'sellerVerificationDocuments',
          entityId: docId,
          metadata: JSON.stringify({
            supplierId: existing.supplierId,
            documentType: existing.documentType,
            before: { status: existing.status, rejectionReason: existing.rejectionReason },
            after: { status, rejectionReason: status === 'rejected' ? rejectionReason : null },
          }),
        },
      })
      return row
    })

    // 6) The seller learns the decision (real notification row).
    const profile = await db.supplierProfiles.findUnique({
      where: { id: existing.supplierId },
      select: { userId: true },
    })
    if (profile) {
      const label = DOC_LABELS[existing.documentType] ?? existing.documentType
      await sendNotification({
        userId: profile.userId,
        type: 'system',
        title:
          status === 'verified'
            ? `Document verified: ${label}`
            : status === 'rejected'
              ? `Document rejected: ${label}`
              : `Document under review: ${label}`,
        body:
          status === 'rejected'
            ? `Reason: ${rejectionReason}. Please re-upload a clear, valid document.`
            : status === 'verified'
              ? 'Your document passed review.'
              : 'Our team is reviewing your document.',
        relatedEntityId: docId,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        documentType: updated.documentType,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        reviewedAt: updated.reviewedAt,
      },
      message: `Document ${status}`,
    })
  } catch (error) {
    console.error('Verification doc review error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
