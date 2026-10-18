import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { auditSettingsChange } from '@/lib/user-settings'

/**
 * GET   /api/profile/privacy — the signed-in user's persisted privacy settings.
 *       Unset → { profileVisibility: 'public', showEmail: false, showPhone: false,
 *       configured: false } (defaults, no row created).
 * PATCH /api/profile/privacy — Zod-validated upsert. All three fields are
 *       optional but at least one is required. Body schema is .strict() —
 *       unknown fields are rejected with the verbatim Zod message.
 *       Every change is audit-logged.
 */
const privacySchema = z
  .object({
    profileVisibility: z.enum(['public', 'buyers', 'private']).optional(),
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one of profileVisibility, showEmail, or showPhone is required',
  })

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-privacy', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const settings = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { profileVisibility: true, showEmail: true, showPhone: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        profileVisibility: settings?.profileVisibility ?? 'public',
        showEmail: settings?.showEmail ?? false,
        showPhone: settings?.showPhone ?? false,
        configured: Boolean(settings),
      },
    })
  } catch (error) {
    console.error('Profile privacy GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-privacy', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = privacySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }

    const row = await db.userSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, ...parsed.data },
      update: { ...parsed.data },
    })

    await auditSettingsChange(auth.user.id, row.id, Object.keys(parsed.data), { ...parsed.data })

    return NextResponse.json({
      success: true,
      data: {
        profileVisibility: row.profileVisibility,
        showEmail: row.showEmail,
        showPhone: row.showPhone,
        configured: true,
      },
    })
  } catch (error) {
    console.error('Profile privacy PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
