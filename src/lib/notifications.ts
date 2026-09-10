import { db } from '@/lib/db'

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
      },
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
  orderId: string
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
  })
}

/** Triggered on courier dispatch & tracking event */
export async function notifyDeliveryDispatch(
  userId: string,
  orderNumber: string,
  carrier: string,
  trackingNumber: string,
  orderId: string
) {
  return sendNotification({
    userId,
    type: 'delivery',
    title: `Courier In Transit: ${orderNumber}`,
    body: `Your consignment has been dispatched via ${carrier}. Consignment Waybill: ${trackingNumber}. Real-time tracking is now active.`,
    relatedEntityId: orderId,
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

/** Triggered when bKash/Bank escrow is locked */
export async function notifyEscrowDeposit(
  userId: string,
  amount: number,
  orderNumber: string,
  orderId: string
) {
  return sendNotification({
    userId,
    type: 'payment',
    title: `SafePay Escrow Locked: ৳${amount.toLocaleString()}`,
    body: `Payment of ৳${amount.toLocaleString()} for Order ${orderNumber} is secured in Zylod SafePay Escrow. Funds are protected until you verify the delivery.`,
    relatedEntityId: orderId,
  })
}
