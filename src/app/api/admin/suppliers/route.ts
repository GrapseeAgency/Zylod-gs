import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { invalidateCacheKeys } from '@/lib/api-cache'

/**
 * GET /api/admin/suppliers — supplier KYC verification queue (ADMIN ONLY)
 * Query params: page, limit, status (pending|under_review|approved|rejected), search
 * Returns supplier profiles with their KYC submission data (empty string = not provided).
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-suppliers-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = request.nextUrl
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.verificationStatus = status
    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { phone: { contains: search } } },
      ]
    }

    const [suppliers, total] = await Promise.all([
      db.supplierProfiles.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          companyName: true,
          nidNumber: true,
          tradeLicenseNumber: true,
          tinNumber: true,
          bankAccountName: true,
          bankAccountNumber: true,
          bankName: true,
          branch: true,
          verificationStatus: true,
          rejectionReason: true,
          verifiedAt: true,
          ratingAvg: true,
          ratingCount: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              accountStatus: true,
              isEmailVerified: true,
              isPhoneVerified: true,
              createdAt: true,
            },
          },
          // Real KYC evidence (Task 52-c): the documents this supplier actually
          // uploaded, so admins approve/reject with eyes on the docs — the
          // same informed-moderation standard admin/products got in 51-b.
          verificationDocuments: {
            orderBy: { uploadedAt: 'desc' },
            select: {
              id: true,
              documentType: true,
              fileName: true,
              fileUrl: true,
              fileSize: true,
              status: true,
              rejectionReason: true,
              uploadedAt: true,
              reviewedAt: true,
            },
          },
          _count: { select: { products: true } },
        },
      }),
      db.supplierProfiles.count({ where }),
    ])

    const data = suppliers.map(s => ({
      id: s.id,
      userId: s.user.id,
      companyName: s.companyName,
      email: s.user.email,
      phone: s.user.phone,
      accountStatus: s.user.accountStatus,
      isEmailVerified: s.user.isEmailVerified,
      isPhoneVerified: s.user.isPhoneVerified,
      nidNumber: s.nidNumber,
      tradeLicenseNumber: s.tradeLicenseNumber,
      tinNumber: s.tinNumber,
      bankAccountName: s.bankAccountName,
      bankAccountNumber: s.bankAccountNumber,
      bankName: s.bankName,
      branch: s.branch,
      verificationStatus: s.verificationStatus,
      rejectionReason: s.rejectionReason,
      verifiedAt: s.verifiedAt,
      ratingAvg: s.ratingAvg,
      ratingCount: s.ratingCount,
      productCount: s._count.products,
      registeredAt: s.user.createdAt,
      kycSubmittedAt: s.createdAt,
      updatedAt: s.updatedAt,
      documents: s.verificationDocuments.map(d => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        fileSize: d.fileSize,
        status: d.status,
        rejectionReason: d.rejectionReason,
        uploadedAt: d.uploadedAt,
        reviewedAt: d.reviewedAt,
      })),
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Admin suppliers GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/suppliers — verify / reject / re-review a supplier's KYC (ADMIN ONLY)
 * Body: { supplierId, action: 'approve' | 'reject' | 'review', reason?: string }
 * - approve → verificationStatus 'approved'
 * - reject  → verificationStatus 'rejected' (reason REQUIRED, stored as rejectionReason)
 * - review  → verificationStatus 'under_review' (moved back into review)
 * All actions set verifiedBy to the authenticated admin and verifiedAt to now, audit-logged.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-suppliers-write', 30, 5 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json()
    const { supplierId, action, reason } = body

    if (!supplierId || !['approve', 'reject', 'review'].includes(action)) {
      return NextResponse.json({ error: 'supplierId and a valid action (approve | reject | review) are required' }, { status: 400 })
    }

    if (action === 'reject' && (!reason || String(reason).trim().length === 0)) {
      return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
    }

    const existing = await db.supplierProfiles.findUnique({ where: { id: supplierId } })
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const verificationStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'under_review'

    const supplier = await db.supplierProfiles.update({
      where: { id: supplierId },
      data: {
        verificationStatus,
        rejectionReason: action === 'reject' ? String(reason).trim() : null,
        verifiedBy: auth.user.id,
        verifiedAt: new Date(),
      },
    })

    // Task 68: KYC decisions change what the cached public suppliers list
    // serves — drop it before the audit row.
    invalidateCacheKeys('suppliers:list:')

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: `supplier_kyc_${action}`,
        entityType: 'supplierProfiles',
        entityId: supplierId,
        metadata: JSON.stringify({
          reason: action === 'reject' ? String(reason).trim() : null,
          previousStatus: existing.verificationStatus,
          newStatus: verificationStatus,
        }),
      },
    })

    // Real-time seller feed update (Task 51-b) — the KYC decision reaches the
    // owning supplier's room the moment it is persisted. Fire-and-forget: the
    // DB write above is the source of truth; the socket service being down
    // never fails this request. The room id is the REAL supplierProfiles.id
    // from the DB row — never a client-supplied value.
    await broadcastToRoom(`seller:${supplier.id}`, 'moderation:decision', {
      entityType: 'supplier',
      entityId: supplier.id,
      decision: verificationStatus,
      reason: action === 'reject' ? String(reason).trim() : null,
    })

    return NextResponse.json({ success: true, data: { id: supplier.id, verificationStatus: supplier.verificationStatus, verifiedAt: supplier.verifiedAt } })
  } catch (error) {
    console.error('Admin suppliers PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
