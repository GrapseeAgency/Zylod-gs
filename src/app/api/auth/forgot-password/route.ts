import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Anti-abuse: password reset spamming is limited per IP
  const rl = checkRateLimit(req, 'forgot-password', 5, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find user by email
    const user = await db.users.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      // Don't reveal whether user exists
      return NextResponse.json({ 
        success: true, 
        message: 'If an account exists with this email, a reset link has been sent.' 
      })
    }

    // Generate reset token and store as OTP code
    const resetToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')

    await db.otpCodes.create({
      data: {
        userId: user.id,
        phoneOrEmail: email.toLowerCase(),
        codeHash: hashedToken,
        purpose: 'reset_password',
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      }
    })

    // In production, send email with reset link (the token never goes to logs)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Password reset token for ${email}: ${resetToken}`)
    }

    // SECURITY: devToken is the reset credential — never send it in a
    // production response (the real delivery channel is the email link).
    const dev = process.env.NODE_ENV !== 'production' ? { devToken: resetToken } : {}
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
      ...dev,
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
