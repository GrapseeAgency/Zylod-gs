import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

// GET /api/profile/notifications — Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const prefs = await db.notificationPreferences.findUnique({
      where: { userId },
    })

    const data = [
      {
        title: 'Transactional',
        description: 'Order status updates, shipping alerts, and payment confirmations.',
        items: [
          { id: 'order-updates', label: 'Order Updates', enabled: prefs?.pushOrderUpdates ?? true, locked: false },
          { id: 'shipping-alerts', label: 'Shipping Alerts', enabled: prefs?.pushDelivery ?? true, locked: false },
          { id: 'payment-confirmations', label: 'Payment Confirmations', enabled: prefs?.pushChat ?? true, locked: false },
        ],
      },
      {
        title: 'Marketing',
        description: 'Promotions, bulk discounts, and new product announcements.',
        items: [
          { id: 'promotional-offers', label: 'Promotional Offers', enabled: prefs?.pushPromotions ?? false, locked: false },
          { id: 'bulk-discount-alerts', label: 'Bulk Discount Alerts', enabled: prefs?.pushPriceDrops ?? true, locked: false },
          { id: 'new-arrivals', label: 'New Arrivals', enabled: prefs?.pushBackInStock ?? true, locked: false },
        ],
      },
      {
        title: 'Critical Account',
        description: 'Notifications regarding account security, billing, and system maintenance.',
        items: [
          { id: 'push-notifications', label: 'Push Notifications (Required)', enabled: prefs?.pushSystem ?? true, locked: true },
          { id: 'email', label: 'Email (Required)', enabled: true, locked: true },
        ],
      },
    ]
    return NextResponse.json({ success: true, data, prefs })
  } catch (error) {
    console.error('Profile notifications GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleUpdate(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userId = auth.user.id

    const body = await request.json()

    // Map both flat data items or direct category objects
    const prefsMap: Record<string, boolean> = {}
    if (body.data && Array.isArray(body.data)) {
      for (const category of body.data) {
        for (const item of category.items) {
          if (!item.locked) {
            prefsMap[item.id] = item.enabled
          }
        }
      }
    } else if (body.order || body.shipping || body.promotions || body.payments || body.categories) {
      if (body.order) {
        prefsMap['order-updates'] = Boolean(body.order.push ?? body.order.email)
      }
      if (body.shipping) {
        prefsMap['shipping-alerts'] = Boolean(body.shipping.push ?? body.shipping.email)
      }
      if (body.promotions) {
        prefsMap['promotional-offers'] = Boolean(body.promotions.push ?? body.promotions.email)
      }
      if (body.payments) {
        prefsMap['payment-confirmations'] = Boolean(body.payments.push ?? body.payments.email)
      }
      if (body.categories && typeof body.categories === 'object') {
        const cats = body.categories as Record<string, any>
        if (cats.order_updates) prefsMap['order-updates'] = Boolean(cats.order_updates.push || cats.order_updates.email)
        if (cats.shipping_logistics) prefsMap['shipping-alerts'] = Boolean(cats.shipping_logistics.push || cats.shipping_logistics.email)
        if (cats.promotions) prefsMap['promotional-offers'] = Boolean(cats.promotions.push || cats.promotions.email)
        if (cats.payment_finance) prefsMap['payment-confirmations'] = Boolean(cats.payment_finance.push || cats.payment_finance.email)
      }
    }

    await db.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        pushOrderUpdates: prefsMap['order-updates'] ?? true,
        pushPromotions: prefsMap['promotional-offers'] ?? false,
        pushPriceDrops: prefsMap['bulk-discount-alerts'] ?? true,
        pushBackInStock: prefsMap['new-arrivals'] ?? true,
        pushDelivery: prefsMap['shipping-alerts'] ?? true,
        pushChat: prefsMap['payment-confirmations'] ?? true,
        pushSystem: prefsMap['push-notifications'] ?? true,
      },
      update: {
        pushOrderUpdates: prefsMap['order-updates'] ?? undefined,
        pushPromotions: prefsMap['promotional-offers'] ?? undefined,
        pushPriceDrops: prefsMap['bulk-discount-alerts'] ?? undefined,
        pushBackInStock: prefsMap['new-arrivals'] ?? undefined,
        pushDelivery: prefsMap['shipping-alerts'] ?? undefined,
        pushChat: prefsMap['payment-confirmations'] ?? undefined,
        pushSystem: prefsMap['push-notifications'] ?? undefined,
      },
    })

    return NextResponse.json({ success: true, message: 'Preferences updated successfully' })
  } catch (error) {
    console.error('Profile notifications update error:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  return handleUpdate(request)
}

export async function PATCH(request: NextRequest) {
  return handleUpdate(request)
}
