import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { sendNotification } from '@/lib/notifications'
import { invalidateCacheKeys } from '@/lib/api-cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  try {
    const { id } = await params
    const report = await db.reportedUsers.findUnique({
      where: { id },
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const [reporter, reportedUser, reportedSupplier, order] = await Promise.all([
      db.users.findUnique({
        where: { id: report.reporterId },
        include: { buyerProfile: true, supplierProfile: true },
      }).catch(() => null),
      db.users.findUnique({
        where: { id: report.reportedUserId },
        include: { buyerProfile: true, supplierProfile: true },
      }).catch(() => null),
      db.supplierProfiles.findFirst({
        where: { OR: [{ id: report.reportedUserId }, { userId: report.reportedUserId }] },
        include: {
          warehouseAddress: true,
          _count: { select: { products: true } },
        },
      }).catch(() => null),
      report.relatedOrderId
        ? db.orders.findUnique({
            where: { id: report.relatedOrderId },
            select: { id: true, orderNumber: true, totalAmount: true, paymentStatus: true, createdAt: true },
          }).catch(() => null)
        : null,
    ])

    // Count previous reports against this same reported user/supplier
    const previousReportsCount = await db.reportedUsers.count({
      where: {
        reportedUserId: report.reportedUserId,
        id: { not: report.id },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        reporter: reporter ? {
          id: reporter.id,
          name: reporter.buyerProfile?.fullName || reporter.supplierProfile?.companyName || reporter.email,
          email: reporter.email,
          phone: reporter.phone,
          role: reporter.userType,
        } : null,
        reportedUser: reportedUser ? {
          id: reportedUser.id,
          name: reportedUser.buyerProfile?.fullName || reportedUser.supplierProfile?.companyName || reportedUser.email,
          email: reportedUser.email,
          phone: reportedUser.phone,
          role: reportedUser.userType,
        } : null,
        reportedSupplier,
        order,
        previousReportsCount,
      },
    })
  } catch (error) {
    console.error('Admin Single Report GET error:', error)
    return NextResponse.json({ error: 'Failed to retrieve report' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'admin-reports-write', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params
    const body = await request.json()
    const { status, actionType, adminNotes } = body

    const existing = await db.reportedUsers.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Update report
    const updated = await db.reportedUsers.update({
      where: { id },
      data: {
        status: status || 'action_taken',
        adminNotes: adminNotes ? `${adminNotes} [Action: ${actionType || 'none'}]` : existing.adminNotes,
      },
    })

    // If severe action like suspend seller or ban account, apply DB side-effects
    if (actionType === 'suspend_store') {
      await db.supplierProfiles.updateMany({
        where: { OR: [{ id: existing.reportedUserId }, { userId: existing.reportedUserId }] },
        data: { verificationStatus: 'rejected', rejectionReason: `Account suspended due to policy report #${id}: ${adminNotes || 'Fraud/Breach'}` },
      })
      // Task 68: a store suspension just changed the supplier's public KYC
      // status — drop the cached suppliers list.
      invalidateCacheKeys('suppliers:list:')
    } else if (actionType === 'freeze_escrow' && existing.relatedOrderId) {
      // Task 140 honesty fix: a freeze is a HOLD, not a refund — the old code
      // flipped paymentStatus to 'refunded', fabricating the financial claim
      // that money went back to the buyer when nothing moved (the money
      // doctrine: paymentStatus transitions only via verified webhook or the
      // admin verify rail, which write the real ledger). A hold is recorded
      // in the audit row instead; no paymentStatus mutation happens here.
    }

    // Task 140: the verdict — and every side-effect it caused — is now a
    // REAL auditLogs row. The old response message claimed the action was
    // 'logged' while this route wrote nothing: a fake claim about evidence.
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'trust_report_verdict',
        entityType: 'reportedUsers',
        entityId: id,
        metadata: JSON.stringify({
          before: { status: existing.status, adminNotes: existing.adminNotes },
          after: { status: updated.status },
          actionType: actionType || 'none',
          sideEffects: {
            storeSuspended: actionType === 'suspend_store',
            escrowHoldRecorded: actionType === 'freeze_escrow' && Boolean(existing.relatedOrderId),
          },
          adminNotes: adminNotes || null,
        }),
      },
    }).catch(() => { /* the verdict itself is committed; audit is evidence, not a gate */ })

    // Send real resolution notification to reporter
    await sendNotification({
      userId: existing.reporterId,
      type: 'system',
      title: `Update on Report #${id.slice(-6).toUpperCase()}`,
      body: `Trust & Safety has reviewed your complaint regarding "${existing.reason}" and taken appropriate enforcement action. Thank you for protecting the Zylod wholesale marketplace.`,
      relatedEntityId: id,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Moderation action "${actionType || status}" successfully executed and logged.`,
    })
  } catch (error) {
    console.error('Admin Report PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update moderation report' }, { status: 500 })
  }
}
