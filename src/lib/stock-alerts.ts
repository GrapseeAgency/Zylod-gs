import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications'

/**
 * Event-driven back-in-stock evaluation.
 *
 * Owner doctrine: NO CRON. There is no background poller anywhere in the
 * platform; instead every stock-restoring writer (buyer cancel, admin force
 * cancel, seller return receipt, seller inventory edit, product edit) calls
 * this AFTER its transaction commits, exactly like the realtime broadcast.
 *
 * What it does, from REAL persisted state only:
 *   1. Re-reads the product — a concurrent write may have already drained it
 *      again; nothing is notified unless the row is active with stock > 0.
 *   2. Flips every ACTIVE stockAlerts row for that product to 'notified'.
 *   3. Persists one real back_in_stock notification per subscriber through
 *      the shared dispatcher (which already honours per-user preferences —
 *      opted-out users simply receive no notification row).
 *
 * Fire-and-forget: this NEVER blocks or fails the stock write it follows.
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
        where: { productId, status: 'active' },
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
