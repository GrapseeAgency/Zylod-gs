import { db } from '@/lib/db'
import { sendNotification } from '@/lib/notifications'

/**
 * Event-driven price-drop evaluation (Task 138) — the PRICE mirror of
 * src/lib/stock-alerts.ts (Task 65).
 *
 * Owner doctrine: NO CRON. The stock family already evaluates inline in
 * every stock-restoring writer; the price family had WRITE rails (PDP
 * price-alert create + the alerts console) and a full-sweep engine
 * (/api/notifications/evaluate-alerts, reachable only from a buried manual
 * button) — but NOTHING evaluated a watch when the seller actually dropped
 * the price. A buyer watching a product at ৳2,000 with a ৳1,500 target
 * learned about the drop never. This evaluator closes that gap the same
 * way the stock family did: the price-changing writer calls it AFTER its
 * transaction commits, exactly like the realtime broadcast.
 *
 * Honest scope (mirrors notifyBackInStock):
 *   • Gated on the products row: active + the edit is a GENUINE decrease
 *     (newPrice < previousPrice). Increases and no-ops never notify — a
 *     "price dropped" push that is not a drop is a lie, same doctrine as
 *     "only a genuine RESTOCK completes back-in-stock watches".
 *   • Only alerts whose targetPrice >= the NEW price fire (the buyer's
 *     threshold is actually met — not merely that the seller moved).
 *   • Flip-first race guard: updateMany's status filter means a concurrent
 *     evaluator (the full sweep or another edit) can never notify the same
 *     subscriber twice.
 *   • One real notification per subscriber through the shared
 *     preference-respecting dispatcher; relatedEntityId carries the
 *     product (the Task 64 deep-link contract — the notification detail
 *     pages resolve it to the live product).
 *
 * Fire-and-forget: NEVER blocks or fails the price write it follows. Any
 * error is logged and swallowed — the price truth is already committed;
 * alerts are a courtesy rail, not a correctness rail.
 */

export function notifyPriceDrop(productId: string, previousPrice: number, newPrice: number): void {
  void (async () => {
    try {
      if (!(newPrice < previousPrice)) return

      const product = await db.products.findUnique({
        where: { id: productId },
        select: { id: true, name: true, basePrice: true, isActive: true },
      })
      // Re-read REAL persisted state — a concurrent write may have moved the
      // price again; notify against the committed truth, never the request.
      if (!product || !product.isActive) return
      if (!(product.basePrice < previousPrice)) return

      const activeAlerts = await db.priceAlerts.findMany({
        where: { productId, status: 'active', targetPrice: { gte: product.basePrice } },
        select: { id: true, userId: true, targetPrice: true },
      })
      if (activeAlerts.length === 0) return

      // Flip first — updateMany's status filter is the race guard against a
      // concurrent evaluator notifying the same subscriber twice.
      const flipped = await db.priceAlerts.updateMany({
        where: { id: { in: activeAlerts.map((a) => a.id) }, status: 'active' },
        data: {
          status: 'triggered',
          lastNotifiedAt: new Date(),
          currentPrice: product.basePrice,
        },
      })
      if (flipped.count === 0) return

      for (const alert of activeAlerts) {
        await sendNotification({
          userId: alert.userId,
          type: 'price_drop',
          title: `Price Drop Alert: ${product.name}`,
          body: `${product.name} has dropped to ৳${product.basePrice.toLocaleString()}, meeting your alert target of ৳${alert.targetPrice.toLocaleString()}.`,
          relatedEntityId: product.id,
        })
      }
    } catch (error) {
      console.error('Price-drop evaluation error:', error)
    }
  })()
}
