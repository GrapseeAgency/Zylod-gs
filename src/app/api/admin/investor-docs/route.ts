import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { investorDocSchema, shapeInvestorDoc } from '@/lib/press-investor'

/**
 * Task 110: INVESTOR DOCUMENTS (admin side). Four investor pages read
 * investorDocuments (isPublished only) — zero writers since day one.
 * isPublished=false parks a document: the public rail refuses it while the
 * console keeps the row (the day-one draft semantics finally fed).
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-investor-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.investorDocuments.findMany({ orderBy: [{ fiscalYear: 'desc' }, { publishedAt: 'desc' }] })
    return NextResponse.json({ success: true, data: rows.map(shapeInvestorDoc) })
  } catch (error) {
    console.error('Admin investor docs GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-investor-write', 20, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const parsed = investorDocSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request body' }, { status: 400 })
    }
    const d = parsed.data
    const row = await db.investorDocuments.create({
      data: {
        docType: d.docType, title: d.title, fiscalYear: d.fiscalYear ?? null, fiscalQ: d.fiscalQ ?? null,
        fileUrl: d.fileUrl, summary: d.summary ?? null, isPublished: d.isPublished ?? true,
      },
    })
    await db.auditLogs.create({
      data: { actorId: auth.user.id, action: 'investor_doc_created', entityType: 'investorDocuments', entityId: row.id, metadata: JSON.stringify({ docType: row.docType, title: row.title, isPublished: row.isPublished }) },
    })
    await tapAllAdmins('press:changed', { action: 'doc-created', title: row.title, docType: row.docType })
    return NextResponse.json({ success: true, data: shapeInvestorDoc(row), message: 'Document added' }, { status: 201 })
  } catch (error) {
    console.error('Admin investor docs POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
