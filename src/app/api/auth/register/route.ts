import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession, getClientIP, setAuthCookie } from '@/lib/auth'
import { invalidateCacheKeys } from '@/lib/api-cache'

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

    /* ─── Admin bootstrap gate (privilege-escalation guard) ───
     * Open registration must never mint administrators. An admin account can
     * only be created while the platform has ZERO admins (first-admin
     * bootstrap), or — after that — only by presenting ADMIN_BOOTSTRAP_SECRET
     * from the environment. Every denial is audit-logged. */
    if (userType === 'admin') {
      const adminCount = await db.users.count({ where: { userType: 'admin' } })
      const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET
      const secretProvided =
        typeof body.adminBootstrapSecret === 'string' ? body.adminBootstrapSecret : undefined
      const secretValid =
        !!bootstrapSecret && !!secretProvided && secretProvided === bootstrapSecret
      if (adminCount > 0 && !secretValid) {
        console.log(
          `[AUTH_AUDIT] ADMIN_REGISTER_DENIED | ip=${ip} | reason=${adminCount > 0 ? 'admins_exist' : 'no_secret_configured'}`
        )
        return NextResponse.json(
          {
            error:
              adminCount > 0
                ? 'Admin registration is closed. Ask an existing administrator to provision staff accounts.'
                : 'Admin bootstrap requires ADMIN_BOOTSTRAP_SECRET to be configured on the server.',
            code: 'ADMIN_REGISTRATION_CLOSED',
          },
          { status: 403 }
        )
      }
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
      // Task 113 fix: a new supplier must be visible to the public list the
      // moment the row exists — the cached 'suppliers:list:' entries were
      // only invalidated on KYC decisions, so a fresh profile stayed
      // invisible (and stale cached ids leaked across database lifetimes).
      invalidateCacheKeys('suppliers:list:')
    }

    // Create real session token stored in DB
    const token = await createSession(user.id, ip, request.headers.get('user-agent') || undefined)

    // Update rate limit
    state.count++
    state.lastAttempt = now
    registerAttempts.set(ip, state)

    console.log(`[AUTH_AUDIT] REGISTER_SUCCESS | user=${user.id} | ip=${ip} | type=${userType}`)

    const response = NextResponse.json({
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
    // Session cookie so the freshly-registered user is signed in for
    // credentials:'include' UI fetches.
    setAuthCookie(response, token)
    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
