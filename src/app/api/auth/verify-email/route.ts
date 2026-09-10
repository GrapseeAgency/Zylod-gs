import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

/**
 * GET /api/auth/verify-email?email=... — poll whether the address is verified.
 * Used by the Email Verification page to detect when the user has clicked the link.
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')?.toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const user = await db.users.findFirst({
      where: { email },
      select: { id: true, isEmailVerified: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      email,
      isEmailVerified: user.isEmailVerified,
    })
  } catch (error) {
    console.error('Email verification status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await db.users.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email already verified' 
      })
    }

    // Generate verification token
    const verifyToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(verifyToken).digest('hex')

    await db.otpCodes.create({
      data: {
        userId: user.id,
        phoneOrEmail: email.toLowerCase(),
        codeHash: hashedToken,
        purpose: 'email_verify',
        expiresAt: new Date(Date.now() + 86400000) // 24 hours
      }
    })

    // In production, send verification email
    console.log(`Email verification token for ${email}: ${verifyToken}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Verification email sent',
      devToken: verifyToken
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Verify email with token
export async function PUT(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    
    const otpRecord = await db.otpCodes.findFirst({
      where: {
        codeHash: hashedToken,
        purpose: 'email_verify',
        isUsed: false,
        expiresAt: { gt: new Date() }
      }
    })

    if (!otpRecord || !otpRecord.userId) {
      return NextResponse.json({ error: 'Invalid or expired verification token' }, { status: 400 })
    }

    await db.$transaction([
      db.users.update({
        where: { id: otpRecord.userId },
        data: { isEmailVerified: true }
      }),
      db.otpCodes.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      })
    ])

    return NextResponse.json({ 
      success: true, 
      message: 'Email verified successfully' 
    })
  } catch (error) {
    console.error('Email verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
