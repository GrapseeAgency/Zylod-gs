import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

/* ─── Session Token Management ─── */

const SESSION_DURATION_HOURS = 24 * 7 // 7 days

export interface AuthUser {
  id: string
  userType: string
  email: string | null
  phone: string | null
  accountStatus: string
  isEmailVerified: boolean
  isPhoneVerified: boolean
}

export interface AuthResult {
  authenticated: boolean
  user: AuthUser | null
  error?: string
}

/* ─── Hash token for storage ─── */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/* ─── Create a new session ─── */
export async function createSession(
  userId: string,
  ip?: string,
  deviceInfo?: string
): Promise<string> {
  const token = crypto.randomBytes(48).toString('hex')
  const tokenHash = hashToken(token)

  await db.sessions.create({
    data: {
      userId,
      tokenHash,
      ip: ip || null,
      deviceInfo: deviceInfo || null,
      expiresAt: new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000),
    },
  })

  return token
}

/* ─── Validate a session token ─── */
export async function validateSession(token: string): Promise<AuthResult> {
  if (!token) {
    return { authenticated: false, user: null, error: 'No token provided' }
  }

  const tokenHash = hashToken(token)

  const session = await db.sessions.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          userType: true,
          email: true,
          phone: true,
          accountStatus: true,
          isEmailVerified: true,
          isPhoneVerified: true,
        },
      },
    },
  })

  if (!session) {
    return { authenticated: false, user: null, error: 'Invalid session' }
  }

  // Check expiration
  if (new Date() > session.expiresAt) {
    // Clean up expired session
    await db.sessions.delete({ where: { id: session.id } }).catch(() => {})
    return { authenticated: false, user: null, error: 'Session expired' }
  }

  // Check account status
  if (session.user.accountStatus !== 'active') {
    return { authenticated: false, user: null, error: 'Account suspended' }
  }

  return { authenticated: true, user: session.user as AuthUser }
}

/* ─── Destroy a session (logout) ─── */
export async function destroySession(token: string): Promise<void> {
  if (!token) return
  const tokenHash = hashToken(token)
  await db.sessions.deleteMany({ where: { tokenHash } }).catch(() => {})
}

/* ─── Clean up expired sessions ─── */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.sessions.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}

/* ─── Extract Bearer token from request ─── */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Also check cookie
  const token = request.cookies.get('auth-token')?.value
  if (token) return token

  return null
}

/* ─── Authenticate a request (main middleware) ─── */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const token = extractToken(request)
  if (!token) {
    return { authenticated: false, user: null, error: 'Authentication required' }
  }
  return validateSession(token)
}

/* ─── Require specific user type ─── */
export async function requireUserType(
  request: NextRequest,
  allowedTypes: string[]
): Promise<AuthResult> {
  const result = await authenticateRequest(request)
  if (!result.authenticated || !result.user) {
    return result
  }

  if (!allowedTypes.includes(result.user.userType)) {
    return {
      authenticated: false,
      user: result.user,
      error: `Access denied. Required: ${allowedTypes.join(' or ')}`,
    }
  }

  return result
}

/* ─── Get client IP ─── */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
