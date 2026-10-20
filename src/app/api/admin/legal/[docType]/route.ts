import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { LEGAL_DOC_LABELS, LEGAL_DOC_TYPES, legalDocSchema, shapeAdminLegal } from '@/lib/company-content'

/**
 * Task 106: legal documents — PUT (create-or-update) and DELETE per slot.
 *
 * docType is @unique, so the write path is an honest UPSERT keyed by the
 * slug: re-editing Terms must keep the SAME row id (no create+delete churn,
 * no audit-history laundering). The docType itself is never a free-text
 * field — only the nine slots the public pages actually fetch exist here;
 * any other slug is a 400 naming the allowed set (the console cannot mint
 * documents no page will ever serve).
 *
 * isActive=false parks a document: the public detail route already treats
 * an inactive row as the SAME 404 as a phantom one (draft semantics were
 * built into the reader from day one) — this writer finally gives that
 * behavior a source of truth.
 */

const docTypeParam = z.enum(LEGAL_DOC_TYPES)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-legal-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { docType: rawType } = await params
    const typeCheck = docTypeParam.safeParse(rawType)
    if (!typeCheck.success) {
      return NextResponse.json(
        { error: `Unknown document type "${rawType}". Allowed: ${LEGAL_DOC_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    const docType = typeCheck.data
    const parsed = legalDocSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }
    const d = parsed.data
    const effectiveDate = d.effectiveDate ? new Date(d.effectiveDate) : undefined

    const row = await db.legalDocuments.upsert({
      where: { docType },
      create: {
        docType,
        titleEn: d.titleEn,
        titleBn: d.titleBn ?? null,
        contentEn: d.contentEn,
        contentBn: d.contentBn ?? null,
        version: d.version,
        effectiveDate: effectiveDate ?? new Date(),
        isActive: d.isActive,
      },
      update: {
        titleEn: d.titleEn,
        titleBn: d.titleBn ?? null,
        contentEn: d.contentEn,
        contentBn: d.contentBn ?? null,
        version: d.version,
        ...(effectiveDate ? { effectiveDate } : {}),
        isActive: d.isActive,
      },
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'legal_document_saved',
        entityType: 'legalDocuments',
        entityId: row.id,
        metadata: JSON.stringify({ docType, version: row.version, isActive: row.isActive }),
      },
    })
    await tapAllAdmins('legal:changed', {
      action: 'saved',
      id: row.id,
      docType,
      label: LEGAL_DOC_LABELS[docType],
      version: row.version,
      isActive: row.isActive,
    })
    return NextResponse.json({ success: true, data: shapeAdminLegal(row), message: 'Document saved' }, { status: 200 })
  } catch (error) {
    console.error('Admin legal PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docType: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-legal-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { docType: rawType } = await params
    const typeCheck = docTypeParam.safeParse(rawType)
    if (!typeCheck.success) {
      return NextResponse.json(
        { error: `Unknown document type "${rawType}". Allowed: ${LEGAL_DOC_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    const docType = typeCheck.data
    const existing = await db.legalDocuments.findUnique({ where: { docType } })
    if (!existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    await db.legalDocuments.delete({ where: { docType } })
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'legal_document_deleted',
        entityType: 'legalDocuments',
        entityId: existing.id,
        metadata: JSON.stringify({ docType, version: existing.version }),
      },
    })
    await tapAllAdmins('legal:changed', {
      action: 'deleted',
      id: existing.id,
      docType,
      label: LEGAL_DOC_LABELS[docType],
    })
    return NextResponse.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    console.error('Admin legal DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
