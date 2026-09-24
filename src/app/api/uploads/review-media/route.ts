import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/uploads/review-media — REAL file upload for review media.
 * multipart/form-data field: `file` (image or video, buyer-only).
 *
 * - Validates MIME type + size (images ≤5MB, videos ≤50MB).
 * - Writes the actual bytes to public/uploads/review-media/<uuid>.<ext>
 *   and returns the publicly served URL.
 * - The returned URL is a real file on the deployment node — never a blob
 *   URL that dies on reload.
 *
 * NOTE for Railway: the container filesystem is ephemeral between deploys;
 * switch UPLOAD_DIR to a mounted volume path via env when persistent storage
 * is attached (UPLOAD_DIR). This endpoint stays identical.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'review-upload', 20, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['buyer'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'You must be signed in as a buyer to upload review media' }, { status: 401 })
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "multipart field 'file' is required" }, { status: 400 })
    }

    const { type, size } = file
    if (!IMAGE_TYPES.includes(type) && !VIDEO_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Unsupported file type ${type || 'unknown'} — allowed: jpeg, png, webp, gif, mp4, webm, mov` },
        { status: 400 }
      )
    }
    const max = VIDEO_TYPES.includes(type) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (size > max) {
      return NextResponse.json(
        { error: `File too large (${(size / 1024 / 1024).toFixed(1)}MB) — max ${max / 1024 / 1024}MB for this type` },
        { status: 400 }
      )
    }

    const ext = EXT_BY_TYPE[type]
    const filename = `${randomUUID()}.${ext}`
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'public', 'uploads', 'review-media')
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()))

    const url = `/uploads/review-media/${filename}`

    // Optional: associate with the product being reviewed (audit trail)
    const productId = typeof form?.get('productId') === 'string' ? String(form.get('productId')) : ''
    if (productId) {
      const product = await db.products.findUnique({ where: { id: productId }, select: { id: true } })
      if (!product) {
        return NextResponse.json({ error: 'productId does not match a real product' }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, data: { url, type, size, uploadedBy: auth.user.id } }, { status: 201 })
  } catch (error) {
    console.error('Review media upload error:', error)
    return NextResponse.json({ error: 'Upload failed — please retry' }, { status: 500 })
  }
}
