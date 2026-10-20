/**
 * Task 100 — thrown when a promotion's usage limit is consumed between the
 * pricing read and the atomic claim write. The order is refused with 409 and
 * the buyer is told exactly what happened: re-placing prices WITHOUT the
 * promotion. Never silently repriced — the receipt a buyer confirmed is the
 * receipt they pay.
 */
export class PromotionUsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PromotionUsageError'
  }
}
