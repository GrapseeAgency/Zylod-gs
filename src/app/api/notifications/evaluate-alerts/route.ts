import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyPriceDropTriggered, notifyRestockTriggered } from '@/lib/notifications'

/**
 * POST & GET /api/notifications/evaluate-alerts
 * Background engine: Evaluates all active priceAlerts and stockAlerts against live products in DB.
 * Automatically dispatches real notifications and updates alert status when triggered.
 */
export async function POST(request: NextRequest) {
  return evaluateAlerts()
}

export async function GET(request: NextRequest) {
  return evaluateAlerts()
}

async function evaluateAlerts() {
  try {
    const results = {
      priceAlertsChecked: 0,
      priceAlertsTriggered: 0,
      stockAlertsChecked: 0,
      stockAlertsTriggered: 0,
      notificationsSent: [] as string[],
    }

    // 1. Evaluate Active Price Alerts
    const activePriceAlerts = await db.priceAlerts.findMany({
      where: { status: 'active' },
      include: { user: { select: { id: true, email: true } } },
    })

    results.priceAlertsChecked = activePriceAlerts.length

    for (const alert of activePriceAlerts) {
      const product = await db.products.findUnique({
        where: { id: alert.productId },
        select: { id: true, name: true, basePrice: true, isActive: true },
      })

      if (product && product.isActive && product.basePrice <= alert.targetPrice) {
        // Trigger condition met!
        await db.priceAlerts.update({
          where: { id: alert.id },
          data: {
            status: 'triggered',
            lastNotifiedAt: new Date(),
            currentPrice: product.basePrice,
          },
        })

        const notif = await notifyPriceDropTriggered(
          alert.userId,
          product.id,
          product.name,
          product.basePrice,
          alert.targetPrice
        )

        if (notif) {
          results.priceAlertsTriggered++
          results.notificationsSent.push(`PriceDrop: ${product.name} -> User ${alert.user.email}`)
        }
      }
    }

    // 2. Evaluate Active Stock Alerts
    const activeStockAlerts = await db.stockAlerts.findMany({
      where: { status: 'active' },
      include: { user: { select: { id: true, email: true } } },
    })

    results.stockAlertsChecked = activeStockAlerts.length

    for (const alert of activeStockAlerts) {
      const product = await db.products.findUnique({
        where: { id: alert.productId },
        select: { id: true, name: true, stockQuantity: true, isActive: true },
      })

      if (product && product.isActive && product.stockQuantity > 0) {
        // Restock occurred!
        await db.stockAlerts.update({
          where: { id: alert.id },
          data: {
            status: 'notified',
            lastNotifiedAt: new Date(),
          },
        })

        const notif = await notifyRestockTriggered(
          alert.userId,
          product.id,
          product.name,
          product.stockQuantity
        )

        if (notif) {
          results.stockAlertsTriggered++
          results.notificationsSent.push(`Restock: ${product.name} -> User ${alert.user.email}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: results,
    })
  } catch (error) {
    console.error('Evaluate alerts engine error:', error)
    return NextResponse.json({ error: 'Failed to evaluate alerts' }, { status: 500 })
  }
}
