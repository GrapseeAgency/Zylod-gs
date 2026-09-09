import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const MAX_SIZE = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * POST /api/uploads/kyc — upload a KYC document image (NID front/back, trade license).
 * Form-data: { file: File, kind: 'nid-front' | 'nid-back' | 'trade-license' }
 * Returns: { url: '/uploads/kyc/<kind>-<id>.<ext>' }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kind = String(formData.get('kind') || 'document')

    const VALID_KINDS = ['nid-front', 'nid-back', 'trade-license']
    if (!VALID_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'Invalid document kind' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, or WebP images are accepted' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const fileId = `${kind}-${crypto.randomUUID()}.${ext}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'kyc')
    await mkdir(uploadDir, { recursive: true })

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, fileId), bytes)

    return NextResponse.json({
      success: true,
      url: `/uploads/kyc/${fileId}`,
      kind,
      size: file.size,
    })
  } catch (error) {
    console.error('KYC upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
