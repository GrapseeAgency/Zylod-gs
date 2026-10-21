import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET  /api/supplier/bulk-upload — REAL sellerBulkUploads rows for the signed-in
 *                              supplier (honest empty when none).
 * POST /api/supplier/bulk-upload — REAL minimal CSV processor.
 *
 * CSV contract: header line `name,categoryId,unit,moq,basePrice,stockQuantity`
 * (exactly these columns), one product per row, max 100 rows per request.
 * Every row is strictly validated (Zod + real categoryId existence check);
 * valid rows become products with isApproved=false (moderation queue) for MY
 * supplierProfile inside one transaction. A sellerBulkUploads row records the
 * REAL total/success/failure counts and the per-row errors — 422 when every
 * row failed. There is NO fake success path.
 */

const MAX_ROWS = 100
const EXPECTED_HEADER = ['name', 'categoryid', 'unit', 'moq', 'baseprice', 'stockquantity']
const UNITS = ['pcs', 'dozen', 'kg', 'carton', 'box', 'set'] as const

const csvRowSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  categoryId: z.string().trim().min(1, 'categoryId is required'),
  unit: z.enum(UNITS, { message: 'unit must be one of: pcs, dozen, kg, carton, box, set' }),
  moq: z.coerce.number().positive('moq must be greater than 0'),
  basePrice: z.coerce.number().min(0, 'basePrice cannot be negative'),
  stockQuantity: z.coerce.number().min(0, 'stockQuantity cannot be negative'),
})

interface RowError {
  row: number
  error: string
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'product'
}

function parseCsv(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return null
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()))
  return { header, rows }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-bulk-upload-get', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    const uploads = await db.sellerBulkUploads.findMany({
      where: { supplierId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      success: true,
      data: uploads.map((u) => ({
        id: u.id,
        fileName: u.fileName,
        status: u.status,
        totalRows: u.totalRows,
        successCount: u.successCount,
        failureCount: u.failureCount,
        errors: u.errors ? JSON.parse(u.errors) : [],
        createdAt: u.createdAt,
      })),
    })
  } catch (error) {
    console.error('Supplier bulk-upload GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-bulk-upload-post', 5, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    // Accept multipart (file) or JSON ({ csv, fileName? }) — both real paths.
    let csvText: string | null = null
    let fileName = 'upload.csv'
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData().catch(() => null)
      const file = formData?.get('file')
      if (file instanceof File && file.size > 0) {
        csvText = await file.text()
        fileName = file.name || fileName
      }
    } else {
      const body = await request.json().catch(() => null)
      if (body && typeof body.csv === 'string' && body.csv.trim().length > 0) {
        csvText = body.csv
        if (typeof body.fileName === 'string' && body.fileName.trim()) fileName = body.fileName
      }
    }

    if (csvText == null) {
      return NextResponse.json(
        { error: 'Provide a CSV file (multipart field "file") or JSON { csv }' },
        { status: 400 }
      )
    }

    const parsed = parseCsv(csvText)
    if (!parsed) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
    }

    // Strict header check — the documented contract, nothing else accepted.
    const headerOk =
      parsed.header.length === EXPECTED_HEADER.length &&
      EXPECTED_HEADER.every((col, idx) => parsed.header[idx] === col)
    if (!headerOk) {
      return NextResponse.json(
        { error: `CSV header must be exactly: ${EXPECTED_HEADER.join(',')}` },
        { status: 400 }
      )
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'CSV contains no data rows' }, { status: 400 })
    }
    if (parsed.rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Too many rows — the limit is ${MAX_ROWS} rows per request`, receivedRows: parsed.rows.length },
        { status: 400 }
      )
    }

    // ─── Strict per-row validation ───
    const validRows: Array<{ data: z.infer<typeof csvRowSchema>; rowIndex: number }> = []
    const rowErrors: RowError[] = []

    parsed.rows.forEach((cells, idx) => {
      const rowNumber = idx + 2 // +1 header, +1 for 1-based numbering
      if (cells.length !== EXPECTED_HEADER.length) {
        rowErrors.push({ row: rowNumber, error: `Expected ${EXPECTED_HEADER.length} columns, found ${cells.length}` })
        return
      }
      const result = csvRowSchema.safeParse({
        name: cells[0],
        categoryId: cells[1],
        unit: cells[2],
        moq: cells[3],
        basePrice: cells[4],
        stockQuantity: cells[5],
      })
      if (!result.success) {
        rowErrors.push({ row: rowNumber, error: result.error.issues[0]?.message || 'Invalid row' })
        return
      }
      validRows.push({ data: result.data, rowIndex: rowNumber })
    })

    // Real category existence check — rows pointing at unknown categories fail.
    const requestedCategoryIds = Array.from(new Set(validRows.map((r) => r.data.categoryId)))
    const existingCategories = requestedCategoryIds.length
      ? await db.categories.findMany({ where: { id: { in: requestedCategoryIds } }, select: { id: true } })
      : []
    const categorySet = new Set(existingCategories.map((c) => c.id))
    const finalRows = validRows.filter((r) => {
      if (!categorySet.has(r.data.categoryId)) {
        rowErrors.push({ row: r.rowIndex, error: `categoryId "${r.data.categoryId}" does not exist` })
        return false
      }
      return true
    })

    const totalRows = parsed.rows.length
    const failureCount = rowErrors.length
    const successCount = totalRows - failureCount

    const slugStamp = Date.now().toString(36)

    // All rows invalid → nothing is created; still record the real failed run.
    if (finalRows.length === 0) {
      const failedUpload = await db.sellerBulkUploads.create({
        data: {
          supplierId: profile.id,
          fileName,
          status: 'failed',
          totalRows,
          successCount: 0,
          failureCount,
          errors: JSON.stringify(rowErrors),
        },
      })
      return NextResponse.json(
        {
          error: 'All rows failed validation — no products were created',
          data: { uploadId: failedUpload.id, totalRows, successCount: 0, failureCount, errors: rowErrors },
        },
        { status: 422 }
      )
    }

    // Create the valid products + the upload record atomically.
    const { upload, createdCount } = await db.$transaction(async (tx) => {
      let count = 0
      for (const row of finalRows) {
        await tx.products.create({
          data: {
            supplierId: profile.id,
            categoryId: row.data.categoryId,
            name: row.data.name,
            slug: `${slugify(row.data.name)}-${slugStamp}-${row.rowIndex}`,
            description: '',
            unit: row.data.unit,
            moq: row.data.moq,
            basePrice: row.data.basePrice,
            currency: 'BDT',
            stockQuantity: row.data.stockQuantity,
            // Bulk-created products ALWAYS await moderation — they are not
            // buyer-visible until an admin approves them.
            isActive: true,
            isApproved: false,
          },
        })
        count++
      }

      const upload = await tx.sellerBulkUploads.create({
        data: {
          supplierId: profile.id,
          fileName,
          // 'completed' = the run finished processing (partial failures are
          // recorded honestly in failureCount + errors).
          status: 'completed',
          totalRows,
          successCount,
          failureCount,
          errors: rowErrors.length > 0 ? JSON.stringify(rowErrors) : null,
        },
      })

      return { upload, createdCount: count }
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'seller_bulk_upload_processed',
        entityType: 'sellerBulkUploads',
        entityId: upload.id,
        metadata: JSON.stringify({ supplierId: profile.id, fileName, totalRows, successCount, failureCount }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          uploadId: upload.id,
          totalRows,
          createdCount,
          successCount,
          failureCount,
          errors: rowErrors,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Supplier bulk-upload POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
