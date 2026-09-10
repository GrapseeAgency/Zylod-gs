import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

/**
 * GET /api/profile/settings — Composite user settings from DB.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const [user, prefs] = await Promise.all([
      db.users.findUnique({
        where: { id: userId },
        select: { isTwoFactorEnabled: true, email: true, phone: true, authProvider: true },
      }),
      db.notificationPreferences.findUnique({ where: { userId } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        notifications: {
          email: true,
          push: prefs?.pushSystem ?? true,
          sms: false,
          orderUpdates: prefs?.pushOrderUpdates ?? true,
          priceAlerts: prefs?.pushPriceDrops ?? true,
          promotions: prefs?.pushPromotions ?? false,
        },
        privacy: {
          profileVisible: true,
          showEmail: false,
          showPhone: false,
          showBusinessName: true,
        },
        twoFactorEnabled: user?.isTwoFactorEnabled || false,
        linkedAccounts: [
          {
            provider: 'google',
            connected: user?.authProvider === 'google',
            email: user?.authProvider === 'google' ? user.email : null,
          },
        ],
      },
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}