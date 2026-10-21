import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveSupplierProfile, SUPPLIER_PROFILE_REQUIRED } from '@/lib/supplier-scope'

/**
 * GET /api/supplier/analytics — REAL aggregates over orderItems joined to the
 * signed-in supplier's products.
 *
 * Honest accounting (de-fake campaign): recognized revenue counts only order
 * lines whose parent order paymentStatus = 'paid' AND whose subOrder status
 * is NOT cancelled/returned (those two statuses are the only real reversals
 * on subOrders). Every metric is derived from rows; when there is no data the
 * response carries real zeros / empty arrays. conversionRate and pageViews
 * have NO real tracking source, so they are null — never invented numbers.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUserType(request, ['supplier', 'admin'])
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const rl = checkRateLimit(request, 'supplier-analytics', 60, 60_000)
    if (!rl.ok) return rateLimitResponse(rl)

    const profile = await resolveSupplierProfile(auth.user)
    if (!profile) {
      return NextResponse.json(SUPPLIER_PROFILE_REQUIRED, { status: 403 })
    }

    // Revenue set: paymentStatus 'paid' AND subOrder not cancelled/returned
    // (the only real reversal statuses on subOrders).
    const revenueItems = await db.orderItems.findMany({
      where: {
        product: { supplierId: profile.id },
        subOrder: { status: { notIn: ['cancelled', 'returned'] }, order: { paymentStatus: 'paid' } },
      },
      select: {
        quantity: true,
        totalPrice: true,
        productId: true,
        subOrderId: true,
        subOrder: { select: { createdAt: true } },
        product: { select: { id: true, name: true } },
      },
    })

    // ─── Overview (all-time, real zeros when empty) ───
    const gmv = revenueItems.reduce((sum, i) => sum + i.totalPrice, 0)
    const unitsSold = revenueItems.reduce((sum, i) => sum + i.quantity, 0)
    const orderIds = new Set(revenueItems.map((i) => i.subOrderId))
    const totalOrders = orderIds.size
    const aov = totalOrders > 0 ? gmv / totalOrders : 0

    // ─── Per-day series, last 30 days (every day present, real zeros) ───
    const now = new Date()
    const dayKeys: string[] = []
    for (let d = 29; d >= 0; d--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
      dayKeys.push(day.toISOString().slice(0, 10))
    }
    const revenueByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]))
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    for (const item of revenueItems) {
      const created = item.subOrder.createdAt
      if (created < cutoff) continue
      const key = new Date(created.getFullYear(), created.getMonth(), created.getDate()).toISOString().slice(0, 10)
      if (revenueByDay.has(key)) {
        revenueByDay.set(key, (revenueByDay.get(key) || 0) + item.totalPrice)
      }
    }
    const salesPerformance = dayKeys.map((date) => ({
      date,
      bdt: Math.round((revenueByDay.get(date) || 0) * 100) / 100,
    }))

    // ─── Top products by revenue ───
    const perProduct = new Map<string, { id: string; name: string; unitsSold: number; revenue: number }>()
    for (const item of revenueItems) {
      const entry = perProduct.get(item.productId) || {
        id: item.productId,
        name: item.product.name,
        unitsSold: 0,
        revenue: 0,
      }
      entry.unitsSold += item.quantity
      entry.revenue += item.totalPrice
      perProduct.set(item.productId, entry)
    }
    const topProducts = Array.from(perProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, unitsSold: p.unitsSold, revenue: Math.round(p.revenue * 100) / 100 }))

    // ─── Restock-watch demand (Task 66): REAL active stockAlerts rows on this
    // supplier's products — the buyers explicitly waiting for goods to come
    // back. Variant watches (Task 65) count toward their product and their
    // pinned labels are listed. Products nobody waits on are not rows.
    // (stockAlerts carries no products relation — scope by product ids.)
    const supplierProducts = await db.products.findMany({
      where: { supplierId: profile.id },
      select: { id: true, name: true, stockQuantity: true, unit: true, isActive: true },
    })
    const demandProductMeta = new Map(supplierProducts.map((p) => [p.id, p]))
    const activeWatches = await db.stockAlerts.findMany({
      where: { status: 'active', productId: { in: supplierProducts.map((p) => p.id) } },
      select: { productId: true, variantId: true, variantLabel: true },
    })
    const demandMap = new Map<string, {
      productId: string; productName: string; stockQuantity: number; unit: string
      isActive: boolean; watchers: number; variantLabels: Set<string>
    }>()
    for (const w of activeWatches) {
      const meta = demandProductMeta.get(w.productId)
      if (!meta) continue
      const entry = demandMap.get(w.productId) || {
        productId: w.productId,
        productName: meta.name,
        stockQuantity: meta.stockQuantity,
        unit: meta.unit,
        isActive: meta.isActive,
        watchers: 0,
        variantLabels: new Set<string>(),
      }
      entry.watchers += 1
      if (w.variantLabel) entry.variantLabels.add(w.variantLabel)
      demandMap.set(w.productId, entry)
    }
    const restockDemand = {
      totalWatchers: activeWatches.length,
      products: Array.from(demandMap.values())
        .sort((a, b) => b.watchers - a.watchers)
        .map((d) => ({
          productId: d.productId,
          productName: d.productName,
          stockQuantity: d.stockQuantity,
          unit: d.unit,
          isActive: d.isActive,
          watchers: d.watchers,
          variantLabels: Array.from(d.variantLabels),
        })),
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          gmv: Math.round(gmv * 100) / 100,
          totalOrders,
          unitsSold,
          aov: Math.round(aov * 100) / 100,
          // No real tracking source exists — null, never fabricated.
          conversionRate: null,
          pageViews: null,
        },
        salesPerformance,
        // No real traffic-attribution source exists — honest empty.
        trafficSources: [],
        topProducts,
        restockDemand,
      },
    })
  } catch (error) {
    console.error('Supplier analytics GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
