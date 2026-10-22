import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import {
  auditSettingsChange,
  parseLinkedAccounts,
  serializeLinkedAccounts,
} from '@/lib/user-settings'

/**
 * DELETE /api/profile/linked-accounts/[id] — remove one linked contact handle
 * from the signed-in user's userSettings row by its entry id. 404 when the
 * entry does not exist. These are the user's own settings, so there is no
 * cross-user surface here: the id is only ever matched within the
 * authenticated user's own row. Every change is audit-logged.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
  }

  const rl = checkRateLimit(request, 'profile-linked-accounts-write', 30, 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { id } = await params

    const existing = await db.userSettings.findUnique({
      where: { userId: auth.user.id },
      select: { id: true, linkedAccounts: true },
    })
    const accounts = parseLinkedAccounts(existing?.linkedAccounts)
    const removed = accounts.find((a) => a.id === id)
    if (!existing || !removed) {
      return NextResponse.json({ error: 'Linked account not found' }, { status: 404 })
    }

    const remaining = accounts.filter((a) => a.id !== id)
    const updated = await db.userSettings.update({
      where: { userId: auth.user.id },
      data: { linkedAccounts: serializeLinkedAccounts(remaining) },
    })

    await auditSettingsChange(auth.user.id, updated.id, ['linkedAccounts'], {
      linkedAccountAction: 'unlinked',
      provider: removed.provider,
      handle: removed.handle,
    })

    return NextResponse.json({
      success: true,
      data: { accounts: parseLinkedAccounts(updated.linkedAccounts) },
    })
  } catch (error) {
    console.error('Linked accounts DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
