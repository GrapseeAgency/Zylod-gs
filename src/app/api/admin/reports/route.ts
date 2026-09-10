import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const reason = searchParams.get('reason') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (status !== 'all') {
      where.status = status
    }
    if (reason !== 'all') {
      where.reason = reason
    }

    const [reports, totalCount, pendingCount, actionTakenCount, dismissedCount] = await Promise.all([
      db.reportedUsers.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.reportedUsers.count(),
      db.reportedUsers.count({ where: { status: 'pending' } }),
      db.reportedUsers.count({ where: { status: 'action_taken' } }),
      db.reportedUsers.count({ where: { status: 'dismissed' } }),
    ])

    // Enrich reports with reporter and reported entity info
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const [reporter, reportedUser, reportedSupplier] = await Promise.all([
          db.users.findUnique({
            where: { id: r.reporterId },
            include: { buyerProfile: true, supplierProfile: true },
          }).catch(() => null),
          db.users.findUnique({
            where: { id: r.reportedUserId },
            include: { buyerProfile: true, supplierProfile: true },
          }).catch(() => null),
          db.supplierProfiles.findFirst({
            where: { OR: [{ id: r.reportedUserId }, { userId: r.reportedUserId }] },
            select: { id: true, companyName: true, verificationStatus: true, ratingAvg: true },
          }).catch(() => null),
        ])

        const reporterName = reporter?.buyerProfile?.fullName || reporter?.supplierProfile?.companyName || reporter?.email || 'Buyer #' + r.reporterId.slice(-6)
        const reportedName = reportedSupplier?.companyName || reportedUser?.buyerProfile?.fullName || reportedUser?.supplierProfile?.companyName || reportedUser?.email || 'User #' + r.reportedUserId.slice(-6)

        return {
          ...r,
          reporter: {
            id: r.reporterId,
            name: reporterName,
            email: reporter?.email,
            phone: reporter?.phone,
          },
          reportedEntity: reportedSupplier
            ? { id: reportedSupplier.id, name: reportedSupplier.companyName, type: 'SUPPLIER', status: reportedSupplier.verificationStatus, rating: reportedSupplier.ratingAvg }
            : reportedUser
            ? { id: reportedUser.id, name: reportedName, type: reportedUser.userType, status: reportedUser.accountStatus }
            : { id: r.reportedUserId, name: reportedName, type: 'UNKNOWN', status: 'unknown' },
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: enriched,
      metrics: {
        total: totalCount,
        pending: pendingCount,
        actionTaken: actionTakenCount,
        dismissed: dismissedCount,
      },
    })
  } catch (error) {
    console.error('Admin Reports GET error:', error)
    return NextResponse.json({ error: 'Failed to retrieve moderation reports' }, { status: 500 })
  }
}
