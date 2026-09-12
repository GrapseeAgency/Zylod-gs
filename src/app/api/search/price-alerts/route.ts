import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/search/price-alerts
 * Lists price alerts for the user, calculating currentBestPrice from matching products in DB.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    const userId = auth.authenticated && auth.user ? auth.user.id : null

    // Get search filters saved with alert config
    const alerts = await db.searchFilters.findMany({
      where: userId ? {
        userId,
        name: { startsWith: '[ALERT]' }
      } : {
        name: { startsWith: '[ALERT]' },
        isDefault: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const data = await Promise.all(
      alerts.map(async (alert) => {
        let config: any = {}
        try { config = JSON.parse(alert.filterConfig) } catch {}

        const query = config.query || alert.name.replace('[ALERT]', '').trim()
        const targetPrice = config.targetPrice || 2500

        // Find cheapest matching product in DB
        const match = await db.products.findFirst({
          where: {
            isActive: true,
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { brand: { contains: query } }
            ]
          },
          orderBy: { basePrice: 'asc' },
          select: { basePrice: true }
        })

        const matchCount = await db.products.count({
          where: {
            isActive: true,
            OR: [
              { name: { contains: query } },
              { description: { contains: query } }
            ]
          }
        })

        return {
          id: alert.id,
          query,
          targetPrice,
          currentBestPrice: match?.basePrice || targetPrice * 1.1,
          currency: 'BDT',
          isActive: config.isActive !== false,
          matchCount,
          createdAt: alert.createdAt.toISOString()
        }
      })
    )

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Price alerts GET error:', error)
    return NextResponse.json({ error: 'Failed to load price alerts' }, { status: 500 })
  }
}

/**
 * POST /api/search/price-alerts
 * Creates a price alert backed by searchFilters table
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { query, targetPrice } = body

    if (!query || !targetPrice) {
      return NextResponse.json({ error: 'Query and targetPrice are required' }, { status: 400 })
    }

    const alert = await db.searchFilters.create({
      data: {
        userId: auth.user.id,
        name: `[ALERT] ${query.trim()}`,
        filterConfig: JSON.stringify({
          query: query.trim(),
          targetPrice: Number(targetPrice),
          isActive: true
        }),
        isDefault: false
      }
    })

    return NextResponse.json({
      success: true,
      data: alert
    })
  } catch (error) {
    console.error('Price alerts POST error:', error)
    return NextResponse.json({ error: 'Failed to create price alert' }, { status: 500 })
  }
}
