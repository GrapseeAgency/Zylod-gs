import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Brute-force guard: code guessing is limited per IP
  const rl = checkRateLimit(request, 'otp-verify', 10, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const body = await request.json()
    const { phoneOrEmail, code } = body

    if (!phoneOrEmail || !code) {
      return NextResponse.json({ error: 'phoneOrEmail and code are required' }, { status: 400 })
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex')

    // Find the OTP record
    const otpRecord = await db.otpCodes.findFirst({
      where: {
        phoneOrEmail,
        codeHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })
    }

    // Mark OTP as used
    await db.otpCodes.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    })

    // Find user
    const user = await db.users.findFirst({
      where: {
        OR: [
          { email: phoneOrEmail },
          { phone: phoneOrEmail },
        ],
      },
    })

    if (user) {
      // Update verification status
      if (phoneOrEmail.includes('@')) {
        await db.users.update({ where: { id: user.id }, data: { isEmailVerified: true } })
      } else {
        await db.users.update({ where: { id: user.id }, data: { isPhoneVerified: true } })
      }

      // For a verified reset_password OTP, mint a fresh single-use reset token
      // so the client can proceed to /api/auth/reset-password safely.
      if (otpRecord.purpose === 'reset_password') {
        const resetToken = crypto.randomBytes(32).toString('hex')
        const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex')

        await db.otpCodes.create({
          data: {
            userId: user.id,
            phoneOrEmail,
            codeHash: hashedResetToken,
            purpose: 'reset_password',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            isUsed: false,
          },
        })

        return NextResponse.json({
          success: true,
          verified: true,
          resetToken,
          user: {
            id: user.id,
            userType: user.userType,
            email: user.email,
            phone: user.phone,
          },
        })
      }

      const token = crypto.randomBytes(32).toString('hex')

      return NextResponse.json({
        success: true,
        verified: true,
        token,
        user: {
          id: user.id,
          userType: user.userType,
          email: user.email,
          phone: user.phone,
          authProvider: user.authProvider,
          accountStatus: user.accountStatus,
        },
      })
    }

    return NextResponse.json({
      success: true,
      verified: true,
      message: 'OTP verified. Proceed with registration.',
    })
  } catch (error) {
    console.error('OTP verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
