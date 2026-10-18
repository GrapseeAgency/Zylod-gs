import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { parseLinkedAccounts } from '@/lib/user-settings'

/**
 * GET /api/profile/settings — Composite user settings from DB.
 *
 * The notifications and 2FA sections are read from their real models
 * (notificationPreferences / users). The privacy + linkedAccounts sections
 * are backed by the userSettings row (Task 52-c) — unset values report their
 * platform defaults instead of previously hardcoded fabrications. No row is
 * created by this read.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const userId = auth.user.id
    const [user, prefs, settings] = await Promise.all([
      db.users.findUnique({
        where: { id: userId },
        select: { isTwoFactorEnabled: true, email: true, phone: true, authProvider: true, createdAt: true },
      }),
      db.notificationPreferences.findUnique({ where: { userId } }),
      db.userSettings.findUnique({ where: { userId } }),
    ])

    const storedAccounts = parseLinkedAccounts(settings?.linkedAccounts)

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
          profileVisible: (settings?.profileVisibility ?? 'public') !== 'private',
          showEmail: settings?.showEmail ?? false,
          showPhone: settings?.showPhone ?? false,
        },
        twoFactorEnabled: user?.isTwoFactorEnabled || false,
        linkedAccounts: [
          // Real SSO state: the provider the account actually authenticates with.
          ...(user?.authProvider === 'google'
            ? [{ provider: 'google', handle: user.email ?? '', linkedAt: user.createdAt.toISOString() }]
            : []),
          // Real stored contact handles (userSettings.linkedAccounts).
          ...storedAccounts.map((a) => ({ provider: a.provider, handle: a.handle, linkedAt: a.linkedAt })),
        ],
      },
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
