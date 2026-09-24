import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/delivery-methods — REAL delivery methods configured by the admin
 * in the `deliveryMethods` table. If the admin has configured none, this
 * honestly returns an empty list — the UI must show a real empty state,
 * never invented couriers or prices.
 */
export async function GET() {
  try {
    const methods = await db.deliveryMethods.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: methods.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        estimated_delivery: m.estimatedDelivery,
        price: m.price,
        badge: m.badge,
        badge_variant: 'default',
        icon: m.icon,
      })),
    })
  } catch (error) {
    console.error('Delivery methods GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
