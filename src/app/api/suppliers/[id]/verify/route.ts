import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/suppliers/[id]/verify — admin action to approve/reject a supplier
 * Body: { action: 'approve' | 'reject', reason?: string, verifiedBy: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, reason, verifiedBy } = body

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
    }
    if (!verifiedBy) {
      return NextResponse.json({ error: 'verifiedBy is required' }, { status: 400 })
    }

    const update = action === 'approve'
      ? { verificationStatus: 'approved', rejectionReason: null, verifiedBy, verifiedAt: new Date() }
      : { verificationStatus: 'rejected', rejectionReason: reason || 'Rejected by admin', verifiedBy, verifiedAt: new Date() }

    const supplier = await db.supplierProfiles.update({
      where: { id },
      data: update,
    })

    return NextResponse.json({ success: true, data: supplier })
  } catch (error) {
    console.error('Supplier verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
