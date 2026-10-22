import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  auditSettingsChange,
  LINKED_ACCOUNTS_LIMIT,
  parseLinkedAccounts,
  serializeLinkedAccounts,
} from '@/lib/user-settings'

/**
 * GET  /api/profile/linked-accounts — the signed-in user's real linked
 *      contact handles, stored as JSON on their userSettings row.
 *      Unset → { accounts: [], configured: false } (default, no row created).
 *      Corrupt stored JSON is treated as [] and self-heals on the next write.
 * POST /api/profile/linked-accounts — append one { provider, handle } entry.
 *      409 when 5 entries already exist or the exact provider+handle pair is
 *      already linked. Body schema is .strict() — unknown fields rejected.
 *      Every change is audit-logged.
 *
 * NOTE: these are contact-handle links (e.g. a WhatsApp number, an Instagram
 * handle) — NOT OAuth sign-in connections. The platform has no OAuth
 * account-linking flow, and this endpoint does not pretend otherwise.
 */
const linkedAccountSchema = z
  .object({
    provider: z.enum(['facebook', 'google', 'whatsapp', 'instagram']),
    handle: z.string().trim().min(1).max(100),
  })
  .strict()

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-linked-accounts', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const settings = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { linkedAccounts: true },
    })
    return NextResponse.json({
      success: true,
      data: {
        accounts: parseLinkedAccounts(settings?.linkedAccounts),
        configured: Boolean(settings),
      },
    })
  } catch (error) {
    console.error('Linked accounts GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-linked-accounts-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const parsed = linkedAccountSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return NextResponse.json(
        { error: first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body' },
        { status: 400 }
      )
    }

    const existing = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { id: true, linkedAccounts: true },
    })
    const accounts = parseLinkedAccounts(existing?.linkedAccounts)

    if (accounts.length >= LINKED_ACCOUNTS_LIMIT) {
      return NextResponse.json(
        { error: `Linked account limit reached (${LINKED_ACCOUNTS_LIMIT})` },
        { status: 409 }
      )
    }

    const duplicate = accounts.find(
      (a) => a.provider === parsed.data.provider && a.handle === parsed.data.handle
    )
    if (duplicate) {
      return NextResponse.json(
        { error: `This ${parsed.data.provider} account (${parsed.data.handle}) is already linked` },
        { status: 409 }
      )
    }

    const entry = {
      id: crypto.randomUUID(),
      provider: parsed.data.provider,
      handle: parsed.data.handle,
      linkedAt: new Date().toISOString(),
    }
    const updated = await db.userSettings.upsert({
      where: { userId: auth.user.id },
      create: {
        userId: auth.user.id,
        linkedAccounts: serializeLinkedAccounts([...accounts, entry]),
      },
      update: { linkedAccounts: serializeLinkedAccounts([...accounts, entry]) },
    })

    await auditSettingsChange(auth.user.id, updated.id, ['linkedAccounts'], {
      linkedAccountAction: 'linked',
      provider: entry.provider,
      handle: entry.handle,
    })

    return NextResponse.json(
      { success: true, data: { accounts: parseLinkedAccounts(updated.linkedAccounts) } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Linked accounts POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
