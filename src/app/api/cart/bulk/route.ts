import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { resolveUnitPrice, PricingError } from '@/lib/wholesale-pricing'

/**
 * REBUILT bulk add-to-cart (Task 51-d) — the wholesale bulk line merger.
 *
 * BEFORE (broken, Task 51-c audit): upserted cartItems with
 * where: { cartId_productId: { cartId: auth.user.id, productId } } — but
 * (a) the cartItems model has NO cartId_productId compound unique (only
 * plain @@index([cartId]) / @@index([productId]) — the upsert threw),
 * (b) it passed the USER id as cartId while carts.id is a separate cuid
 * (FK orphan), (c) no variant support, (d) it REPLACED quantity instead
 * of merging, (e) no MOQ/stock/maxOrderQty checks, (f) no supplierId on
 * created lines (cartItems.supplierId is required).
 *
 * AFTER — mirrors POST /api/cart exactly (Task 50/51 canonical add path):
 *  - requireUserType(['buyer']) → 401 FIRST, then 30/min rate limit.
 *  - Zod body { items: [{ productId, variantId?, quantity ≥1, wishlistItemId? }] },
 *    ≤50 items. wishlistItemId is accepted because the real caller
 *    (bulk-add-to-cart-page.tsx) sends it; it is never trusted for anything.
 *    maxOrderQty is NOT accepted from the client — the server reads the real
 *    one from the product row, same as /api/cart.
 *  - The caller's REAL cart row is resolved exactly like /api/cart
 *    (carts.findFirst({ buyerId }) → create if missing) — inside the same
 *    transaction as every line write.
 *  - Each line: product must exist + isActive + isApproved (else honest
 *    rejection), variant must belong to the product, incoming quantity must
 *    meet the real MOQ, then the MERGED total (existing + incoming) must fit
 *    the real maxOrderQty and real stock (variant stock when a variant is
 *    set) — the same rules the single-add path enforces, applied to the
 *    post-merge state. Rejections carry the honest per-item reason
 *    (e.g. 'insufficient stock: 3 left').
 *  - Merge (not replace): existing line for the same (productId, variantId)
 *    → quantity += incoming; new line → create with the product's REAL
 *    supplierId. Duplicate lines within one request merge naturally because
 *    each entry re-reads the line inside the transaction.
 *  - Everything runs in ONE db.$transaction.
 *  - After the write, EVERY cart line is re-priced server-side with the
 *    canonical rule (resolveUnitPrice — variant priceOverride → covering
 *    tier → basePrice) and the GET /api/cart response shape
 *    { cartId, totalItems, totalAmount, suppliers } is returned, plus a real
 *    per-item results array (added | merged | rejected + reason).
 *  - auditLogs: POST /api/cart does not audit-log cart line writes, so this
 *    route mirrors that (no audit where the surrounding code has none).
 */

const bulkBodySchema = z.object({
  items: z
    .array(
      z
        .object({
          productId: z.string().min(1, 'productId is required'),
          variantId: z.string().min(1).nullish(),
          quantity: z
            .number({ message: 'quantity must be a number' })
            .int('quantity must be a whole number')
            .min(1, 'quantity must be at least 1')
            .max(10000, 'quantity must be at most 10000'),
          // Sent by bulk-add-to-cart-page.tsx (wishlist bulk add). Accepted so
          // the real caller works unchanged; never trusted — cart lines are
          // keyed by (productId, variantId), never by client-said wishlist ids.
          wishlistItemId: z.string().min(1).optional(),
        })
        .strict()
    )
    .min(1, 'items array is required')
    .max(50, 'Bulk add is limited to 50 items per request'),
})

type BulkItem = z.infer<typeof bulkBodySchema>['items'][number]

