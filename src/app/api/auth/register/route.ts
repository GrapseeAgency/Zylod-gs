import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession, getClientIP } from '@/lib/auth'

/* ─── Rate limiting for registration ─── */
const registerAttempts = new Map<string, { count: number; lastAttempt: number }>()
const MAX_REGISTER_ATTEMPTS = 5
const REGISTER_WINDOW = 60 * 60 * 1000 // 1 hour

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    // Rate limit registration attempts
    const state = registerAttempts.get(ip) || { count: 0, lastAttempt: 0 }
    const now = Date.now()

    if (now - state.lastAttempt > REGISTER_WINDOW) {
      state.count = 0
    }

    if (state.count >= MAX_REGISTER_ATTEMPTS) {
      console.log(`[AUTH_AUDIT] REGISTER_RATE_LIMITED | ip=${ip}`)
      return NextResponse.json({
        error: 'Too many registration attempts. Please try again later.',
        code: 'RATE_LIMITED',
      }, { status: 429 })
    }

    const body = await request.json()
    const { userType, email, phone, password, authProvider, fullName, businessName, businessType,
      nidNumber, nidFrontImageUrl, nidBackImageUrl, tradeLicenseNumber, tradeLicenseImageUrl,
      tinNumber, bankName, bankAccountName, bankAccountNumber, branch, city } = body

    if (!userType || !authProvider) {
      return NextResponse.json({ error: 'userType and authProvider are required' }, { status: 400 })
    }

    if (!['buyer', 'supplier', 'admin'].includes(userType)) {
      return NextResponse.json({ error: 'Invalid userType. Must be buyer, supplier, or admin' }, { status: 400 })
    }

    if (!['phone_otp', 'google', 'email'].includes(authProvider)) {
      return NextResponse.json({ error: 'Invalid authProvider. Must be phone_otp, google, or email' }, { status: 400 })
    }

    // Password strength validation
    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' }, { status: 400 })
      }

      const weakPasswords = ['password', '12345678', 'qwerty123', 'password123', 'admin123', 'letmein123']
      if (weakPasswords.includes(password.toLowerCase())) {
        return NextResponse.json({ error: 'This password is too common. Choose a stronger one.', code: 'WEAK_PASSWORD' }, { status: 400 })
      }
    }

    // Check for duplicate email
    if (email) {
      const existing = await db.users.findUnique({ where: { email: email.toLowerCase() } })
      if (existing) {
        return NextResponse.json({ error: 'Email already registered', code: 'DUPLICATE_EMAIL' }, { status: 409 })
      }
    }

    // Check for duplicate phone
    if (phone) {
      const existing = await db.users.findUnique({ where: { phone } })
      if (existing) {
        return NextResponse.json({ error: 'Phone already registered', code: 'DUPLICATE_PHONE' }, { status: 409 })
      }
    }

    // Hash password with bcrypt (12 rounds)
    const passwordHash = password ? await bcrypt.hash(password, 12) : null

    const user = await db.users.create({
      data: {
        userType,
        email: email ? email.toLowerCase() : null,
        phone: phone || null,
        passwordHash,
        authProvider,
        accountStatus: 'active',
        isEmailVerified: authProvider === 'google',
        isPhoneVerified: authProvider === 'phone_otp',
      },
    })

    // Create buyer profile if userType is buyer
    if (userType === 'buyer') {
      await db.buyerProfiles.create({
        data: {
          userId: user.id,
          fullName: fullName || '',
          businessName: businessName || null,
          businessType: businessType || 'individual',
          profileCompletionPct: 10,
          isProfileComplete: false,
        },
      })
    }

    // Create supplier profile if userType is supplier
    if (userType === 'supplier') {
      await db.supplierProfiles.create({
        data: {
          userId: user.id,
          companyName: businessName || '',
          nidNumber: nidNumber || '',
          nidFrontImageUrl: nidFrontImageUrl || '',
          nidBackImageUrl: nidBackImageUrl || '',
          tradeLicenseNumber: tradeLicenseNumber || '',
          tradeLicenseImageUrl: tradeLicenseImageUrl || '',
          tinNumber: tinNumber || '',
          bankAccountName: bankAccountName || '',
          bankAccountNumber: bankAccountNumber || '',
          bankName: bankName || '',
          branch: branch || '',
          verificationStatus: 'pending',
        },
      })
    }

    // Create real session token stored in DB
    const token = await createSession(user.id, ip, request.headers.get('user-agent') || undefined)

    // Update rate limit
    state.count++
    state.lastAttempt = now
    registerAttempts.set(ip, state)

    console.log(`[AUTH_AUDIT] REGISTER_SUCCESS | user=${user.id} | ip=${ip} | type=${userType}`)

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        fullName: fullName || null,
        businessName: businessName || null,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
