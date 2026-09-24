import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/admin/analytics — real platform analytics for the admin panel (ADMIN ONLY)
 *
 * Every number is a live Prisma aggregate/count on the real database.
 * No defaults other than honest 0 for known enum states; fields with no
 * backing module in the schema (returns / disputes) are returned as null
 * with a dataNotes explanation — never fabricated.
 *
 * NOTE on revenue: the schema stores payment rows with status
 * 'pending' | 'success' | 'failed' | 'refunded' — there is no 'paid' payment
 * status. A payment is "paid" in this platform when status = 'success'
 * (written by the HMAC webhook and the admin verification queue, both with
 * paidAt set). totalRevenue therefore sums payments.amount where
 * status = 'success' — filtering on the non-existent 'paid' status would
 * silently report ৳0 forever, which would be a false zero.
 *
 * NOTE on ordersByStatus: the orders table has no status column; order
 * status is derived from subOrder statuses using the exact same derivation
 * as the admin payments queue (/api/admin/orders) — 'processing' |
 * 'delivered' | 'cancelled' | 'shipped'.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  try {
    const now = new Date()

    const [
      totalUsers,
      usersByTypeRaw,
      usersByStatusRaw,
      totalProducts,
      productsApproved,
      productsUnapproved,
      totalCategories,
      totalOrders,
      ordersWithSubOrders,
      totalSubOrders,
      subOrdersByStatusRaw,
      totalPayments,
      paymentsByStatusRaw,
      revenueAgg,
      totalReviews,
      totalAuditLogs,
      totalWishlistItems,
      totalCoupons,
      totalSessions,
      activeSessions,
      suppliersPendingKyc,
      gmvAgg,
      recentAuditLogs,
      recentOrdersRaw,
    ] = await Promise.all([
      db.users.count(),
      db.users.groupBy({ by: ['userType'], _count: { _all: true } }),
      db.users.groupBy({ by: ['accountStatus'], _count: { _all: true } }),
      db.products.count(),
      db.products.count({ where: { isApproved: true } }),
      db.products.count({ where: { isApproved: false } }),
      db.categories.count(),
      db.orders.count(),
      // Real columns only (orderNumber/totalAmount/placedAt + subOrder statuses)
      // — order status is derived below with the platform's standard derivation.
      db.orders.findMany({
        select: { id: true, orderNumber: true, totalAmount: true, paymentStatus: true, placedAt: true, subOrders: { select: { status: true } } },
      }),
      db.subOrders.count(),
      db.subOrders.groupBy({ by: ['status'], _count: { _all: true } }),
      db.payments.count(),
      db.payments.groupBy({ by: ['status'], _count: { _all: true } }),
      db.payments.aggregate({ _sum: { amount: true }, where: { status: 'success' } }),
      db.reviews.count(),
      db.auditLogs.count(),
      db.wishlists.count(), // wishlists rows ARE the wishlist items (buyer × product)
      db.coupons.count(),
      db.sessions.count(),
      db.sessions.count({ where: { expiresAt: { gt: now } } }),
      db.supplierProfiles.count({ where: { verificationStatus: 'pending' } }),
      db.orders.aggregate({ _sum: { totalAmount: true } }),
      db.auditLogs.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, action: true, createdAt: true, actorId: true },
      }),
      db.orders.findMany({
        orderBy: { placedAt: 'desc' },
        take: 10,
        select: { id: true, orderNumber: true, totalAmount: true, paymentStatus: true, placedAt: true, subOrders: { select: { status: true } } },
      }),
    ])

    // ── Map raw groupBys into records keyed by the schema's real enum values.
    // Known enum states are seeded at 0 (an absent type/status genuinely IS 0);
    // any real key returned by groupBy is merged on top — nothing invented.
    const usersByType: Record<string, number> = { buyer: 0, supplier: 0, admin: 0 }
    for (const row of usersByTypeRaw) usersByType[row.userType] = row._count._all

    const usersByStatus: Record<string, number> = { active: 0, suspended: 0, banned: 0 }
    for (const row of usersByStatusRaw) usersByStatus[row.accountStatus] = row._count._all

    const subOrdersByStatus: Record<string, number> = {
      pending: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0,
    }
    for (const row of subOrdersByStatusRaw) subOrdersByStatus[row.status] = row._count._all

    const paymentsByStatus: Record<string, number> = { pending: 0, success: 0, failed: 0, refunded: 0 }
    for (const row of paymentsByStatusRaw) paymentsByStatus[row.status] = row._count._all

    // ── Derived order status — EXACT same derivation as /api/admin/orders
    const deriveOrderStatus = (subStatuses: string[]): string => {
      const statuses = subStatuses.map((s) => (s || 'pending').toLowerCase())
      return statuses.length === 0
        ? 'processing'
        : statuses.every((s) => s === 'delivered')
          ? 'delivered'
          : statuses.some((s) => s === 'cancelled')
            ? 'cancelled'
            : statuses.some((s) => s === 'shipped')
              ? 'shipped'
              : 'processing'
    }

    const ordersByStatus: Record<string, number> = { processing: 0, shipped: 0, delivered: 0, cancelled: 0 }
    for (const o of ordersWithSubOrders) {
      const st = deriveOrderStatus(o.subOrders.map((s) => s.status))
      ordersByStatus[st] = (ordersByStatus[st] || 0) + 1
    }

    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: deriveOrderStatus(o.subOrders.map((s) => s.status)),
      paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount,
      placedAt: o.placedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          totalUsers,
          usersByType,
          usersByStatus,
          totalProducts,
          productsByApproval: { approved: productsApproved, unapproved: productsUnapproved },
          totalCategories,
          totalOrders,
          ordersByStatus,
          totalSubOrders,
          subOrdersByStatus,
          totalPayments,
          paymentsByStatus,
          // Sum of payments.amount where status='success' — the platform's real
          // "paid" payment state (see file header note). 0 when none exist.
          totalRevenue: revenueAgg._sum.amount || 0,
          gmvSum: gmvAgg._sum.totalAmount || 0,
          totalReviews,
          totalAuditLogs,
          totalWishlistItems,
          totalCoupons,
          totalSessions,
          activeSessions,
          suppliersPendingKyc,
          // No returnRequests / disputes models exist in the Prisma schema yet —
          // reported honestly as null (never a fabricated 0).
          totalReturnRequests: null,
          totalDisputes: null,
        },
        recentAuditLogs: recentAuditLogs.map((l) => ({
          id: l.id,
          action: l.action,
          createdAt: l.createdAt.toISOString(),
          actorId: l.actorId,
        })),
        recentOrders,
        dataNotes: [
          'totalRevenue sums payments.amount where status = success (the schema has no paid payment status; success rows carry paidAt and are created only by the HMAC webhook or admin verification).',
          'totalReturnRequests and totalDisputes are null because no such tables exist in the database yet — the modules are not built.',
          'ordersByStatus is derived from subOrder statuses using the same rules as the admin payments queue (orders have no status column).',
        ],
      },
    })
  } catch (error) {
    console.error('Admin analytics GET error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
