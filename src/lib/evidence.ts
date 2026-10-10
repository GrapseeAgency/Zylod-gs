/**
 * Shared helpers for buyer evidence photos (Task 49-b).
 *
 * Evidence photos are buyer-provided review evidence attached to a return
 * request or a complaint. Bytes live in SQLite (evidencePhotos.data) and are
 * served ONLY to the uploading buyer and to admins — see
 * GET /api/attachments/[id].
 *
 * This module is deliberately dependency-light for the pure validation
 * helpers (magic-byte sniffing, size/limit constants) so they can be unit-run
 * in isolation with bun/node without touching the database. `db` is imported
 * lazily through the normal server module graph (listEvidence is only ever
 * called from server routes).
 */
import { db } from '@/lib/db'

/** Hard limit: a single evidence photo may be at most 2 MB. */
export const EVIDENCE_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

/** Hard limit: at most 5 evidence photos per return request / complaint. */
export const EVIDENCE_MAX_PHOTOS = 5

/** Optional caption ("note") is capped so review queues stay readable. */
export const EVIDENCE_NOTE_MAX_CHARS = 200

/** The only image mime types ever accepted as evidence. */
export const EVIDENCE_ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type EvidenceMime = (typeof EVIDENCE_ALLOWED_MIME_TYPES)[number]

export type EvidenceOwnerType = 'return' | 'complaint'

export function isAllowedEvidenceMime(mime: string): mime is EvidenceMime {
  return (EVIDENCE_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)
}

/**
 * Sniff the REAL image type from magic bytes — the declared Content-Type of an
 * upload is client-supplied and therefore never trusted on its own.
 *   PNG  → 89 50 4E 47 0D 0A 1A 0A                (\x89PNG\r\n\x1a\n)
 *   JPEG → FF D8 FF
 *   WEBP → 'RIFF' at bytes 0..3 and 'WEBP' at bytes 8..11
 * Returns the sniffed mime type, or null when the bytes match no allowed
 * signature (e.g. a GIF or a text file renamed to .png).
 */
export function detectImageMimeType(bytes: Uint8Array): EvidenceMime | null {
  // PNG: needs the full 8-byte signature.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  // JPEG: first three bytes FF D8 FF.
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  // WEBP: 'RIFF' container with 'WEBP' as the format tag at offset 8.
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export type EvidenceFileCheckResult =
  | { ok: true; mimeType: EvidenceMime }
  | { ok: false; kind: 'empty' | 'too_large' | 'bad_type' | 'not_image' | 'mismatch'; error: string }

export interface EvidenceFileCheckInput {
  /** The client-declared mime type (File.type) — validated, never trusted. */
  declaredMimeType: string
  /** Real byte size of the uploaded file. */
  sizeBytes: number
  /** At least the first 16 bytes of the file for signature sniffing. */
  headBytes: Uint8Array
}

/**
 * Full validation of one candidate evidence upload. Both gates must pass:
 *  1. the DECLARED type is in the allowlist, and
 *  2. the MAGIC BYTES really are that image format.
 * A renamed GIF/text file that declares image/png fails with an honest
 * 'mismatch'/'not_image' error — it is never silently accepted.
 */
export function validateEvidenceFile(input: EvidenceFileCheckInput): EvidenceFileCheckResult {
  const { declaredMimeType, sizeBytes, headBytes } = input

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, kind: 'empty', error: 'The selected file is empty.' }
  }
  if (sizeBytes > EVIDENCE_MAX_BYTES) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      kind: 'too_large',
      error: `The photo is ${mb} MB (${sizeBytes.toLocaleString('en-US')} bytes) — the limit is 2 MB.`,
    }
  }
  if (!isAllowedEvidenceMime(declaredMimeType)) {
    return {
      ok: false,
      kind: 'bad_type',
      error: `Unsupported file type "${declaredMimeType || 'unknown'}" — only PNG, JPEG, or WebP images are accepted as evidence.`,
    }
  }
  const sniffed = detectImageMimeType(headBytes)
  if (!sniffed) {
    return {
      ok: false,
      kind: 'not_image',
      error: 'This file is not a real PNG, JPEG, or WebP image — its content signature check failed.',
    }
  }
  if (sniffed !== declaredMimeType) {
    return {
      ok: false,
      kind: 'mismatch',
      error: `The file content is ${sniffed} but it was declared as ${declaredMimeType} — renamed or mislabeled files are rejected.`,
    }
  }
  return { ok: true, mimeType: sniffed }
}

/** Metadata for one stored evidence photo — NEVER includes the bytes. */
export interface EvidencePhotoMeta {
  id: string
  mimeType: string
  sizeBytes: number
  note: string | null
  createdAt: string
  /** The owner/admin-only attachment URL (served by GET /api/attachments/[id]). */
  url: string
}

/**
 * List the evidence photos of one owner row (a return request or a complaint),
 * oldest first. Only metadata is selected — the `data` blob column is never
 * loaded here. Callers are responsible for having already verified that the
 * requester may see this owner row (buyer-owned detail routes and admin routes
 * do this before calling).
 */
export async function listEvidence(
  ownerType: EvidenceOwnerType,
  ownerId: string
): Promise<EvidencePhotoMeta[]> {
  const rows = await db.evidencePhotos.findMany({
    where:
      ownerType === 'return'
        ? { ownerType, returnRequestId: ownerId }
        : { ownerType, complaintId: ownerId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      mimeType: true,
      sizeBytes: true,
      note: true,
      createdAt: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    url: `/api/attachments/${r.id}`,
  }))
}
