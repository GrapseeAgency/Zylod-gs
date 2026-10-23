import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'

/**
 * GET /api/app/settings
 * Retrieves all public system & app configuration settings grouped by category.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined

    const settings = await db.appSystemSettings.findMany({
      where: {
        isPublic: true,
        ...(category ? { category } : {}),
      },
      orderBy: { key: 'asc' },
    })

    const settingsMap = settings.reduce((acc: Record<string, string>, s) => {
      acc[s.key] = s.value
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsMap,
        list: settings,
        total: settings.length,
      },
    })
  } catch (error) {
    console.error('App settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/app/settings — ADMIN ONLY
 *
 * Writes a platform-wide system setting (e.g. min_order_bdt, maintenance
 * flag, feature toggle). These rows drive PUBLIC platform behavior, so the
 * write rail is gated to admins. Device-local preferences (image cache,
 * network timeout, biometric) are NOT server concerns — they live in the
 * client's localStorage via the useDevicePrefs hook.
 */
export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'app-settings-post', 30, 60000)
  if (!rl.ok) return rateLimitResponse(rl)

  const auth = await requireUserType(request, ['admin'])
  // requireUserType returns {authenticated:false, user:null} for NO session,
  // and {authenticated:false, user:<set>} for a session of the wrong type.
  if (!auth.authenticated) {
    const hasSession = Boolean(auth.user)
    return NextResponse.json(
      { error: hasSession ? 'Admin access required' : 'Authentication required' },
      { status: hasSession ? 403 : 401 },
    )
  }

  try {
    const body = await request.json()
    const { key, value, category = 'general', description } = body

    if (!key || typeof key !== 'string' || key.length > 128) {
      return NextResponse.json({ error: 'A valid key (1-128 chars) is required' }, { status: 400 })
    }
    if (value === undefined || value === null) {
      return NextResponse.json({ error: 'Value is required' }, { status: 400 })
    }
    if (typeof category !== 'string' || category.length > 64) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }

    const setting = await db.appSystemSettings.upsert({
      where: { key },
      update: { value: String(value), category, description: description ?? null },
      create: { key, value: String(value), category, description: description ?? null, isPublic: false },
    })

    // Audit log — platform config writes are sensitive.
    await db.auditLogs.create({
      data: {
        actorId: auth.user.id,
        action: 'app_settings_updated',
        entityType: 'appSystemSettings',
        entityId: setting.id,
        metadata: JSON.stringify({ key, value: String(value), category }),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Setting ${key} updated`,
      data: setting,
    })
  } catch (error) {
    console.error('App settings POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
