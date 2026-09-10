import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneOrEmail, purpose } = body

    if (!phoneOrEmail) {
      return NextResponse.json({ error: 'phoneOrEmail is required' }, { status: 400 })
    }

    if (!purpose || !['register', 'login', 'reset_password'].includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be register, login, or reset_password' }, { status: 400 })
    }

    // Find or create user
    let user = await db.users.findFirst({
      where: {
        OR: [
          { email: phoneOrEmail },
          { phone: phoneOrEmail },
        ],
      },
    })

    if (purpose === 'register' && user) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    if (purpose !== 'register' && !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Pre-registration codes are stored without a user row (userId stays null)
    const userId = user?.id || null

    // Generate 6-digit OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = crypto.createHash('sha256').update(otpCode).digest('hex')

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await db.otpCodes.create({
      data: {
        userId,
        phoneOrEmail,
        codeHash,
        purpose,
        expiresAt,
        isUsed: false,
      },
    })

    // In production, send OTP via SMS/email service
    // For dev, return the OTP in response
    return NextResponse.json({
      success: true,
      message: `OTP sent to ${phoneOrEmail}`,
      // Development only - remove in production
      otpCode,
      devCode: otpCode,
      expiresAt,
    })
  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
