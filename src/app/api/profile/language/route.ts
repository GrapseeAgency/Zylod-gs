import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { auditSettingsChange } from '@/lib/user-settings'

/**
 * GET   /api/profile/language — the signed-in user's persisted interface language.
 *       Unset → { language: 'bn', configured: false } (default, no row created).
 * PATCH /api/profile/language — Zod-validated upsert of { language }.
 *       Only 'bn' | 'en' are backed by the platform today. Body schema is
 *       .strict() — unknown fields are rejected with the verbatim Zod message.
 *       Every change is audit-logged.
 */
const languageSchema = z.object({ language: z.enum(['bn', 'en']) }).strict()

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-language', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const settings = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { language: true },
    })
    return NextResponse.json({
      success: true,
      data: { language: settings?.language ?? 'bn', configured: Boolean(settings) },
    })
  } catch (error) {
    console.error('Profile language GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-language-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = languageSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }

    const row = await db.userSettings.upsert({
      where: { userId: auth.user.id },
      create: { userId: auth.user.id, language: parsed.data.language },
      update: { language: parsed.data.language },
    })

    await auditSettingsChange(auth.user.id, row.id, ['language'], { language: parsed.data.language })

    return NextResponse.json({ success: true, data: { language: row.language, configured: true } })
  } catch (error) {
    console.error('Profile language PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
