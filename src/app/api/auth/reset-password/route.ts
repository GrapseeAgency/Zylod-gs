import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { token, password, confirmPassword } = await req.json()

    if (!token || !password || !confirmPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Find valid reset token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const otpRecord = await db.otpCodes.findFirst({
      where: {
        codeHash: hashedToken,
        purpose: 'reset_password',
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    })

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Hash new password with bcrypt — must match the login route's verification
    const hashedPassword = await bcrypt.hash(password, 12)

    if (!otpRecord.userId) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Update password and mark token as used
    await db.$transaction([
      db.users.update({
        where: { id: otpRecord.userId },
        data: { passwordHash: hashedPassword }
      }),
      db.otpCodes.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      })
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Password updated successfully' 
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
