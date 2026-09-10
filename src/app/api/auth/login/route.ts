import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createSession, getClientIP } from '@/lib/auth'

/* ─── Rate limiting (in-memory) ─── */
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number | null }>()
const MAX_ATTEMPTS = 10
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes
const ATTEMPT_WINDOW = 5 * 60 * 1000 // 5 minutes

function checkRateLimit(ip: string): { allowed: boolean; lockedUntil?: number; attemptsRemaining: number } {
  const state = loginAttempts.get(ip)
  if (!state) return { allowed: true, attemptsRemaining: MAX_ATTEMPTS }

  const now = Date.now()

  if (state.lockedUntil && now < state.lockedUntil) {
    return { allowed: false, lockedUntil: state.lockedUntil, attemptsRemaining: 0 }
  }

  if (now - state.lastAttempt > ATTEMPT_WINDOW) {
    loginAttempts.delete(ip)
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS }
  }

  if (state.lockedUntil && now >= state.lockedUntil) {
    loginAttempts.delete(ip)
    return { allowed: true, attemptsRemaining: MAX_ATTEMPTS }
  }

  return { allowed: true, attemptsRemaining: MAX_ATTEMPTS - state.count }
}

function recordAttempt(ip: string, success: boolean): void {
  const state = loginAttempts.get(ip) || { count: 0, lastAttempt: 0, lockedUntil: null }
  const now = Date.now()

  if (success) {
    loginAttempts.delete(ip)
    return
  }

  if (now - state.lastAttempt > ATTEMPT_WINDOW) {
    state.count = 1
  } else {
    state.count++
  }

  state.lastAttempt = now
  state.lockedUntil = state.count >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION : null
  loginAttempts.set(ip, state)
}

/* ─── Security audit logging ─── */
function auditLog(event: string, userId: string | null, ip: string, details: Record<string, unknown>) {
  console.log(`[AUTH_AUDIT] ${new Date().toISOString()} | ${event} | user=${userId || 'anonymous'} | ip=${ip} | ${JSON.stringify(details)}`)
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)

  try {
    // Check rate limit
    const rateLimit = checkRateLimit(ip)
    if (!rateLimit.allowed) {
      auditLog('LOGIN_RATE_LIMITED', null, ip, { lockedUntil: rateLimit.lockedUntil })
      return NextResponse.json({
        error: 'Too many failed attempts. Please try again later.',
        lockedUntil: rateLimit.lockedUntil,
        code: 'RATE_LIMITED',
      }, { status: 429 })
    }

    const body = await request.json()
    const { email, phone, password } = body

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone is required' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    // Find user by email or phone
    const user = await db.users.findFirst({
      where: {
        OR: [
          { email: email?.toLowerCase() || undefined },
          { phone: phone || undefined },
        ],
      },
    })

    if (!user) {
      recordAttempt(ip, false)
      auditLog('LOGIN_USER_NOT_FOUND', null, ip, { email, phone })
      return NextResponse.json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: checkRateLimit(ip).attemptsRemaining,
      }, { status: 401 })
    }

    // Verify password with bcrypt
    if (!user.passwordHash) {
      recordAttempt(ip, false)
      auditLog('LOGIN_NO_PASSWORD', user.id, ip, { authProvider: user.authProvider })
      return NextResponse.json({
        error: 'This account uses a different login method',
        code: 'WRONG_AUTH_METHOD',
      }, { status: 401 })
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatch) {
      recordAttempt(ip, false)
      auditLog('LOGIN_WRONG_PASSWORD', user.id, ip, { email: user.email })
      const remaining = checkRateLimit(ip).attemptsRemaining
      return NextResponse.json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        attemptsRemaining: remaining,
        accountLocked: remaining === 0,
      }, { status: 401 })
    }

    if (user.accountStatus !== 'active') {
      auditLog('LOGIN_SUSPENDED_ACCOUNT', user.id, ip, { status: user.accountStatus })
      return NextResponse.json({
        error: user.accountStatus === 'banned' ? 'Account is permanently banned' : 'Account is suspended',
        code: 'ACCOUNT_SUSPENDED',
        accountStatus: user.accountStatus,
        suspension: {
          reason: user.suspensionReason || 'Your account activity requires a manual review by our security compliance team.',
          reference: user.suspensionRef || `BD-${user.id.slice(-6).toUpperCase()}`,
          suspendedAt: user.suspendedAt,
        },
      }, { status: 403 })
    }

    // Two-factor challenge — do not create a session until the code is verified
    if (user.isTwoFactorEnabled && user.twoFactorSecret) {
      auditLog('LOGIN_2FA_CHALLENGE', user.id, ip, {})
      return NextResponse.json({
        success: true,
        requires2FA: true,
        userId: user.id,
        methods: ['authenticator'],
        hasPhone: Boolean(user.phone),
        maskedPhone: user.phone ? user.phone.replace(/.(?=.{4})/g, '•') : null,
      })
    }

    // Create real session with token stored in DB
    const token = await createSession(user.id, ip, request.headers.get('user-agent') || undefined)

    // Success - reset rate limit
    recordAttempt(ip, true)
    auditLog('LOGIN_SUCCESS', user.id, ip, {
      userType: user.userType,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
    })

    return NextResponse.json({
      success: true,
      token,
      requires2FA: false,
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email,
        phone: user.phone,
        authProvider: user.authProvider,
        accountStatus: user.accountStatus,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        requires2FA: false,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    auditLog('LOGIN_ERROR', null, ip, { error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
