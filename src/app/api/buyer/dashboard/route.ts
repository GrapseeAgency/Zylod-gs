import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/buyer/dashboard
 * Real stats, recent orders, spending chart, favorite suppliers, wishlist items,
 * recent searches, and coupon savings for the buyer dashboard.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const [
      ordersCount,
      totalSpentAgg,
      activeOrdersCount,
      recentOrders,
      wishlistCount,
      wishlistItems,
      favoriteSuppliersRaw,
      recentSearches,
      spendingByMonth,
      couponSavings,
    ] = await Promise.all([
      db.orders.count({ where: { buyerId: userId } }),
      db.orders.aggregate({ where: { buyerId: userId }, _sum: { totalAmount: true } }),
      db.orders.count({ where: { buyerId: userId, paymentStatus: 'unpaid' } }),
      db.orders.findMany({
        where: { buyerId: userId },
        orderBy: { placedAt: 'desc' },
        take: 8,
        include: {
          subOrders: {
            include: {
              items: {
                take: 1,
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      basePrice: true,
                      supplier: { select: { id: true, companyName: true } },
                      images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { imageUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.wishlists.count({ where: { buyerId: userId } }),
      db.wishlists.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              moq: true,
              slug: true,
              supplier: { select: { companyName: true } },
              images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { imageUrl: true } },
            },
          },
        },
      }),
      db.orderItems.findMany({
        where: { subOrder: { order: { buyerId: userId } } },
        select: {
          product: {
            select: {
              supplierId: true,
              supplier: { select: { id: true, companyName: true, ratingAvg: true } },
            },
          },
        },
        take: 200,
      }),
      db.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, query: true, createdAt: true },
      }),
      db.orders.findMany({
        where: { buyerId: userId, placedAt: { gte: sixMonthsAgo } },
        select: { placedAt: true, totalAmount: true },
      }),
      db.userCoupons.aggregate({
        where: { userId, status: 'used' },
        _sum: { savingsBDT: true },
        _count: { _all: true },
      }),
    ])

    // Favorite suppliers
    const supplierMap = new Map<string, { id: string; name: string; location: string; rating: number; orderCount: number }>()
    for (const item of favoriteSuppliersRaw) {
      const s = item.product.supplier
      if (!s) continue
      const existing = supplierMap.get(s.id)
      if (existing) {
        existing.orderCount++
      } else {
        supplierMap.set(s.id, {
          id: s.id,
          name: s.companyName,
          location: 'Bangladesh',
          rating: s.ratingAvg || 0,
          orderCount: 1,
        })
      }
    }
    const favoriteSuppliers = Array.from(supplierMap.values())
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 5)

    // Spending chart (6 months)
    const monthLabels: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthLabels.push(d.toLocaleString('en-US', { month: 'short' }))
    }
    const spendingTally = new Array(6).fill(0)
    for (const o of spendingByMonth) {
      const mIdx = (o.placedAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (o.placedAt.getMonth() - sixMonthsAgo.getMonth())
      if (mIdx >= 0 && mIdx < 6) spendingTally[mIdx] += o.totalAmount
    }
    const spendingData = monthLabels.map((month, i) => ({ month, amount: Math.round(spendingTally[i]) }))

    // Recent activity
    const recentActivity: { type: string; text: string; time: string }[] = []
    for (const o of recentOrders.slice(0, 5)) {
      recentActivity.push({ type: 'order', text: `Order ${o.orderNumber} placed`, time: o.placedAt.toISOString() })
    }
    for (const w of wishlistItems.slice(0, 3)) {
      recentActivity.push({ type: 'wishlist', text: `Added ${w.product?.name || 'item'} to wishlist`, time: w.createdAt.toISOString() })
    }
    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalOrders: ordersCount,
          totalSpentBDT: totalSpentAgg._sum.totalAmount || 0,
          activeOrders: activeOrdersCount,
          wishlistCount,
          totalSavingsBDT: couponSavings._sum.savingsBDT || 0,
        },
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          date: o.placedAt.toISOString(),
          status: o.paymentStatus,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount,
          itemCount: o.subOrders.reduce((sum, so) => sum + so.items.length, 0),
          summary: o.subOrders[0]?.items[0]?.product.name || 'Order Items',
          supplier: o.subOrders[0]?.items[0]?.product.supplier?.companyName || 'Supplier',
          thumbnailUrl: o.subOrders[0]?.items[0]?.product.images[0]?.imageUrl || null,
        })),
        spendingData,
        favoriteSuppliers,
        wishlistItems: wishlistItems.map((w) => ({
          id: w.id,
          productId: w.productId,
          name: w.product?.name || 'Product',
          price: w.product?.basePrice || 0,
          moq: w.product?.moq || 1,
          supplier: w.product?.supplier?.companyName || 'Supplier',
          thumbnailUrl: w.product?.images[0]?.imageUrl || null,
        })),
        recentSearches: recentSearches.map((s) => ({
          id: s.id,
          query: s.query,
          date: s.createdAt.toISOString(),
        })),
        couponSavings: couponSavings._count._all,
        recentActivity,
      },
    })
  } catch (error) {
    console.error('Buyer dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}