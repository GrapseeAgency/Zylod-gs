import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { broadcastToRoom } from '@/lib/realtime-broadcast'
import { notifyBackInStock, notifyVariantBackInStock } from '@/lib/stock-alerts'
import { roundQty } from '@/lib/product-contract'
import { z } from 'zod'

/**
 * GET  /api/supplier/inventory — the session supplier's REAL stock levels with
 *      variants nested ({items:[{id,name,unit,stockQuantity,moq,variants:[…]}]}).
 *      Admins may pass ?all=true to audit every supplier's stock.
 * PATCH /api/supplier/inventory — REAL-TIME stock edits, applied instantly in a
 *      single transaction: {updates:[{productId?|variantId?, newQuantity?|delta?,
 *      stockAlertThreshold?}]}. Product- and variant-level updates may be mixed;
 *      stockAlertThreshold (Task 79) is product-only — variants inherit it — and
 *      may be sent alone (null clears back to the platform default) or together
 *      with a quantity change. Every id is verified for ownership through
 *      products.supplierId (or admin) — no blind writes. Returns the real
 *      before/after quantity (and threshold when touched) for every update.
 *
 *      After the write succeeds, each updated product also gets a real-time
 *      `inventory:updated` push into its PUBLIC product:<productId> socket
 *      room (payload = only the real before/after computed here — PDP stock
 *      widgets and the seller inventory page live-apply it; Task 51-a),
 *      plus the canonical `product:stock` availability event (Task 56-c:
 *      {productId, stockQuantity, unit, bundleSize, inStock} — the payload
 *      the PDP live-stock UI consumes; variant-level edits carry variantId).
 */

const READ_LIMIT = { limit: 60, windowMs: 60_000 }
const WRITE_LIMIT = { limit: 60, windowMs: 60_000 }
const MAX_UPDATES_PER_REQUEST = 50

/**
 * Platform-default low-stock line (Task 79): products without a seller-tuned
 * products.stockAlertThreshold fall back to this everywhere — API summary,
 * seller console, admin audit, PDP urgency (PDP default is 5 for display
 * urgency; inventory surfaces use 20 to mirror the historical summary math).
 */
export const LOW_STOCK_FALLBACK = 20

const stockUpdateSchema = z
  .object({
    productId: z.string().min(1).optional(),
    variantId: z.string().min(1).optional(),
    newQuantity: z.number().min(0, 'Quantity cannot be negative').optional(),
    delta: z.number().optional(),
    stockAlertThreshold: z
      .number({ error: 'Alert threshold must be a number' })
      .min(0, 'Alert threshold cannot be negative')
      .max(1_000_000, 'Alert threshold is unreasonably large')
      .nullable()
      .optional(),
  })
  .refine((u) => Boolean(u.productId) !== Boolean(u.variantId), {
    message: 'Exactly one of productId or variantId is required per update',
  })
  .superRefine((u, ctx) => {
    if (u.variantId !== undefined && u.stockAlertThreshold !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Variants inherit the product-level alert threshold — set it on the product, not the variant',
        path: ['stockAlertThreshold'],
      })
    }
    const hasNew = u.newQuantity !== undefined
    const hasDelta = u.delta !== undefined
    const hasThreshold = u.stockAlertThreshold !== undefined
    const qtyXor = hasNew !== hasDelta
    if ((hasNew || hasDelta) && !qtyXor) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use either newQuantity or delta, not both',
        path: ['newQuantity'],
      })
    }
    if (!qtyXor && !hasThreshold) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one of newQuantity (set to value), delta (relative change), or stockAlertThreshold is required per update',
        path: ['newQuantity'],
      })
    }
  })

