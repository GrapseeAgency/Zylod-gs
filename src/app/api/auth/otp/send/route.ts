import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  // Anti-abuse: OTP sends are expensive and target real phones/emails
  const rl = checkRateLimit(request, 'otp-send', 5, 60_000)
  if (!rl.ok) return rateLimitResponse(rl)
  try {
    const body = await request.json()
    const { phoneOrEmail, purpose } = body

    if (!phoneOrEmail) {
      return NextResponse.json({ error: 'phoneOrEmail is required' }, { status: 400 })
    }

    // t196: verify_email / verify_phone unlock Cash on Delivery for the
    // signed-in account. They REQUIRE a session and the target must be the
    // session user's own contact point — an OTP for account verification can
    // never be requested for someone else's email/phone.
    if (purpose === 'verify_email' || purpose === 'verify_phone') {
      const auth = await authenticateRequest(request)
      if (!auth.authenticated || !auth.user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      const own =
        purpose === 'verify_email'
          ? auth.user.email && auth.user.email.toLowerCase() === String(phoneOrEmail).toLowerCase()
          : auth.user.phone && auth.user.phone === String(phoneOrEmail)
      if (!own) {
        return NextResponse.json(
          { error: 'The contact point must belong to the signed-in account' },
          { status: 403 },
        )
      }
    } else if (!purpose || !['register', 'login', 'reset_password'].includes(purpose)) {
      return NextResponse.json({ error: 'purpose must be register, login, reset_password, verify_email or verify_phone' }, { status: 400 })
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
