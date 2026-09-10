/**
 * Shared response types for the auth API surface.
 * Kept in one module so pages and service layers stay in sync with the routes.
 */

export interface AuthUserPayload {
  id: string
  userType: string
  email: string | null
  phone: string | null
  authProvider?: string
  accountStatus?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  requires2FA?: boolean
}

export interface LoginApiResponse {
  success?: boolean
  token?: string
  user?: AuthUserPayload
  /** Present when the account has 2FA enabled — session is withheld until verified. */
  requires2FA?: boolean
  userId?: string
  methods?: string[]
  hasPhone?: boolean
  maskedPhone?: string | null
  accountStatus?: string
  error?: string
  code?: string
  suspension?: {
    reason: string
    reference: string
    suspendedAt?: string | null
    banned?: boolean
  }
}
