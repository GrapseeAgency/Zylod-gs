import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { auditSettingsChange } from '@/lib/user-settings'

/**
 * GET   /api/profile/theme — the signed-in user's persisted theme.
 *       Unset → { theme: 'system', configured: false } (default, no row created).
 * PATCH /api/profile/theme — Zod-validated upsert of { theme }.
 *       Body schema is .strict() — unknown fields are rejected with the
 *       verbatim Zod message. Every change is audit-logged.
 */
const themeSchema = z.object({ theme: z.enum(['system', 'light', 'dark']) }).strict()

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-theme', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const settings = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { theme: true },
    })
    return NextResponse.json({
      success: true,
      data: { theme: settings?.theme ?? 'system', configured: Boolean(settings) },
    })
  } catch (error) {
    console.error('Profile theme GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-theme-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = themeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }

    const row = await db.userSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, theme: parsed.data.theme },
      update: { theme: parsed.data.theme },
    })

    await auditSettingsChange(auth.user.id, row.id, ['theme'], { theme: parsed.data.theme })

    return NextResponse.json({ success: true, data: { theme: row.theme, configured: true } })
  } catch (error) {
    console.error('Profile theme PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
