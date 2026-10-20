import { PromotionUsageError } from './promotions-errors'

/**
 * Task 100 — PLATFORM PROMOTION PRICING ENGINE (server truth).
 *
 * A platform promotion is ADMIN-CURATED and AUTOMATIC: it is pinned to
 * specific products through promotionProducts, and any order line whose
 * product is pinned by an active, in-window campaign gets the discount with
 * NO code and NO buyer opt-in. This is the contractual difference from
 * coupons (Task 74): a coupon is claimed, a promotion is ambient.
 *
 * Honest scope — the engine only computes discounts it can prove:
 *   percentage → value% off the promoted lines' combined subtotal
 *   fixed      → ৳value off the promoted lines' combined subtotal, once
 * bogo / bundle / free_shipping are REJECTED at creation time (they need
 * quantity or shipping semantics the pricing engine does not own) — the
 * platform never ships a label it cannot compute.
 *
 * Stack order (drill-proven in scripts/qa/t100-e2e.mjs):
 *   goods subtotal → promotion discount (this file) → coupon discount →
 *   + shipping = order.totalAmount.
 *
 * Platform-funded: supplier subOrder subtotals and escrow hold FULL line
 * value — only the buyer's totalAmount shrinks.
 */

/** The shape a promotions row must carry for the engine (a tx client returns exactly this). */
export type PromotionRow = {
  id: string
  name: string
  type: string
  value: number
  minOrderAmount: number | null
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  isActive: boolean
  validFrom: Date
  validUntil: Date
}

export type PromotedLine = {
  productId: string
  totalPrice: number
}

/** Where clause for an ACTIVE, in-window campaign (used by reads and writes alike). */
export function activePromotionFilter(now: Date) {
  return {
    isActive: true,
    validFrom: { lte: now },
    validUntil: { gte: now },
  }
}

/** The raw discount a promotion takes off `promotedSubtotal` — floored at 0, never exceeding it. */
export function computePromotionDiscount(promotion: PromotionRow, promotedSubtotal: number): number {
  if (promotedSubtotal <= 0) return 0
  const raw =
    promotion.type === 'percentage'
      ? promotedSubtotal * (promotion.value / 100)
      : promotion.type === 'fixed'
        ? promotion.value
        : 0 // unsupported types compute to nothing — creation rejects them anyway
  const capped = Math.min(raw, promotion.maxDiscount ?? Number.POSITIVE_INFINITY)
  return Math.max(0, Math.min(capped, promotedSubtotal))
}

/**
 * The real resolver: given every active campaign and the order's lines,
 * returns the winning application (or null). Each campaign is scored on the
 * lines it actually pins — a campaign cannot take a percentage of lines it
 * does not own.
 */
export function resolveBestPromotionApplication(
  campaigns: Array<{ promotion: PromotionRow; pinnedProductIds: Set<string> }>,
  lines: PromotedLine[],
  now: Date
): { promotion: PromotionRow; discount: number; promotedSubtotal: number } | null {
  if (campaigns.length === 0 || lines.length === 0) return null

  let best: { promotion: PromotionRow; discount: number; promotedSubtotal: number } | null = null

  for (const { promotion, pinnedProductIds } of campaigns) {
    if (!promotion.isActive || now < promotion.validFrom || now > promotion.validUntil) continue
    if (promotion.usageLimit !== null && promotion.usedCount >= promotion.usageLimit) continue

    const pinnedLines = lines.filter((l) => pinnedProductIds.has(l.productId))
    if (pinnedLines.length === 0) continue
    const promotedSubtotal = pinnedLines.reduce((sum, l) => sum + l.totalPrice, 0)
    if (promotion.minOrderAmount !== null && promotedSubtotal < promotion.minOrderAmount) continue

    const discount = computePromotionDiscount(promotion, promotedSubtotal)
    if (discount <= 0) continue

    if (
      best === null ||
      discount > best.discount ||
      (discount === best.discount && promotion.validUntil < best.promotion.validUntil)
    ) {
      best = { promotion, discount, promotedSubtotal }
    }
  }

  return best
}

/**
 * Atomic usage claim — the updateMany re-checks the limit AT the write, so
 * concurrent orders can never overrun usageLimit (same doctrine as the
 * Task-74 coupon counter). Zero rows claimed → PromotionUsageError (409):
 * the order is refused rather than repriced behind the buyer's back.
 */
export async function claimPromotionUsage(
  tx: { promotions: { updateMany: (args: {
    where: Record<string, unknown>
    data: { usedCount: { increment: number } }
  }) => Promise<{ count: number }> } },
  promotion: PromotionRow
): Promise<void> {
  const claimed = await tx.promotions.updateMany({
    where: {
      id: promotion.id,
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
      ...(promotion.usageLimit !== null ? { usedCount: { lt: promotion.usageLimit } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  })
  if (claimed.count === 0) {
    throw new PromotionUsageError(
      `The promotion "${promotion.name}" just reached its usage limit — your order was not placed. Placing it again will price it without the promotion.`
    )
  }
}

export { PromotionUsageError }
