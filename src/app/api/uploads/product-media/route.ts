import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/uploads/product-media — REAL product image/video upload (Task 50-a).
 * multipart/form-data field: `file` (supplier or admin session required).
 *
 * Validation (fail closed, honest errors):
 *  - Declared type allowlist: png/jpeg/webp (≤5MB) and mp4/webm (≤50MB).
 *  - MAGIC-BYTE sniffing: the declared Content-Type is client-supplied and
 *    never trusted — a renamed GIF/text file that declares image/png is
 *    rejected with 400 declared-vs-sniffed mismatch.
 *  - Oversize returns a real 413 carrying the actual byte size.
 *
 * Storage: disk, following the /api/uploads/kyc convention —
 *   default dir <cwd>/public/uploads/products/ with opaque random filenames
 *   + the real extension; override the base dir with PRODUCT_MEDIA_UPLOAD_DIR
 *   (env-driven, Railway-deployable: point it at a mounted volume and the
 *   files survive deploys — the container FS alone is ephemeral).
 * Returned `url` is the publicly served path (/uploads/products/<file>).
 */

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

/**
 * Sniff the REAL content type from magic bytes. Returns the sniffed mime type
 * or null when the bytes match no allowed signature.
 *   PNG  → 89 50 4E 47 0D 0A 1A 0A
 *   JPEG → FF D8 FF
 *   WEBP → 'RIFF' … 'WEBP' (offset 8)
 *   MP4  → size-prefixed box: bytes 4..7 === 'ftyp'
 *   WEBM → EBML header 1A 45 DF A3
 */
function sniffMediaType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50   // 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 8) {
    const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
    if (tag === 'ftyp') return 'video/mp4'
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  ) {
    return 'video/webm'
  }
  return null
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'product-media-upload', 30, 5 * 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "multipart field 'file' is required" },
        { status: 400 }
      )
    }

    const declared = file.type
    const sizeBytes = file.size

    if (!(IMAGE_TYPES as readonly string[]).includes(declared) && !(VIDEO_TYPES as readonly string[]).includes(declared)) {
      return NextResponse.json(
        { error: `Unsupported file type "${declared || 'unknown'}" — allowed: PNG, JPEG, WebP images and MP4, WebM videos` },
        { status: 400 }
      )
    }

    const isVideo = (VIDEO_TYPES as readonly string[]).includes(declared)
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (sizeBytes > maxBytes) {
      return NextResponse.json(
        {
          error: `File too large: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB (${sizeBytes.toLocaleString('en-US')} bytes) — the limit is ${maxBytes / 1024 / 1024}MB for this type`,
        },
        { status: 413 }
      )
    }

    // Magic-byte gate — declared type must agree with the real bytes.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const sniffed = sniffMediaType(head)
    if (!sniffed) {
      return NextResponse.json(
        { error: 'This file is not a real PNG, JPEG, WebP, MP4, or WebM — its content signature check failed' },
        { status: 400 }
      )
    }
    if (sniffed !== declared) {
      return NextResponse.json(
        { error: `File content is ${sniffed} but it was declared as ${declared} — renamed or mislabeled files are rejected` },
        { status: 400 }
      )
    }

    // Opaque unique filename + the REAL extension (same convention as /api/uploads/kyc).
    const ext = EXT_BY_TYPE[declared]
    const filename = `${crypto.randomUUID()}.${ext}`

    // Task 113 fix: videos live in /uploads/videos/ — the attach route
    // (POST /api/supplier/products/[id]/videos) validates that space and its
    // delete unlinks from it, so a video written to /uploads/products/ could
    // never be attached (the drill caught the seam). Images stay in products/.
    const uploadDir =
      process.env.PRODUCT_MEDIA_UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads', isVideo ? 'videos' : 'products')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

    return NextResponse.json({
      success: true,
      url: `/uploads/${isVideo ? 'videos' : 'products'}/${filename}`,
      type: isVideo ? 'video' : 'image',
      sizeBytes,
    })
  } catch (error) {
    console.error('Product media upload error:', error)
    return NextResponse.json({ error: 'Upload failed — please retry' }, { status: 500 })
  }
}
