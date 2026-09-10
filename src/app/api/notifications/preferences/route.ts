import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

const DEFAULT_PREFS = {
  pushOrderUpdates: true,
  pushPromotions: false,
  pushPriceDrops: true,
  pushBackInStock: true,
  pushDelivery: true,
  pushChat: true,
  pushSystem: true,
  emailOrderUpdates: true,
  emailPromotions: false,
  emailPriceDrops: true,
  emailBackInStock: true,
  emailDelivery: true,
  notificationSound: 'default',
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  digestEnabled: false,
  mentionNotify: true,
}

/**
 * GET /api/notifications/preferences
 * Fetch (or upsert-default) the user's notification preferences.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const prefs = await db.notificationPreferences.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, ...DEFAULT_PREFS },
      update: {},
    })

    return NextResponse.json({ success: true, data: prefs })
  } catch (error) {
    console.error('Notification preferences GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update one or more notification preference fields.
 * Body: Partial<NotificationPreferences>
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()

    // Whitelist allowed fields
    const allowed = [
      'pushOrderUpdates', 'pushPromotions', 'pushPriceDrops', 'pushBackInStock',
      'pushDelivery', 'pushChat', 'pushSystem',
      'emailOrderUpdates', 'emailPromotions', 'emailPriceDrops', 'emailBackInStock', 'emailDelivery',
      'notificationSound', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd',
      'digestEnabled', 'mentionNotify',
    ]

    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const updated = await db.notificationPreferences.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, ...DEFAULT_PREFS, ...updateData },
      update: updateData,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Notification preferences PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
