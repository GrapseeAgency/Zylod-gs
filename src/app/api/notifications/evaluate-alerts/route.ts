import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { notifyPriceDropTriggered, notifyRestockTriggered } from '@/lib/notifications'

/**
 * POST & GET /api/notifications/evaluate-alerts
 * Background engine: Evaluates all active priceAlerts and stockAlerts against live products in DB.
 * Automatically dispatches real notifications and updates alert status when triggered.
 *
 * Signed-in only: this sweep evaluates EVERY user's alerts, so an anonymous
 * caller must not be able to fire it (GET previously had no auth and no
 * limit at all), and the per-trigger log line used to embed the alerted
 * user's email address — other users' PII leaked to whoever ran the sweep.
 * The response now carries non-PII attribution only.
 */
async function requireSignedIn(request: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(request)
  return auth.authenticated && !!auth.user
}

export async function POST(request: NextRequest) {
  if (!(await requireSignedIn(request))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const rl = checkRateLimit(request, 'evaluate-alerts', 10, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  return evaluateAlerts()
}

export async function GET(request: NextRequest) {
  if (!(await requireSignedIn(request))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
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

    // 1. Evaluate Active Price Alerts (no user join — the response must not
    // carry other users' emails to whoever triggers the sweep)
    const activePriceAlerts = await db.priceAlerts.findMany({
      where: { status: 'active' },
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
          results.notificationsSent.push(`PriceDrop: ${product.name}`)
        }
      }
    }

    // 2. Evaluate Active Stock Alerts
    const activeStockAlerts = await db.stockAlerts.findMany({
      where: { status: 'active' },
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
          results.notificationsSent.push(`Restock: ${product.name}`)
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
