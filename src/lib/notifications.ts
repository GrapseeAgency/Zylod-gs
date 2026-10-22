import { db } from '@/lib/db'
import { broadcastToRoom } from '@/lib/realtime-broadcast'

export type NotificationType =
  | 'order'
  | 'delivery'
  | 'price_drop'
  | 'back_in_stock'
  | 'promotion'
  | 'system'
  | 'chat'
  | 'payment'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  relatedEntityId?: string | null
  /** Task 66: the exact subOrder (shipment) this notification is about. */
  relatedShipmentId?: string | null
  /** Task 68-c: the exact payments row this notification is about. */
  relatedPaymentId?: string | null
}

/**
 * Central Notification Dispatcher.
 * Automatically checks user notification preferences before persisting.
 */
export async function sendNotification({
  userId,
  type,
  title,
  body,
  relatedEntityId = null,
  relatedShipmentId = null,
  relatedPaymentId = null,
}: CreateNotificationParams) {
  try {
    // Check user preferences if exists
    const prefs = await db.notificationPreferences.findUnique({
      where: { userId },
    })

    // If quiet hours enabled and in range, still persist but can tag silent
    if (prefs) {
      if (type === 'promotion' && prefs.pushPromotions === false && prefs.emailPromotions === false) {
        // User opted out of marketing promos
        return null
      }
      if (type === 'price_drop' && prefs.pushPriceDrops === false && prefs.emailPriceDrops === false) {
        return null
      }
      if (type === 'back_in_stock' && prefs.pushBackInStock === false && prefs.emailBackInStock === false) {
        return null
      }
    }

    // Persist real notification to PostgreSQL DB
    const notif = await db.notifications.create({
      data: {
        userId,
        type,
        title,
        body,
        isRead: false,
        relatedEntityId: relatedEntityId || null,
        relatedShipmentId: relatedShipmentId || null,
        relatedPaymentId: relatedPaymentId || null,
      },
    })

    // Task 62: push the REAL persisted row into the recipient's private
    // user:<id> room — every notification source in the platform (order
    // milestones, payments, back-in-stock, system) becomes live the moment
    // it is persisted. Fire-and-forget; the DB row is already the truth.
    void broadcastToRoom(`user:${userId}`, 'notification:new', {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      message: notif.body,
      isRead: notif.isRead,
      relatedId: notif.relatedEntityId,
      relatedShipmentId: notif.relatedShipmentId,
      relatedPaymentId: notif.relatedPaymentId,
      timestamp: notif.createdAt.toISOString(),
    })

    return notif
  } catch (error) {
    console.error('sendNotification error:', error)
    return null
  }
}

/** Triggered when order status changes (confirmed, packed, dispatched, delivered) */
export async function notifyOrderMilestone(
  userId: string,
  orderNumber: string,
  status: string,
  orderId: string,
  /** Task 66: set when the milestone is a PER-SHIPMENT event. */
  shipmentId?: string | null
) {
  const statusMessages: Record<string, { title: string; body: string }> = {
    confirmed: {
      title: `Order ${orderNumber} Confirmed`,
      body: `Supplier has acknowledged your wholesale order ${orderNumber} and started manufacturing/packaging.`,
    },
    packed: {
      title: `Order ${orderNumber} Packed & QC Passed`,
      body: `Your wholesale consignment ${orderNumber} has passed factory quality control and is prepared for carrier pickup.`,
    },
    shipped: {
      title: `Order ${orderNumber} Dispatched`,
      body: `Your wholesale order ${orderNumber} has been handed to the courier and is in transit.`,
    },
    delivered: {
      title: `Order ${orderNumber} Delivered`,
      body: `Order ${orderNumber} has arrived at your warehouse. You have 48 hours to inspect carton counts before SafePay Escrow is released.`,
    },
    cancelled: {
      title: `Order ${orderNumber} Cancelled`,
      body: `Wholesale order ${orderNumber} was cancelled. 100% of escrow funds have been refunded to your Zylod Wallet.`,
    },
  }

  const msg = statusMessages[status.toLowerCase()] || {
    title: `Order ${orderNumber} Update`,
    body: `Your order ${orderNumber} status changed to ${status}.`,
  }

  return sendNotification({
    userId,
    type: 'order',
    title: msg.title,
    body: msg.body,
    relatedEntityId: orderId,
    relatedShipmentId: shipmentId ?? null,
  })
}

/** Triggered on courier dispatch & tracking event */
export async function notifyDeliveryDispatch(
  userId: string,
  orderNumber: string,
  carrier: string,
  trackingNumber: string,
  orderId: string,
  /** Task 66: the shipment this consignment belongs to. */
  shipmentId?: string | null
) {
  return sendNotification({
    userId,
    type: 'delivery',
    title: `Courier In Transit: ${orderNumber}`,
    body: `Your consignment has been dispatched via ${carrier}. Consignment Waybill: ${trackingNumber}. Real-time tracking is now active.`,
    relatedEntityId: orderId,
    relatedShipmentId: shipmentId ?? null,
  })
}