export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-inventory', READ_LIMIT.limit, READ_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true' && auth.user.userType === 'admin'

    const where: { supplierId?: string } = {}
    if (all) {
      // Admin stock audit across all suppliers.
    } else {
      const profile = await db.supplierProfiles.findUnique({
        where: { userId: auth.user.id },
        select: { id: true },
      })
      if (!profile) {
        // Honest empty result — without a supplier profile this user owns no stock.
        return NextResponse.json({
          success: true,
          data: {
            items: [],
            summary: { totalSkus: 0, totalVariantSkus: 0, lowStockCount: 0, outOfStockCount: 0, totalInventoryUnits: 0 },
          },
        })
      }
      where.supplierId = profile.id
    }

    const products = await db.products.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        stockQuantity: true,
        moq: true,
        thumbnailUrl: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
        stockAlertThreshold: true,
        category: { select: { name: true } },
        // Supplier attribution (admin ?all=true audit — who owns which stock).
        supplier: {
          select: { id: true, companyName: true, verificationStatus: true },
        },
        variants: {
          orderBy: { variantName: 'asc' },
          select: {
            id: true,
            variantName: true,
            variantValue: true,
            sku: true,
            stockQuantity: true,
            priceOverride: true,
          },
        },
      },
      orderBy: { stockQuantity: 'asc' },
    })

    // Real summary from the actual rows (products + variant SKUs counted
    // separately). Task 79: low-stock honors each product's OWN threshold —
    // the seller-tuned products.stockAlertThreshold, falling back to the
    // platform default when the seller never tuned it.
    const summary = {
      totalSkus: products.length,
      totalVariantSkus: products.reduce((acc, p) => acc + p.variants.length, 0),
      lowStockCount: products.filter(
        (p) => p.stockQuantity > 0 && p.stockQuantity <= (p.stockAlertThreshold ?? LOW_STOCK_FALLBACK)
      ).length,
      outOfStockCount: products.filter((p) => p.stockQuantity <= 0).length,
      totalInventoryUnits: products.reduce((acc, p) => acc + p.stockQuantity, 0),
    }

    return NextResponse.json({ success: true, data: { items: products, summary } })
  } catch (error) {
    console.error('Supplier inventory GET error:', error)
    return NextResponse.json({ error: 'Failed to load inventory' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUserType(request, ['supplier', 'admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: auth.error || 'Authentication required' },
      { status: 401 }
    )
  }

  const rl = checkRateLimit(request, 'supplier-inventory-write', WRITE_LIMIT.limit, WRITE_LIMIT.windowMs)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => null)
    const parsedBody = z.object({ updates: z.array(stockUpdateSchema).min(1, 'updates array is required') }).safeParse(body)
    if (!parsedBody.success) {
      const flattened = parsedBody.error.flatten()
      const firstFieldIssue = Object.values(flattened.fieldErrors)[0]?.[0]
      return NextResponse.json(
        { error: flattened.formErrors[0] ?? firstFieldIssue ?? 'Invalid updates payload', issues: flattened.fieldErrors },
        { status: 400 }
      )
    }
    const updates = parsedBody.data.updates
    if (updates.length > MAX_UPDATES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Too many updates in one request (${updates.length}) — the limit is ${MAX_UPDATES_PER_REQUEST}` },
        { status: 400 }
      )
    }

    const isAdmin = auth.user.userType === 'admin'
    let profileId: string | null = null
    const variantProductIds = new Map<string, string>()
    if (!isAdmin) {
      const profile = await db.supplierProfiles.findUnique({
        where: { userId: auth.user.id },
        select: { id: true },
      })
      if (!profile) {
        return NextResponse.json(
          { error: 'Complete seller registration before managing inventory' },
          { status: 403 }
        )
      }
      profileId = profile.id
    }

    // Resolve + authorize every target FIRST (outside the tx, read-only), so a
    // bad id fails the whole request before anything is written. unit/bundleSize
    // ride along for the canonical product:stock broadcast (Task 56-c).
    const resolved: Array<{
      key: 'productId' | 'variantId'
      id: string
      before: number
      unit: string
      bundleSize: number | null
      thresholdBefore: number | null
    }> = []

    for (const [index, u] of updates.entries()) {
      if (u.productId) {
        const product = await db.products.findUnique({
          where: { id: u.productId },
          select: { id: true, stockQuantity: true, supplierId: true, unit: true, bundleSize: true, stockAlertThreshold: true },
        })
        if (!product || (!isAdmin && product.supplierId !== profileId)) {
          return NextResponse.json(
            { error: `Update ${index + 1}: product not found in your inventory` },
            { status: 404 }
          )
        }
        resolved.push({ key: 'productId', id: product.id, before: product.stockQuantity, unit: product.unit, bundleSize: product.bundleSize, thresholdBefore: product.stockAlertThreshold })
      } else if (u.variantId) {
        const variant = await db.productVariants.findUnique({
          where: { id: u.variantId },
          select: {
            id: true,
            stockQuantity: true,
            productId: true,
            product: { select: { supplierId: true, unit: true, bundleSize: true } },
          },
        })
        if (!variant || (!isAdmin && variant.product.supplierId !== profileId)) {
          return NextResponse.json(
            { error: `Update ${index + 1}: variant not found in your inventory` },
            { status: 404 }
          )
        }
        variantProductIds.set(variant.id, variant.productId)
        resolved.push({ key: 'variantId', id: variant.id, before: variant.stockQuantity, unit: variant.product.unit, bundleSize: variant.product.bundleSize, thresholdBefore: null })
      }
    }

    // Apply ALL updates instantly in one transaction — the real-time stock edit.
    const results = await db.$transaction(async (tx) => {
      const applied: Array<{
        productId?: string
        variantId?: string
        before: number
        after: number
        updatedAt: Date
        thresholdBefore?: number | null
        thresholdAfter?: number | null
      }> = []
      for (const [index, u] of updates.entries()) {
        const r = resolved[index]
        const target = roundQty(
          u.newQuantity !== undefined
            ? u.newQuantity
            : Math.max(0, r.before + (u.delta ?? 0))
        )
        if (r.key === 'productId') {
          // Task 79: the seller-tuned alert threshold rides the same
          // transactional write when the update carries it (undefined = not
          // touched; null = clear back to the platform default).
          const thresholdTouched = u.stockAlertThreshold !== undefined
          const row = await tx.products.update({
            where: { id: r.id },
            data: {
              stockQuantity: target,
              ...(thresholdTouched ? { stockAlertThreshold: u.stockAlertThreshold } : {}),
            },
            select: { stockQuantity: true, updatedAt: true, stockAlertThreshold: true },
          })
          applied.push({
            productId: r.id,
            before: r.before,
            after: row.stockQuantity,
            updatedAt: row.updatedAt,
            ...(thresholdTouched
              ? { thresholdBefore: r.thresholdBefore, thresholdAfter: row.stockAlertThreshold }
              : {}),
          })
        } else {
          const row = await tx.productVariants.update({
            where: { id: r.id },
            data: { stockQuantity: target },
            select: { stockQuantity: true },
          })
          // productVariants has no updatedAt column — the write timestamp is
          // the honest "when this value became true" for the broadcast payload.
          applied.push({ variantId: r.id, before: r.before, after: row.stockQuantity, updatedAt: new Date() })
        }
      }
      return applied
    })

    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'inventory_updated',
        entityType: 'products',
        entityId: results.length === 1 && results[0].productId ? results[0].productId : null,
        metadata: JSON.stringify({
          actorType: isAdmin ? 'admin' : 'supplier',
          supplierId: profileId,
          updates: results.map((r) => ({
            ...(r.productId ? { productId: r.productId } : { variantId: r.variantId }),
            before: r.before,
            after: r.after,
            ...(r.thresholdAfter !== undefined
              ? { thresholdBefore: r.thresholdBefore, thresholdAfter: r.thresholdAfter }
              : {}),
            updatedAt: r.updatedAt.toISOString(),
          })),
        }),
      },
    })

    // Real-time (Task 51-a): each updated product pushes its REAL persisted
    // before/after into the public product room. Only public-parity fields
    // are included (product/variant id, absolute stock, delta, write time).
    // Task 56-c: the same loop also emits the canonical `product:stock`
    // availability event ({productId, stockQuantity, unit, bundleSize,
    // inStock}) from the same REAL persisted after-value — variant edits
    // carry variantId and the variant's own stock. soldCount is untouched
    // here, so it is not part of this payload.
    for (const r of results) {
      const productId = r.productId ?? variantProductIds.get(r.variantId ?? '')
      if (!productId) continue
      const target = resolved.find((x) => (x.key === 'variantId' ? x.id === r.variantId : x.id === r.productId))
      const unit = target?.unit ?? 'pcs'
      const bundleSize = target?.bundleSize ?? null
      void broadcastToRoom(`product:${productId}`, 'inventory:updated', {
        productId,
        ...(r.variantId ? { variantId: r.variantId } : {}),
        stockQuantity: r.after,
        delta: r.after - r.before,
        updatedAt: r.updatedAt.toISOString(),
      })
      void broadcastToRoom(`product:${productId}`, 'product:stock', {
        productId,
        ...(r.variantId ? { variantId: r.variantId } : {}),
        stockQuantity: r.after,
        unit,
        bundleSize,
        inStock: r.after > 0,
      })
      // Task 61: a genuine RESTOCK (stock increased) may complete somebody's
      // back-in-stock watch. Decreases and no-ops never notify.
      // Task 65: a variant row restock completes THAT variant's watches; a
      // product row restock completes the product-level watches.
      if (r.after > r.before) {
        if (r.variantId) {
          notifyVariantBackInStock(productId, r.variantId)
        } else {
          notifyBackInStock(productId)
        }
      }
      // Task 62: the seller's own room also hears the edit — the dashboard's
      // Restock Demand card refetches live so completed watches leave the
      // queue the moment their own restock lands. Admin edits skip this
      // (the product room push above already carries the public truth).
      if (profileId) {
        void broadcastToRoom(`seller:${profileId}`, 'inventory:updated', {
          productId,
          ...(r.variantId ? { variantId: r.variantId } : {}),
          before: r.before,
          after: r.after,
          // Task 79: cross-session consoles learn the new alert line too.
          ...(r.thresholdAfter !== undefined ? { stockAlertThreshold: r.thresholdAfter } : {}),
        })
      }
    }

    // An honest message: a threshold-only touch is not a stock edit.
    const thresholdOnly =
      updates.length > 0 &&
      updates.every((u) => u.stockAlertThreshold !== undefined && u.newQuantity === undefined && u.delta === undefined)

    return NextResponse.json({
      success: true,
      data: { results },
      message: thresholdOnly
        ? `Low-stock alert updated for ${results.length} ${results.length === 1 ? 'item' : 'items'}`
        : `Stock updated for ${results.length} ${results.length === 1 ? 'item' : 'items'}`,
    })
  } catch (error) {
    console.error('Supplier inventory PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 })
  }
}
