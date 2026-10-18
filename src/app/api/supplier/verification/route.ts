import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET  /api/supplier/verification — REAL sellerVerificationDocuments rows for
 *                                 the signed-in supplier + honest progress =
 *                                 fraction of REQUIRED document types whose
 *                                 latest row is actually 'verified'.
 * POST /api/supplier/verification — REAL document upload (multipart): stores
 *                                 the file, creates a pending review row,
 *                                 audit-logged. Replaces the old POST that
 *                                 read formData and discarded it while
 *                                 claiming success.
 */

// Required document types (mirrors the Seller Verification Hub checklist)
const REQUIRED_DOC_TYPES = ['trade_license', 'tin_certificate', 'nid_front', 'bank_statement'] as const
// Optional types the model also accepts
const OPTIONAL_DOC_TYPES = ['nid_back', 'utility_bill'] as const
const ALL_DOC_TYPES = [...REQUIRED_DOC_TYPES, ...OPTIONAL_DOC_TYPES] as const

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

const docTypeSchema = z.enum(ALL_DOC_TYPES)

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-verification-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const documents = await db.sellerVerificationDocuments.findMany({
      where: { supplierId: profile.id },
      orderBy: { uploadedAt: 'desc' },
    })

    // Honest progress: only 'verified' rows count, and only for required types.
    const verifiedRequired = REQUIRED_DOC_TYPES.filter((type) =>
      documents.some((d) => d.documentType === type && d.status === 'verified')
    ).length
    const totalRequired = REQUIRED_DOC_TYPES.length

    return NextResponse.json({
      success: true,
      data: documents,
      progress: {
        verifiedRequired,
        totalRequired,
        percent: Math.min(100, Math.round((verifiedRequired / totalRequired) * 100)),
        requiredTypes: REQUIRED_DOC_TYPES,
      },
    })
  } catch (error) {
    console.error('Supplier verification GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'supplier-verification-post', 10, 5 * 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: 'Expected multipart/form-data with a file' }, { status: 400 })
    }

    const typeResult = docTypeSchema.safeParse(String(formData.get('type') || ''))
    if (!typeResult.success) {
      return NextResponse.json(
        { error: `Invalid document type. Accepted: ${ALL_DOC_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    const documentType = typeResult.data

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No document file provided' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB)`, sizeBytes: file.size },
        { status: 413 }
      )
    }
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, or WebP images are accepted' },
        { status: 400 }
      )
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const fileName = `${profile.id}-${documentType}-${crypto.randomUUID()}.${ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'verification')
    await mkdir(uploadDir, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(uploadDir, fileName), bytes)

    // A resubmission REPLACES the previous document of the same type (the old
    // row is removed so the checklist reflects the latest real submission).
    const row = await db.$transaction(async (tx) => {
      await tx.sellerVerificationDocuments.deleteMany({
        where: { supplierId: profile.id, documentType },
      })
      return tx.sellerVerificationDocuments.create({
        data: {
          supplierId: profile.id,
          documentType,
          fileName: file.name || fileName,
          fileUrl: `/uploads/verification/${fileName}`,
          fileSize: String(bytes.length),
          // Real review pipeline: every new document starts as 'pending'.
          status: 'pending',
        },
      })
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'verification_document_uploaded',
        entityType: 'sellerVerificationDocuments',
        entityId: row.id,
        metadata: JSON.stringify({
          supplierId: profile.id,
          documentType,
          fileName: row.fileName,
          sizeBytes: bytes.length,
        }),
      },
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Supplier verification POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