/** Triggered when a price alert condition is met */
export async function notifyPriceDropTriggered(
  userId: string,
  productId: string,
  productName: string,
  currentPrice: number,
  targetPrice: number
) {
  return sendNotification({
    userId,
    type: 'price_drop',
    title: `Price Drop Alert: ${productName}`,
    body: `Great news! ${productName} has dropped to ৳${currentPrice.toLocaleString()}, meeting your alert target of ৳${targetPrice.toLocaleString()}.`,
    relatedEntityId: productId,
  })
}

/** Triggered when restock occurs on a watched item */
export async function notifyRestockTriggered(
  userId: string,
  productId: string,
  productName: string,
  unitsAvailable: number
) {
  return sendNotification({
    userId,
    type: 'back_in_stock',
    title: `Restocked: ${productName}`,
    body: `${productName} is back in stock with ${unitsAvailable} units ready for immediate wholesale order dispatch.`,
    relatedEntityId: productId,
  })
}

/**
 * Task 68-c — REAL payment notifications to the BUYER. Before this, the
 * manual payment leg (submit → verify/reject) sent room broadcasts only:
 * the buyer got a bell tick ONLY if they happened to have the order page
 * open at that exact moment, and their notifications page never showed any
 * payment event. These helpers persist real rows (via sendNotification) so
 * the whole live loop — bell, list, deep-link — works like every other
 * notification family. relatedEntityId carries the ORDER (the Task 64
 * deep-link contract), relatedPaymentId the exact payments row.
 */

/** Buyer submitted payment credentials — verification pending. */
export async function notifyPaymentSubmitted(
  userId: string,
  orderNumber: string,
  orderId: string,
  paymentId: string,
  amount: number,
  method: string
) {
  return sendNotification({
    userId,
    type: 'payment',
    title: `Payment Submitted: ${orderNumber}`,
    body: `Your ${method.replace('_', ' ')} payment reference for ৳${amount.toLocaleString()} on order ${orderNumber} was received and is now PENDING VERIFICATION. Every order stays unpaid until its payment is verified.`,
    relatedEntityId: orderId,
    relatedPaymentId: paymentId,
  })
}

/**
 * Durable seller-side signal for a new order (Task 159 cohesion fix): the
 * order:create socket push to seller:<supplierId> is transient — a seller
 * who wasn't online never saw the order arrive. This persists a row so the
 * seller's notification list records every new order slice, socket or not.
 */
export async function notifySellerNewOrder(
  sellerUserId: string,
  orderNumber: string,
  orderId: string,
  itemCount: number,
  subtotal: number
) {
  return sendNotification({
    userId: sellerUserId,
    type: 'order',
    title: `New Order: ${orderNumber}`,
    body: `${itemCount} item(s) · ৳${subtotal.toLocaleString()} — order ${orderNumber} arrived and is UNPAID. It becomes actionable once the buyer's payment is verified.`,
    relatedEntityId: orderId,
  })
}

/**
 * Durable admin-side signal for a new order (Task 159 cohesion fix, admin
 * half): admins run the payment-verification gate for every manual payment —
 * a plain UNPAID order previously produced NO admin signal at all (socket or
 * row). Every admin now gets one row so the verification console's queue is
 * discoverable without polling.
 */
export async function notifyAdminNewOrder(
  adminUserId: string,
  orderNumber: string,
  orderId: string,
  itemCount: number,
  total: number
) {
  return sendNotification({
    userId: adminUserId,
    type: 'order',
    title: `Order Awaiting Verification: ${orderNumber}`,
    body: `${itemCount} item(s) · ৳${total.toLocaleString()} — order ${orderNumber} was placed and is UNPAID. Verify the buyer's submitted payment to unlock processing.`,
    relatedEntityId: orderId,
  })
}

/** Seller/admin verified the payment — honest partial math spelled out. */
export async function notifyPaymentVerified(
  userId: string,
  orderNumber: string,
  orderId: string,
  paymentId: string,
  amountPaid: number,
  orderTotal: number,
  orderPaymentStatus: string
) {
  const partial = orderPaymentStatus === 'partial'
  return sendNotification({
    userId,
    type: 'payment',
    title: partial
      ? `Payment Partially Verified: ${orderNumber}`
      : `Payment Verified: ${orderNumber}`,
    body: partial
      ? `৳${amountPaid.toLocaleString()} of ৳${orderTotal.toLocaleString()} verified for order ${orderNumber}. The order stays PARTIALLY PAID — submit the remaining balance to unlock processing.`
      : `৳${amountPaid.toLocaleString()} verified for order ${orderNumber}. The order is now PAID and the supplier can start processing.`,
    relatedEntityId: orderId,
    relatedPaymentId: paymentId,
  })
}

/** Seller/admin rejected the submitted credentials. */
export async function notifyPaymentRejected(
  userId: string,
  orderNumber: string,
  orderId: string,
  paymentId: string,
  note: string | null
) {
  return sendNotification({
    userId,
    type: 'payment',
    title: `Payment Rejected: ${orderNumber}`,
    body: `The payment reference you submitted for order ${orderNumber} could not be verified and was rejected${note ? ` — "${note}"` : ''}. The order remains unpaid; submit a correct reference or contact support.`,
    relatedEntityId: orderId,
    relatedPaymentId: paymentId,
  })
}
