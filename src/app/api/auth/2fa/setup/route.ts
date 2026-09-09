import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { generateTOTPSecret, buildOTPAuthURI } from '@/lib/totp'
import { db } from '@/lib/db'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, method } = body

    if (!userId || !method) {
      return NextResponse.json({ error: 'User ID and method are required' }, { status: 400 })
    }
    if (!['authenticator', 'sms'].includes(method)) {
      return NextResponse.json({ error: 'Invalid 2FA method' }, { status: 400 })
    }

    const auth = await authenticateRequest(request)
    if (!auth.authenticated || !auth.user || auth.user.id !== userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const user = await db.users.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (method === 'authenticator') {
      const secret = generateTOTPSecret()
      const accountName = user.email || user.phone || user.id
      const otpauthUrl = buildOTPAuthURI(secret, accountName)

      await db.users.update({
        where: { id: userId },
        data: { twoFactorSecret: secret },
      })

      return NextResponse.json({
        success: true,
        method,
        secret,
        otpauth: otpauthUrl,
        accountName,
        message: 'Scan the QR code with your authenticator app',
      })
    }

    // SMS method
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    await db.otpCodes.create({
      data: {
        userId,
        phoneOrEmail: user.phone || user.email || '',
        codeHash,
        purpose: '2fa',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      method,
      message: 'Verification code sent to your phone',
      debug: code,
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}