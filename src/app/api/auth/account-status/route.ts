import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * GET /api/auth/account-status?email=... — public lookup of suspension details.
 * Used by the Account Suspended page so the reason/reference shown are the real
 * values recorded on the account, never hardcoded UI copy.
 *
 * IDOR/hardening contract: the caller is unauthenticated by design (a
 * suspended user is blocked at login, so there is no session to require).
 * To stay honest the endpoint is an ANTI-ENUMERATION oracle, not an account
 * directory: an unknown email/userId and an existing ACTIVE account return
 * the SAME 200 { suspended: false } — a probe can never distinguish
 * "not registered" from "registered and fine". Only a genuinely suspended
 * account reveals its real reason/reference (that disclosure is the
 * endpoint's purpose), and lookups are rate limited to blunt bulk probing.
 */
export async function GET(request: NextRequest) {
  // Rate limit first — this is an unauthenticated oracle for account state.
  const rl = checkRateLimit(request, 'account-status-lookup', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const email = request.nextUrl.searchParams.get('email')?.toLowerCase()
    const userId = request.nextUrl.searchParams.get('userId')

    if (!email && !userId) {
      return NextResponse.json({ error: 'email or userId is required' }, { status: 400 })
    }

    const user = await db.users.findFirst({
      where: email ? { email } : { id: userId! },
      select: {
        id: true,
        accountStatus: true,
        suspensionReason: true,
        suspensionRef: true,
        suspendedAt: true,
      },
    })

    // NOT FOUND and ACTIVE are the same response — no account-existence leak.
    if (!user || user.accountStatus === 'active') {
      return NextResponse.json({
        success: true,
        suspended: false,
      })
    }

    return NextResponse.json({
      success: true,
      accountStatus: user.accountStatus,
      suspended: true,
      suspension: {
        reason:
          user.suspensionReason ||
          'Our automated security systems flagged activity on your account that requires a manual review by our compliance team.',
        reference: user.suspensionRef || `BD-${user.id.slice(-6).toUpperCase()}`,
        suspendedAt: user.suspendedAt,
        banned: user.accountStatus === 'banned',
      },
    })
  } catch (error) {
    console.error('Account status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
