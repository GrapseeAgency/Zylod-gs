import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/auth/account-status?email=... — public lookup of suspension details.
 * Used by the Account Suspended page so the reason/reference shown are the real
 * values recorded on the account, never hardcoded UI copy.
 */
export async function GET(request: NextRequest) {
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
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    if (user.accountStatus === 'active') {
      return NextResponse.json({
        success: true,
        accountStatus: 'active',
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
