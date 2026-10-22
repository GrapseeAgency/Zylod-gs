import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'auth-phone-verify', 5, 900000)
  if (!rl.ok) return rateLimitResponse(rl)

  try {
    const { phone, countryCode } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const fullPhone = `${countryCode || '+880'}${phone}`

    // Find user by phone
    const user = await db.users.findFirst({
      where: { phone: fullPhone }
    })

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

    // Store OTP
    await db.otpCodes.create({
      data: {
        userId: user?.id || 'anonymous',
        phoneOrEmail: fullPhone,
        codeHash: hashedOtp,
        purpose: 'phone_verify',
        expiresAt: new Date(Date.now() + 300000) // 5 minutes
      }
    })

    // In production, send SMS with OTP
    console.log(`Phone verification OTP for ${fullPhone}: ${otp}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      devOtp: otp
    })
  } catch (error) {
    console.error('Phone verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
