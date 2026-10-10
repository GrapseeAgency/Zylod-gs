import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ADMIN_SETTINGS, ADMIN_SETTINGS_BY_KEY, extractSettingValue } from '@/lib/admin-settings'

/**
 * GET /api/settings/public — PUBLIC, unauthenticated settings surface.
 *
 * Real behavior (no fake data):
 * - NO auth (public by design) but rate-limited 60/min per IP.
 * - Returns ONLY registry keys with isPublic=true AND actually set in the DB.
 *   Unset keys are OMITTED entirely — honest absence, never a fabricated
 *   empty/default value. An explicitly saved empty string counts as unset.
 * - Corrupt/unparseable stored values are omitted too (they never leak out).
 * - Nothing set → settings: {} (honestly empty).
 */
export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, 'settings-public', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const publicKeys = ADMIN_SETTINGS.filter((entry) => entry.isPublic).map((entry) => entry.key)
    const rows = publicKeys.length
      ? await db.adminSettings.findMany({ where: { key: { in: publicKeys } } })
      : []

    const settings: Record<string, string | number | boolean> = {}
    const updatedAt: Record<string, string> = {}
    for (const row of rows) {
      const entry = ADMIN_SETTINGS_BY_KEY[row.key]
      if (!entry || !entry.isPublic) continue
      const value = extractSettingValue(entry, row)
      if (value === null) continue // unset (or corrupt) → honest absence
      settings[row.key] = value
      updatedAt[row.key] = row.updatedAt.toISOString()
    }

    return NextResponse.json({
      success: true,
      data: { settings, updatedAt },
    })
  } catch (error) {
    console.error('Public settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
