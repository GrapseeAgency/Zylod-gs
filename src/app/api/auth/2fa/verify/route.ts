import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyTOTPCode } from '@/lib/totp'
import { db } from '@/lib/db'
import { createSession, getClientIP } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, code, method } = body

    if (!userId || !code) {
      return NextResponse.json({ error: 'User ID and verification code are required' }, { status: 400 })
    }

    const user = await db.users.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (user.accountStatus !== 'active') {
      return NextResponse.json({
        error: 'Account is suspended',
        code: 'ACCOUNT_SUSPENDED',
        accountStatus: user.accountStatus,
        suspension: {
          reason: user.suspensionReason || 'Your account activity requires a manual review by our security compliance team.',
          reference: user.suspensionRef || `BD-${user.id.slice(-6).toUpperCase()}`,
          suspendedAt: user.suspendedAt,
        },
      }, { status: 403 })
    }

    const verificationMethod = method || 'authenticator'

    if (verificationMethod === 'authenticator') {
      if (!user.twoFactorSecret) {
        return NextResponse.json({ error: '2FA not set up. Please run setup first.' }, { status: 400 })
      }
      if (!verifyTOTPCode(user.twoFactorSecret, code)) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }

      if (!user.isTwoFactorEnabled) {
        await db.users.update({
          where: { id: userId },
          data: { isTwoFactorEnabled: true },
        })
      }
    } else {
      // SMS method
      const codeHash = crypto.createHash('sha256').update(code).digest('hex')
      const otp = await db.otpCodes.findFirst({
        where: {
          userId,
          codeHash,
          purpose: '2fa',
          isUsed: false,
          expiresAt: { gt: new Date() },
        },
      })

      if (!otp) {
        return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
      }

      await db.otpCodes.update({
        where: { id: otp.id },
        data: { isUsed: true },
      })

      if (!user.isTwoFactorEnabled) {
        await db.users.update({
          where: { id: userId },
          data: { isTwoFactorEnabled: true },
        })
      }
    }

    // Issue a real session so a 2FA login challenge can complete end-to-end
    const ip = getClientIP(request)
    const token = await createSession(user.id, ip, request.headers.get('user-agent') || undefined)

    return NextResponse.json({
      success: true,
      message: '2FA verification successful',
      token,
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    })
  } catch (error) {
    console.error('2FA verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}