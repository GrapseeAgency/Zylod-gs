import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { tapAllAdmins } from '@/lib/warehouses'
import { LEGAL_DOC_LABELS, LEGAL_DOC_TYPES, shapeAdminLegal } from '@/lib/company-content'

/**
 * Task 106: THE COMPANY CONTENT RAIL (legal documents, admin side).
 * The nine public legal pages have fetched /api/legal/<docType> since day
 * one; nothing could write a row, so every page showed its honest
 * "finalizing" state forever. This is the writer.
 *
 * GET serves ALL nine slots with presence status — the console must be able
 * to show which documents are published, which are parked (inactive), and
 * which were never written. House contract: requireUserType 401-first,
 * rate limit, no PII in the payload, audits + admin-room taps on writes.
 */

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.authenticated ? 'Forbidden' : 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-legal-list', 60, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const rows = await db.legalDocuments.findMany({ orderBy: { updatedAt: 'desc' } })
    const byType = new Map(rows.map((r) => [r.docType, r]))
    const slots = LEGAL_DOC_TYPES.map((docType) => {
      const row = byType.get(docType)
      return {
        docType,
        label: LEGAL_DOC_LABELS[docType],
        filled: Boolean(row),
        document: row ? shapeAdminLegal(row) : null,
      }
    })
    const stats = {
      total: slots.length,
      published: rows.filter((r) => r.isActive).length,
      parked: rows.filter((r) => !r.isActive).length,
      empty: slots.length - rows.length,
    }
    return NextResponse.json({ success: true, data: slots, stats })
  } catch (error) {
    console.error('Admin legal GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
