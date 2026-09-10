import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email, method } = await req.json()

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!method || !['identity', 'security-team'].includes(method)) {
      return NextResponse.json({ error: 'Valid recovery method is required' }, { status: 400 })
    }

    // Find user by email
    const user = await db.users.findFirst({
      where: { email: email.toLowerCase().trim() }
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, recovery instructions have been sent.'
      })
    }

    // Generate recovery token
    const recoveryToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(recoveryToken).digest('hex')

    // Store recovery request
    await db.otpCodes.create({
      data: {
        userId: user.id,
        phoneOrEmail: email.toLowerCase().trim(),
        codeHash: hashedToken,
        purpose: 'account_recovery',
        expiresAt: new Date(Date.now() + 86400000) // 24 hours
      }
    })

    // In production, send email with recovery instructions
    console.log(`Account recovery token for ${email}: ${recoveryToken} (method: ${method})`)

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, recovery instructions have been sent.',
      devToken: recoveryToken
    })
  } catch (error) {
    console.error('Account recovery error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
