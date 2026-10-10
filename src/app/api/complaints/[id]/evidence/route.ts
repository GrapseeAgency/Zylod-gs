import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { validateEvidenceFile, EVIDENCE_MAX_PHOTOS, EVIDENCE_NOTE_MAX_CHARS } from '@/lib/evidence'

/**
 * POST /api/complaints/[id]/evidence — the complaint's buyer attaches one
 * evidence photo (multipart/form-data with a `file` field and an optional
 * `note` caption ≤ 200 chars).
 *
 * Real behavior (no fake success):
 * - authenticateRequest FIRST → 401 before any parsing or query work.
 * - The buyer must OWN the complaint (complaints.buyerId === the authenticated
 *   user) → 403 otherwise.
 * - Evidence locks once review starts: only a complaint still 'open' accepts
 *   photos → 409 with the real current status. Admins review what was actually
 *   filed; in_review / resolved / rejected / withdrawn rows are sealed.
 * - The file must be a real image: BOTH the declared mime type AND the magic
 *   bytes must say PNG / JPEG / WebP → 400 honest on mismatch. Size ≤ 2 MB →
 *   413 with the real size. At most 5 photos per complaint → 409 with the real
 *   count. Bytes are stored in SQLite (evidencePhotos.data).
 * - Every upload is audit-logged ('evidence_uploaded') with the authenticated
 *   buyer as actor — same pattern as the returns evidence API.
 */

/** Next's formData() yields web File objects; accept the standard class or a
 *  structurally identical Blob-with-name implementation. */
function isUploadFile(value: FormDataEntryValue | null): value is File {
  if (typeof File !== 'undefined' && value instanceof File) return true
  return (
    typeof value === 'object' &&
    value !== null &&
    'arrayBuffer' in value &&
    'size' in value &&
    'type' in value &&
    'name' in value
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'complaints-evidence-upload', 20, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data — send multipart/form-data with a "file" field containing an image.' },
        { status: 400 }
      )
    }

    const fileField = form.get('file')
    if (!isUploadFile(fileField)) {
      return NextResponse.json(
        { error: 'Missing "file" field — attach the evidence photo as a PNG, JPEG, or WebP image.' },
        { status: 400 }
      )
    }

    // Optional caption — must be a plain string field when present.
    const noteField = form.get('note')
    if (noteField !== null && typeof noteField !== 'string') {
      return NextResponse.json({ error: 'The "note" caption must be a plain text field.' }, { status: 400 })
    }
    const note = (noteField as string | null)?.trim() ?? ''
    if (note.length > EVIDENCE_NOTE_MAX_CHARS) {
      return NextResponse.json(
        { error: `The caption is ${note.length} characters — the limit is ${EVIDENCE_NOTE_MAX_CHARS}.` },
        { status: 400 }
      )
    }

    const complaint = await db.complaints.findUnique({ where: { id } })
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
    }
    // Ownership anchor: only the buyer who filed the complaint may attach evidence.
    if (complaint.buyerId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Not authorized — only the buyer who filed this complaint can attach evidence.' },
        { status: 403 }
      )
    }
    // Evidence locks once the review starts — honest 409 with the real status.
    if (complaint.status !== 'open') {
      return NextResponse.json(
        {
          error: `This complaint is currently '${complaint.status}' — evidence photos can only be attached while the complaint is open (before review starts).`,
        },
        { status: 409 }
      )
    }

    // Real count for the per-complaint cap — never a fabricated limit.
    const existingCount = await db.evidencePhotos.count({
      where: { ownerType: 'complaint', complaintId: id },
    })
    if (existingCount >= EVIDENCE_MAX_PHOTOS) {
      return NextResponse.json(
        {
          error: `This complaint already has ${existingCount} evidence photos — the maximum is ${EVIDENCE_MAX_PHOTOS}. Delete one to upload another.`,
        },
        { status: 409 }
      )
    }

    // Validate the declared type AND the real bytes (magic-byte sniff).
    const bytes = await fileField.arrayBuffer()
    const check = validateEvidenceFile({
      declaredMimeType: fileField.type,
      sizeBytes: bytes.byteLength,
      headBytes: new Uint8Array(bytes.slice(0, 16)),
    })
    if (!check.ok) {
      const status = check.kind === 'too_large' ? 413 : 400
      return NextResponse.json({ error: check.error }, { status })
    }

    const created = await db.evidencePhotos.create({
      data: {
        ownerType: 'complaint',
        returnRequestId: null,
        complaintId: id,
        buyerId: auth.user.id,
        mimeType: check.mimeType,
        sizeBytes: bytes.byteLength,
        data: Buffer.from(bytes),
        note: note.length > 0 ? note : null,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'evidence_uploaded',
        entityType: 'evidencePhotos',
        entityId: created.id,
        metadata: JSON.stringify({
          ownerType: 'complaint',
          complaintId: id,
          buyerId: auth.user.id,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          note: created.note,
        }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          mimeType: created.mimeType,
          sizeBytes: created.sizeBytes,
          note: created.note,
          createdAt: created.createdAt.toISOString(),
          url: `/api/attachments/${created.id}`,
        },
        message: 'Evidence photo attached to the complaint.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Complaint evidence upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