interface BulkItemResult {
  productId: string
  variantId: string | null
  status: 'added' | 'merged' | 'rejected'
  /** Line quantity AFTER the write (merged/added), or the requested quantity. */
  quantity: number
  /** Present on merged lines: what the line held before this request. */
  previousQuantity?: number
  /** Present on rejected items: the honest reason, verbatim. */
  reason?: string
  /** Real limit values that caused a rejection (moq / maxOrderQty / stock). */
  details?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  // AUTH FIRST — 401 before any rate limiting or validation.
  const auth = await requireUserType(request, ['buyer'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  // Rate limit AFTER auth — 30 bulk writes per minute per client.
  const rl = checkRateLimit(request, 'cart-bulk-write', 30, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  const buyerId = auth.user.id

  // Parse + validate the body (Zod — every write validated).
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = bulkBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const firstField = Object.values(flat.fieldErrors)[0]?.[0]
    return NextResponse.json(
      { error: firstField || flat.formErrors[0] || 'Invalid request body', fieldErrors: flat.fieldErrors },
      { status: 400 }
    )
  }
  const items: BulkItem[] = parsed.data.items

  try {
    // ─── ONE TRANSACTION: cart resolution + every line check/write ───
    const { cartId, results } = await db.$transaction(async (tx) => {
      // Resolve the caller's REAL cart row the same way /api/cart does.
      let cart = await tx.carts.findFirst({ where: { buyerId } })
      if (!cart) {
        cart = await tx.carts.create({ data: { buyerId } })
      }

      const results: BulkItemResult[] = []

      for (const item of items) {
        const variantId = item.variantId ?? null
        const reject = (reason: string, details?: Record<string, unknown>): void => {
          results.push({
            productId: item.productId,
            variantId,
            status: 'rejected',
            quantity: item.quantity,
            reason,
            details,
          })
        }

        const product = await tx.products.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            isActive: true,
            isApproved: true,
            stockQuantity: true,
            moq: true,
            maxOrderQty: true,
            supplierId: true,
          },
        })

        if (!product || !product.isActive || !product.isApproved) {
          reject('Product not found or no longer available')
          continue
        }

        // Variant must exist and belong to this product (same rule as /api/cart).
        let variant: { id: string; productId: string; stockQuantity: number } | null = null
        if (variantId) {
          const row = await tx.productVariants.findUnique({ where: { id: variantId } })
          if (!row || row.productId !== item.productId) {
            reject('Invalid variant for this product')
            continue
          }
          variant = { id: row.id, productId: row.productId, stockQuantity: row.stockQuantity }
        }

        // MOQ on the incoming quantity — same check the single-add path makes.
        if (item.quantity < product.moq) {
          reject(`Minimum order quantity is ${product.moq}`, { moq: product.moq })
          continue
        }

        // Existing line for the SAME identity /api/cart uses: cartId + productId + variantId.
        const existing = await tx.cartItems.findFirst({
          where: { cartId: cart.id, productId: item.productId, variantId },
        })

        const stockAvailable = variant ? variant.stockQuantity : product.stockQuantity
        const previousQuantity = existing?.quantity ?? 0
        const mergedQuantity = previousQuantity + item.quantity

        // Max order quantity (real column, server-side) applies to the merged line.
        if (product.maxOrderQty != null && mergedQuantity > product.maxOrderQty) {
          reject(`Maximum order quantity is ${product.maxOrderQty}`, {
            maxOrderQty: product.maxOrderQty,
            requestedTotal: mergedQuantity,
            alreadyInCart: previousQuantity,
          })
          continue
        }

        // Stock applies to the merged line — the honest post-merge state.
        if (mergedQuantity > stockAvailable) {
          reject(`insufficient stock: ${stockAvailable} left`, {
            stockAvailable,
            requestedTotal: mergedQuantity,
            alreadyInCart: previousQuantity,
          })
          continue
        }

        if (existing) {
          // MERGE — never replace.
          await tx.cartItems.update({
            where: { id: existing.id },
            data: { quantity: mergedQuantity },
          })
          results.push({
            productId: item.productId,
            variantId,
            status: 'merged',
            quantity: mergedQuantity,
            previousQuantity,
          })
        } else {
          // NEW line — supplierId always comes from the product row (never the client).
          await tx.cartItems.create({
            data: {
              cartId: cart.id,
              productId: item.productId,
              variantId,
              quantity: item.quantity,
              supplierId: product.supplierId,
            },
          })
          results.push({ productId: item.productId, variantId, status: 'added', quantity: item.quantity })
        }
      }

      return { cartId: cart.id, results }
    })

    // ─── SERVER TRUTH RE-PRICING (canonical rule, every line) ───
    // Re-read the cart post-write and price it exactly like GET /api/cart so
    // the response reflects what the buyer will actually be charged.
    const cart = await db.carts.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                priceTiers: { orderBy: { minQty: 'asc' } },
                supplier: { select: { id: true, companyName: true } },
              },
            },
            variant: true,
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    })

    type CartLine = NonNullable<typeof cart>['items'][number]
    type PricedLine = CartLine & {
      unitPrice: number | null
      totalPrice: number | null
      priceSource?: string
      pricingIssue: string | null
    }

    const pricedItems: PricedLine[] = []
    for (const item of cart?.items ?? []) {
      if (!item.product.isActive || !item.product.isApproved) {
        pricedItems.push({ ...item, unitPrice: null, totalPrice: null, pricingIssue: 'Product is no longer available' })
        continue
      }
      try {
        const resolved = await resolveUnitPrice(
          db,
          item.productId,
          item.quantity,
          item.variant
            ? { id: item.variant.id, productId: item.variant.productId, priceOverride: item.variant.priceOverride }
            : null
        )
        pricedItems.push({
          ...item,
          unitPrice: resolved.unitPrice,
          totalPrice: resolved.unitPrice * item.quantity,
          priceSource: resolved.priceSource,
          pricingIssue: null,
        })
      } catch (pricingError) {
        if (pricingError instanceof PricingError) {
          pricedItems.push({ ...item, unitPrice: null, totalPrice: null, pricingIssue: pricingError.message })
          continue
        }
        throw pricingError
      }
    }

    // Same supplier grouping as GET /api/cart — subtotals use ONLY server-resolved prices.
    const groupedBySupplier = pricedItems.reduce(
      (groups, item) => {
        const supplierId = item.supplierId
        if (!groups[supplierId]) {
          groups[supplierId] = {
            supplierId,
            supplierName: item.product.supplier?.companyName || 'Unknown',
            items: [],
            subtotal: 0,
          }
        }
        groups[supplierId].items.push(item)
        if (item.totalPrice != null) {
          groups[supplierId].subtotal += item.totalPrice
        }
        return groups
      },
      {} as Record<string, { supplierId: string; supplierName: string; items: typeof pricedItems; subtotal: number }>
    )

    const totalAmount = Object.values(groupedBySupplier).reduce((sum, g) => sum + g.subtotal, 0)

    const added = results.filter((r) => r.status === 'added').length
    const merged = results.filter((r) => r.status === 'merged').length
    const rejected = results.filter((r) => r.status === 'rejected').length

    return NextResponse.json({
      success: true,
      data: {
        cartId,
        totalItems: pricedItems.length,
        totalAmount,
        suppliers: Object.values(groupedBySupplier),
      },
      // Real per-item outcomes — added/merged/rejected with the honest reason.
      results,
      message: `${added} added, ${merged} merged, ${rejected} rejected`,
    })
  } catch (error) {
    console.error('CartBulk POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
