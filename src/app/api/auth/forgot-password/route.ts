import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
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

    // In production, send email with reset link
    console.log(`Password reset token for ${email}: ${resetToken}`)

    return NextResponse.json({ 
      success: true, 
      message: 'If an account exists with this email, a reset link has been sent.',
      devToken: resetToken 
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
