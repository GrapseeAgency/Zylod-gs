import type { Prisma } from '@prisma/client'

/**
 * ─── Canonical Wholesale Pricing Rule (campaign Task 50-b) ──────────────
 *
 * For an order line with quantity `q` on product `p` and optional variant `v`:
 *
 *  1. If `v` has priceOverride != null → unitPrice = v.priceOverride.
 *     Variants are priced individually — price tiers DO NOT apply.
 *  2. Otherwise find the price tier of `p` where minQty ≤ q AND
 *     (maxQty == null OR q ≤ maxQty) → unitPrice = tier.pricePerUnit.
 *  3. If no tier matches → unitPrice = p.basePrice.
 *
 * Price tiers are per-product wholesale discounts (volume breaks). The buyer
 * NEVER sets the unit price: orders, create-direct and the cart all record
 * the price resolved here, and any client-said price is ignored.
 *
 * All quantity guards throw a typed `PricingError` — never silent, never a
 * fabricated fallback price.
 */

export type PricingErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'BELOW_MOQ'
  | 'ABOVE_MAX_ORDER'
  | 'VARIANT_MISMATCH'

/** Suggested HTTP status per error code (orders/cart routes map these 1:1). */
const PRICING_ERROR_STATUS: Record<PricingErrorCode, number> = {
  PRODUCT_NOT_FOUND: 404,
  INVALID_QUANTITY: 400,
  BELOW_MOQ: 422,
  ABOVE_MAX_ORDER: 422,
  VARIANT_MISMATCH: 400,
}

export class PricingError extends Error {
  code: PricingErrorCode
  status: number
  /** Real limits from the product row so responses can state the actual rule. */
  details: Record<string, unknown>

  constructor(code: PricingErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'PricingError'
    this.code = code
    this.status = PRICING_ERROR_STATUS[code]
    this.details = details
  }
}

/** Minimal variant shape the caller may pass (already fetched + validated). */
export interface PricingVariantRef {
  id: string
  productId: string
  priceOverride: number | null
}

export interface ResolvedUnitPrice {
  unitPrice: number
  /** Which rule produced the price — keeps the audit trail honest. */
  priceSource: 'variant_override' | 'tier' | 'base_price'
  appliedTierId: string | null
  moq: number
  maxOrderQty: number | null
  currency: string
}

/**
 * Resolve the REAL unit price for one order line.
 *
 * Uses a SINGLE query (product + its price tiers via include). Accepts an
 * optional pre-fetched variant row to avoid a second query; the variant must
 * belong to the given product or a VARIANT_MISMATCH error is thrown.
 *
 * `tx` may be a Prisma transaction client or the plain `db` client (both
 * satisfy Prisma.TransactionClient), so this works inside the atomic order
 * transaction and on read paths like the cart.
 */
export async function resolveUnitPrice(
  tx: Prisma.TransactionClient,
  productId: string,
  quantity: number,
  variant?: PricingVariantRef | null
): Promise<ResolvedUnitPrice> {
  // One query loads the product AND all of its tiers — "single tiers query".
  const product = await tx.products.findUnique({
    where: { id: productId },
    include: { priceTiers: true },
  })

  if (!product) {
    throw new PricingError('PRODUCT_NOT_FOUND', `Product ${productId} not found`)
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new PricingError('INVALID_QUANTITY', 'Quantity must be a positive number', {
      quantity,
    })
  }

  if (quantity < product.moq) {
    throw new PricingError(
      'BELOW_MOQ',
      `Minimum order quantity for ${product.name} is ${product.moq}`,
      { moq: product.moq, quantity }
    )
  }

  if (product.maxOrderQty != null && quantity > product.maxOrderQty) {
    throw new PricingError(
      'ABOVE_MAX_ORDER',
      `Maximum order quantity for ${product.name} is ${product.maxOrderQty}`,
      { maxOrderQty: product.maxOrderQty, quantity }
    )
  }

  if (variant) {
    if (variant.productId !== productId) {
      throw new PricingError('VARIANT_MISMATCH', 'Variant does not belong to this product', {
        variantId: variant.id,
        productId,
      })
    }
    // Rule 1 — variant priced individually, tiers do not apply.
    if (variant.priceOverride != null) {
      return {
        unitPrice: variant.priceOverride,
        priceSource: 'variant_override',
        appliedTierId: null,
        moq: product.moq,
        maxOrderQty: product.maxOrderQty,
        currency: product.currency,
      }
    }
    // Variant with priceOverride == null falls through to tiers/base price.
  }

  // Rule 2 — the tier where minQty ≤ q AND (maxQty == null OR q ≤ maxQty).
  const tier = product.priceTiers.find(
    (t) => quantity >= t.minQty && (t.maxQty == null || quantity <= t.maxQty)
  )

  // Rule 3 — no matching tier → base price.
  return {
    unitPrice: tier ? tier.pricePerUnit : product.basePrice,
    priceSource: tier ? 'tier' : 'base_price',
    appliedTierId: tier ? tier.id : null,
    moq: product.moq,
    maxOrderQty: product.maxOrderQty,
    currency: product.currency,
  }
}
