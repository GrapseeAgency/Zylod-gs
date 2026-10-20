import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { investorDocPatchSchema, shapeInvestorDoc } from '@/lib/press-investor'

/** Task 110: investor documents — PATCH (arrived keys only) and DELETE. */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-investor-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.investorDocuments.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    const parsed = investorDocPatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.investorDocuments.update({
      where: { id },
      data: {
        ...(d.docType !== undefined ? { docType: d.docType } : {}),
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.fiscalYear !== undefined ? { fiscalYear: d.fiscalYear } : {}),
        ...(d.fiscalQ !== undefined ? { fiscalQ: d.fiscalQ } : {}),
        ...(d.fileUrl !== undefined ? { fileUrl: d.fileUrl } : {}),
        ...(d.summary !== undefined ? { summary: d.summary } : {}),
        ...(d.isPublished !== undefined ? { isPublished: d.isPublished } : {}),
      },
    })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'investor_doc_updated', entityType: 'investorDocuments', entityId: row.id, metadata: JSON.stringify({ before: { title: existing.title, isPublished: existing.isPublished }, after: { title: row.title, isPublished: row.isPublished } }) },
    })
    await tapAllAdmins('press:changed', { action: 'doc-updated', title: row.title })
    return NextResponse.json({ success: true, data: shapeInvestorDoc(row), message: 'Document updated' })
  } catch (error) {
    console.error('Admin investor docs PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-investor-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { id } = await params
    const existing = await db.investorDocuments.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    await db.investorDocuments.delete({ where: { id } })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'investor_doc_deleted', entityType: 'investorDocuments', entityId: existing.id, metadata: JSON.stringify({ title: existing.title }) },
    })
    await tapAllAdmins('press:changed', { action: 'doc-deleted', title: existing.title })
    return NextResponse.json({ success: true, message: 'Document deleted' })
  } catch (error) {
    console.error('Admin investor docs DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
