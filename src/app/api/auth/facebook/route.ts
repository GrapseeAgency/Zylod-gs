import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

/**
 * POST /api/auth/facebook — Facebook sign-in / sign-up exchange.
 * Body: { facebookId, email, name }
 * Mirrors the Google route: links or creates the account, then returns a session token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { facebookId, email, name } = body

    if (!facebookId || !email) {
      return NextResponse.json({ error: 'facebookId and email are required' }, { status: 400 })
    }

    // Find existing user by facebookId or email
    let user = await db.users.findFirst({
      where: {
        OR: [
          { googleId: `fb:${facebookId}` },
          { email },
        ],
      },
    })

    if (!user) {
      // Create new user via Facebook OAuth
      user = await db.users.create({
        data: {
          userType: 'buyer',
          email,
          phone: null,
          passwordHash: null,
          authProvider: 'google',
          googleId: `fb:${facebookId}`,
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
    } else if (!user.googleId) {
      await db.users.update({
        where: { id: user.id },
        data: { googleId: `fb:${facebookId}`, isEmailVerified: true },
      })
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

    const token = crypto.randomBytes(48).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    await db.sessions.create({
      data: {
        userId: user.id,
        tokenHash,
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        deviceInfo: request.headers.get('user-agent') || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

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
        requires2FA: user.isTwoFactorEnabled && Boolean(user.twoFactorSecret),
      },
    })
  } catch (error) {
    console.error('Facebook auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
