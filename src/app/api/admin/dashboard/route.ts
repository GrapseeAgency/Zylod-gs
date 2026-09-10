import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/admin/dashboard
 * Real aggregated platform statistics for the admin dashboard.
 * Auth: admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Admin access required' }, { status: 403 })
  }

  try {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Run all independent queries in parallel
    const [
      totalUsers,
      totalSuppliers,
      totalOrders,
      totalProducts,
      unverifiedSuppliers,
      pendingProducts,
      revenueAgg,
      recentUsers,
      recentOrders,
      // Growth data — last 6 months, grouped
      usersByMonth,
      ordersByMonth,
      revenueByMonth,
      // Last 7 days for charts
      last7DaysUsers,
      last7DaysOrders,
      last7DaysRevenue,
      // Category breakdown
      categoriesWithCounts,
      // Top regions (buyer addresses grouped by city)
      topRegionsRaw,
    ] = await Promise.all([
      db.users.count(),
      db.supplierProfiles.count(),
      db.orders.count(),
      db.products.count(),
      db.supplierProfiles.count({ where: { verificationStatus: 'pending' } }),
      db.products.count({ where: { isApproved: false } }),
      db.orders.aggregate({ _sum: { totalAmount: true } }),
      db.users.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, phone: true, userType: true, createdAt: true },
      }),
      db.orders.findMany({
        take: 8,
        orderBy: { placedAt: 'desc' },
        select: { id: true, orderNumber: true, totalAmount: true, paymentStatus: true, placedAt: true },
      }),
      // users by month (last 6)
      db.users.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: sixMonthsAgo } },
        _count: { _all: true },
      }),
      db.orders.groupBy({
        by: ['placedAt'],
        where: { placedAt: { gte: sixMonthsAgo } },
        _count: { _all: true },
      }),
      db.orders.groupBy({
        by: ['placedAt'],
        where: { placedAt: { gte: sixMonthsAgo } },
        _sum: { totalAmount: true },
      }),
      // 7-day charts
      db.users.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
      }),
      db.orders.findMany({
        where: { placedAt: { gte: sevenDaysAgo } },
        select: { placedAt: true },
      }),
      db.orders.findMany({
        where: { placedAt: { gte: sevenDaysAgo } },
        select: { placedAt: true, totalAmount: true },
      }),
      // Category counts
      db.categories.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      }),
      // Top regions — group buyer addresses by city
      db.addresses.groupBy({
        by: ['city'],
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
    ])

    // Build month labels for growth charts
    const monthLabels: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthLabels.push(d.toLocaleString('en-US', { month: 'short' }))
    }

    // Tally users/orders/revenue per month
    const usersByMonthTally = new Array(6).fill(0)
    const ordersByMonthTally = new Array(6).fill(0)
    const revenueByMonthTally = new Array(6).fill(0)

    for (const u of usersByMonth) {
      const mIdx = (u.createdAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (u.createdAt.getMonth() - sixMonthsAgo.getMonth())
      if (mIdx >= 0 && mIdx < 6) usersByMonthTally[mIdx] += u._count._all
    }
    for (const o of ordersByMonth) {
      const mIdx = (o.placedAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (o.placedAt.getMonth() - sixMonthsAgo.getMonth())
      if (mIdx >= 0 && mIdx < 6) ordersByMonthTally[mIdx] += o._count._all
    }
    for (const r of revenueByMonth) {
      const mIdx = (r.placedAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (r.placedAt.getMonth() - sixMonthsAgo.getMonth())
      if (mIdx >= 0 && mIdx < 6) revenueByMonthTally[mIdx] += r._sum.totalAmount || 0
    }

    // 7-day chart data
    const dayLabels: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dayLabels.push(d.toLocaleString('en-US', { weekday: 'short' }))
    }
    const reg7 = new Array(7).fill(0)
    const ord7 = new Array(7).fill(0)
    const rev7 = new Array(7).fill(0)
    for (const u of last7DaysUsers) {
      const dayDiff = Math.floor((now.getTime() - u.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      const idx = 6 - dayDiff
      if (idx >= 0 && idx < 7) reg7[idx]++
    }
    for (const o of last7DaysOrders) {
      const dayDiff = Math.floor((now.getTime() - o.placedAt.getTime()) / (24 * 60 * 60 * 1000))
      const idx = 6 - dayDiff
      if (idx >= 0 && idx < 7) ord7[idx]++
    }
    for (const o of last7DaysRevenue) {
      const dayDiff = Math.floor((now.getTime() - o.placedAt.getTime()) / (24 * 60 * 60 * 1000))
      const idx = 6 - dayDiff
      if (idx >= 0 && idx < 7) rev7[idx] += o.totalAmount
    }

    // Recent activity feed (combine users + orders)
    const recentActivity = [
      ...recentUsers.slice(0, 4).map((u) => ({
        type: 'registration',
        text: `New ${u.userType} registered: ${u.email || u.phone || u.id}`,
        time: u.createdAt.toISOString(),
      })),
      ...recentOrders.slice(0, 4).map((o) => ({
        type: 'order',
        text: `Order ${o.orderNumber} placed — ৳${o.totalAmount.toLocaleString()}`,
        time: o.placedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10)

    // Category breakdown
    const categoryBreakdown = categoriesWithCounts
      .filter((c) => c._count.products > 0)
      .slice(0, 6)
      .map((c) => ({
        category: c.name,
        products: c._count.products,
      }))

    // Top regions
    const totalAddresses = topRegionsRaw.reduce((sum, r) => sum + r._count._all, 0) || 1
    const topRegions = topRegionsRaw.map((r) => ({
      region: r.city,
      users: r._count._all,
      percentage: Math.round((r._count._all / totalAddresses) * 100),
    }))

    return NextResponse.json({
      success: true,
      data: {
        platformOverview: {
          totalUsers,
          activeSuppliers: totalSuppliers,
          totalOrders,
          totalRevenueBDT: revenueAgg._sum.totalAmount || 0,
          avgOrderValue: totalOrders > 0 ? (revenueAgg._sum.totalAmount || 0) / totalOrders : 0,
          totalProducts,
          pendingApprovalsCount: unverifiedSuppliers + pendingProducts,
          systemStatus: 'Optimal',
        },
        pendingApprovals: {
          supplierVerification: unverifiedSuppliers,
          productApproval: pendingProducts,
          total: unverifiedSuppliers + pendingProducts,
        },
        recentActivity,
        recentUsers: recentUsers.map((u) => ({
          id: u.id,
          label: u.email || u.phone || u.id,
          userType: u.userType,
          createdAt: u.createdAt.toISOString(),
        })),
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          totalAmount: o.totalAmount,
          status: o.paymentStatus,
          placedAt: o.placedAt.toISOString(),
        })),
        growthData: monthLabels.map((month, i) => ({
          month,
          registrations: usersByMonthTally[i],
          orders: ordersByMonthTally[i],
          revenue: Math.round(revenueByMonthTally[i]),
        })),
        registrationsChart: dayLabels.map((day, i) => ({ day, value: reg7[i] })),
        orderVolumeChart: dayLabels.map((day, i) => ({ day, value: ord7[i] })),
        revenueChart: dayLabels.map((day, i) => ({ day, value: Math.round(rev7[i]) })),
        categoryBreakdown,
        topRegions,
      },
    })
  } catch (error) {
    console.error('Admin dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}