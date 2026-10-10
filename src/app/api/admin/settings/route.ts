import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserType } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ADMIN_SETTINGS, serializeAdminSetting } from '@/lib/admin-settings'

/**
 * GET /api/admin/settings — list every KNOWN admin setting (ADMIN ONLY).
 *
 * Real behavior (no fake data):
 * - Auth is checked FIRST (401 before any query work).
 * - The response covers EVERY key in the registry (src/lib/admin-settings.ts)
 *   — the registry is the whitelist, so unknown keys can never exist.
 * - Unset keys are reported honestly as value: null; the defaultValue shown
 *   next to them is what the real consumer uses until an admin saves a value.
 *   A default is NEVER rendered as if it were a stored value.
 * - For text settings an explicitly saved empty string also means "not set".
 */
export async function GET(request: NextRequest) {
  const auth = await requireUserType(request, ['admin'])
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Admin authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'admin-settings-list', 60, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const rows = await db.adminSettings.findMany()
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    const settings = ADMIN_SETTINGS.map((entry) => serializeAdminSetting(entry, rowByKey.get(entry.key) ?? null))

    return NextResponse.json({
      success: true,
      data: {
        settings,
        dataNotes: [
          'Unset keys are reported as null — the built-in default shown next to them is what the real consumer uses until an admin saves a value. Defaults are never rendered as if they were stored.',
          'For text settings, saving an empty string also means "not set" — the public settings endpoint omits unset keys entirely.',
          'Every change is audit-logged (action "setting_updated") with the acting admin id — the actor comes from the session, never from the client.',
          'The buyer return-filing window is enforced against real delivered tracking events only (orderTracking.status = "delivered"); with no delivered event the window is not enforced, because no delivery date is ever invented.',
        ],
      },
    })
  } catch (error) {
    console.error('Admin settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
