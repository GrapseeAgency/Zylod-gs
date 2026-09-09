import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/supplier/dashboard
 * Real stats, revenue chart, inventory alerts, product performance, customer
 * insights, and pending verifications for the supplier dashboard.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Supplier authentication required' }, { status: 401 })
  }

  try {
    const supplierId = auth.user.id
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const supplierProfile = await db.supplierProfiles.findUnique({
      where: { userId: supplierId },
      select: { id: true, companyName: true, verificationStatus: true, ratingAvg: true },
    })

    const [
      productsCount,
      lowStockProducts,
      allSubOrders,
      topProducts,
      productPerformance,
      revenueByMonthRaw,
      verificationDocs,
      buyerRegionsRaw,
      quoteCount,
      messageCount,
    ] = await Promise.all([
      db.products.count({ where: { supplierId } }),
      db.products.findMany({
        where: { supplierId, stockQuantity: { lte: 10 } },
        select: { id: true, name: true, stockQuantity: true, moq: true },
        take: 10,
      }),
      db.subOrders.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          order: { select: { orderNumber: true, placedAt: true, buyerId: true } },
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
        },
      }),
      db.products.findMany({
        where: { supplierId },
        orderBy: { soldCount: 'desc' },
        take: 5,
        select: { id: true, name: true, basePrice: true, stockQuantity: true, soldCount: true, categoryId: true, category: { select: { name: true } } },
      }),
      db.products.findMany({
        where: { supplierId },
        orderBy: { soldCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          soldCount: true,
          ratingAvg: true,
          category: { select: { name: true } },
          orderItems: {
            select: { quantity: true, unitPrice: true, totalPrice: true },
          },
        },
      }),
      db.subOrders.findMany({
        where: { supplierId, createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true, subtotal: true, shippingCost: true },
      }),
      db.sellerVerificationDocuments.findMany({
        where: { supplierId: supplierProfile?.id || '' },
        select: { id: true, documentType: true, status: true, uploadedAt: true },
      }),
      db.subOrders.findMany({
        where: { supplierId },
        select: {
          order: {
            select: {
              shippingAddress: { select: { city: true } },
              buyer: { select: { id: true, createdAt: true } },
            },
          },
        },
        take: 200,
      }),
      db.quoteRequests.count({ where: { supplierId } }),
      db.messages.count({ where: { conversation: { supplierId } } }),
    ])

    const totalRevenueBDT = allSubOrders.reduce((sum, so) => sum + (so.subtotal || 0) + (so.shippingCost || 0), 0)
    const pendingOrdersCount = allSubOrders.filter((so) => so.status === 'pending').length
    const thisMonthRevenue = allSubOrders
      .filter((so) => so.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, so) => sum + (so.subtotal || 0) + (so.shippingCost || 0), 0)

    const productPerf = productPerformance.map((p) => {
      const revenue = p.orderItems.reduce((sum, oi) => sum + oi.totalPrice, 0)
      return {
        id: p.id,
        name: p.name,
        sales: p.soldCount,
        revenue,
        rating: p.ratingAvg,
        category: p.category?.name || 'General',
      }
    })

    const monthLabels: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthLabels.push(d.toLocaleString('en-US', { month: 'short' }))
    }
    const revTally = new Array(6).fill(0)
    for (const r of revenueByMonthRaw) {
      const mIdx = (r.createdAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (r.createdAt.getMonth() - sixMonthsAgo.getMonth())
      if (mIdx >= 0 && mIdx < 6) revTally[mIdx] += (r.subtotal || 0) + (r.shippingCost || 0)
    }
    const monthlyRevenue = monthLabels.map((month, i) => ({ month, revenue: Math.round(revTally[i]) }))

    const pendingVerifications = verificationDocs
      .filter((d) => d.status === 'pending' || d.status === 'under_review')
      .map((d) => ({
        id: d.id,
        type: d.documentType,
        status: d.status,
        date: d.uploadedAt.toISOString().slice(0, 10),
      }))

    const regionMap = new Map<string, number>()
    const buyerSet = new Set<string>()
    let newBuyers = 0
    let repeatBuyers = 0
    const buyerOrderCount = new Map<string, number>()
    for (const so of buyerRegionsRaw) {
      const buyerId = so.order.buyer?.id
      if (!buyerId) continue
      buyerSet.add(buyerId)
      buyerOrderCount.set(buyerId, (buyerOrderCount.get(buyerId) || 0) + 1)
      const city = so.order.shippingAddress?.city
      if (city) regionMap.set(city, (regionMap.get(city) || 0) + 1)
    }
    for (const [, count] of buyerOrderCount) {
      if (count === 1) newBuyers++
      else repeatBuyers++
    }
    const topRegions = Array.from(regionMap.entries())
      .map(([region, orders]) => ({ region, orders, percentage: Math.round((orders / (buyerRegionsRaw.length || 1)) * 100) }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalProducts: productsCount,
          totalOrders: allSubOrders.length,
          pendingOrders: pendingOrdersCount,
          lowStockCount: lowStockProducts.length,
          totalRevenueBDT,
          thisMonthRevenue,
          totalBuyers: buyerSet.size,
        },
        supplier: {
          companyName: supplierProfile?.companyName || 'Your Store',
          verificationStatus: supplierProfile?.verificationStatus || 'pending',
          ratingAvg: supplierProfile?.ratingAvg || 0,
          city: 'Bangladesh',
        },
        recentSubOrders: allSubOrders.slice(0, 8).map((so) => ({
          id: so.id,
          orderNumber: so.order?.orderNumber || so.id,
          date: so.createdAt.toISOString(),
          status: so.status,
          totalAmount: so.subtotal + (so.shippingCost || 0),
          itemCount: so.items.length,
          primaryItemName: so.items[0]?.product.name || 'Products',
        })),
        topProducts: topProducts.map((p) => ({
          id: p.id,
          name: p.name,
          basePrice: p.basePrice,
          stockQuantity: p.stockQuantity,
          soldCount: p.soldCount,
          category: p.category?.name || 'General',
        })),
        productPerformance: productPerf,
        inventoryAlerts: lowStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          currentStock: p.stockQuantity,
          threshold: p.moq,
          severity: p.stockQuantity === 0 ? 'critical' : 'warning',
        })),
        monthlyRevenue,
        pendingVerifications,
        customerInsights: {
          newBuyers,
          repeatBuyers,
          topRegions,
        },
        storeStats: {
          messages: messageCount,
          quotes: quoteCount,
        },
      },
    })
  } catch (error) {
    console.error('Supplier dashboard GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}