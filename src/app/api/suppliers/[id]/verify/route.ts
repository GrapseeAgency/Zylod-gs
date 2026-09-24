import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * POST /api/suppliers/[id]/verify — admin action to approve/reject a supplier (ADMIN ONLY)
 * Body: { action: 'approve' | 'reject', reason?: string }
 * - verifiedBy is ALWAYS the authenticated admin (never trusted from the client)
 * - reject requires a real reason — no invented fallback text
 * - every action is audit-logged
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { action, reason } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }
    if (action === 'reject' && (!reason || String(reason).trim().length === 0)) {
      return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
    }

    const existing = await db.supplierProfiles.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const update = action === 'approve'
      ? { verificationStatus: 'approved', rejectionReason: null, verifiedBy: auth.user.id, verifiedAt: new Date() }
      : { verificationStatus: 'rejected', rejectionReason: String(reason).trim(), verifiedBy: auth.user.id, verifiedAt: new Date() }

    const supplier = await db.supplierProfiles.update({
      where: { id },
      data: update,
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: `supplier_kyc_${action}`,
        entityType: 'supplierProfiles',
        entityId: id,
        metadata: JSON.stringify({
          reason: action === 'reject' ? String(reason).trim() : null,
          previousStatus: existing.verificationStatus,
          newStatus: supplier.verificationStatus,
        }),
      },
    })

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
