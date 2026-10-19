import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications'

/**
 * Event-driven back-in-stock evaluation.
 *
 * Owner doctrine: NO CRON. There is no background poller anywhere in the
 * platform; instead every stock-restoring writer (buyer cancel, admin force
 * cancel, seller return receipt, seller inventory edit, product edit) calls
 * the matching evaluator AFTER its transaction commits, exactly like the
 * realtime broadcast.
 *
 * Task 65 — two honest scopes:
 *   • notifyBackInStock(productId)            → completes PRODUCT-level watches
 *     only (variantId null). Gated on the products row: active + stock > 0.
 *   • notifyVariantBackInStock(productId, id) → completes watches for THAT
 *     exact variant only. Gated on the productVariants row: stock > 0 (and
 *     the parent product still active — an inactive listing has nothing to
 *     buy, so a "restocked" push would be a lie).
 *
 * A variant restock alone never completes product-level watches while the
 * products row still reads 0 — the PDP shows out of stock in that state and
 * the push would contradict the page. The products row itself only moves
 * through the product-level paths, which call the product evaluator.
 *
 * Both evaluators: re-read REAL persisted state (a concurrent write may have
 * drained the stock again), flip via updateMany whose status filter is the
 * race guard against double-notify, then persist one real notification per
 * subscriber through the shared preference-respecting dispatcher.
 *
 * Fire-and-forget: they NEVER block or fail the stock write they follow.
 * Any error is logged and swallowed — the stock truth is already committed;
 * alerts are a courtesy rail, not a correctness rail.
 */

export function notifyBackInStock(productId: string): void {
  void (async () => {
    try {
      const product = await db.products.findUnique({
        where: { id: productId },
        select: { id: true, name: true, stockQuantity: true, isActive: true },
      })
      if (!product || !product.isActive || product.stockQuantity <= 0) return

      const activeAlerts = await db.stockAlerts.findMany({
        where: { productId, status: 'active', variantId: null },
        select: { id: true, userId: true },
      })
      if (activeAlerts.length === 0) return

      // Flip first — updateMany's status filter is the race guard against a
      // concurrent evaluator notifying the same subscriber twice.
      const flipped = await db.stockAlerts.updateMany({
        where: { id: { in: activeAlerts.map((a) => a.id) }, status: 'active' },
        data: { status: 'notified', lastNotifiedAt: new Date() },
      })
      if (flipped.count === 0) return

      for (const alert of activeAlerts) {
        await sendNotification({
          userId: alert.userId,
          type: 'back_in_stock',
          title: `Restocked: ${product.name}`,
          body: `${product.name} is back in stock with ${product.stockQuantity} units ready for immediate wholesale order dispatch.`,
          relatedEntityId: product.id,
        })
      }
    } catch (error) {
      console.error('Back-in-stock evaluation error:', error)
    }
  })()
}

export function notifyVariantBackInStock(productId: string, variantId: string): void {
  void (async () => {
    try {
      const [product, variant] = await Promise.all([
        db.products.findUnique({
          where: { id: productId },
          select: { id: true, name: true, isActive: true },
        }),
        db.productVariants.findUnique({
          where: { id: variantId },
          select: { id: true, productId: true, variantName: true, variantValue: true, stockQuantity: true },
        }),
      ])
      if (!product || !product.isActive) return
      if (!variant || variant.stockQuantity <= 0) return
      if (variant.productId !== productId) return

      const label = `${variant.variantName}: ${variant.variantValue}`.replace(/\s+/g, ' ').trim()

      const activeAlerts = await db.stockAlerts.findMany({
        where: { productId, variantId, status: 'active' },
        select: { id: true, userId: true },
      })
      if (activeAlerts.length === 0) return

      // Same race guard as the product evaluator — the status filter in the
      // flip means a concurrent evaluator can never notify a subscriber twice.
      const flipped = await db.stockAlerts.updateMany({
        where: { id: { in: activeAlerts.map((a) => a.id) }, status: 'active' },
        data: { status: 'notified', lastNotifiedAt: new Date() },
      })
      if (flipped.count === 0) return

      for (const alert of activeAlerts) {
        await sendNotification({
          userId: alert.userId,
          type: 'back_in_stock',
          title: `Restocked: ${product.name} — ${label}`,
          body: `${label} of ${product.name} is back in stock with ${variant.stockQuantity} units ready for immediate wholesale order dispatch.`,
          relatedEntityId: product.id,
        })
      }
    } catch (error) {
      console.error('Variant back-in-stock evaluation error:', error)
    }
  })()
}
