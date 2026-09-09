import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, getClientIP } from '@/lib/auth'

/**
 * POST /api/auth/google — Google sign-in / sign-up exchange.
 * Body: { googleId, email, name }
 * Links or creates the account, then issues a REAL session token
 * (stored in the sessions table so authenticateRequest accepts it).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { googleId, email, name } = body

    if (!googleId || !email) {
      return NextResponse.json({ error: 'googleId and email are required' }, { status: 400 })
    }

    // Find existing user by googleId or email
    let user = await db.users.findFirst({
      where: {
        OR: [
          { googleId },
          { email },
        ],
      },
    })

    if (!user) {
      // Create new user via Google OAuth
      user = await db.users.create({
        data: {
          userType: 'buyer',
          email,
          phone: null,
          passwordHash: null,
          authProvider: 'google',
          googleId,
          accountStatus: 'active',
          isEmailVerified: true,
          isPhoneVerified: false,
        },
      })

      // Create buyer profile
      await db.buyerProfiles.create({
        data: {
          userId: user.id,
          fullName: name || email.split('@')[0],
          businessType: 'individual',
          profileCompletionPct: 20,
          isProfileComplete: false,
        },
      })
    } else {
      // Update googleId if not set
      if (!user.googleId) {
        await db.users.update({
          where: { id: user.id },
          data: { googleId, isEmailVerified: true },
        })
      }
    }

    if (user.accountStatus !== 'active') {
      return NextResponse.json({
        error: user.accountStatus === 'banned' ? 'Account is permanently banned' : 'Account is suspended',
        code: 'ACCOUNT_SUSPENDED',
        suspension: {
          reason: user.suspensionReason || 'Your account activity requires a manual review by our security compliance team.',
          reference: user.suspensionRef || `BD-${user.id.slice(-6).toUpperCase()}`,
          suspendedAt: user.suspendedAt,
        },
      }, { status: 403 })
    }

    // Two-factor challenge — no session until the code is verified
    if (user.isTwoFactorEnabled && user.twoFactorSecret) {
      return NextResponse.json({
        success: true,
        requires2FA: true,
        userId: user.id,
        methods: ['authenticator'],
        hasPhone: Boolean(user.phone),
        maskedPhone: user.phone ? user.phone.replace(/.(?=.{4})/g, '•') : null,
      })
    }

    const token = await createSession(
      user.id,
      getClientIP(request),
      request.headers.get('user-agent') || undefined
    )

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        requires2FA: false,
      },
    })
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
