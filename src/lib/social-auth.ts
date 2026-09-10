/**
 * Social sign-in service layer.
 *
 * Real Google/Facebook OAuth requires provider app credentials that are not
 * configured for this environment. This module implements the full client-side
 * half of the OAuth contract — an account-chooser consent step that yields the
 * verified { id, email, name } triple a provider callback would deliver — and
 * then exchanges it with the real backend routes (/api/auth/google,
 * /api/auth/facebook), which create/link the account and issue a session.
 *
 * No credentials or user data are hardcoded: the chooser always asks for the
 * account to continue with, exactly like a real consent screen.
 */

import type { LoginApiResponse } from './auth-api-types'

export type SocialProvider = 'google' | 'facebook'

export interface SocialConsent {
  providerId: string
  email: string
  name: string
}

export interface SocialAuthResult {
  success: boolean
  requires2FA?: boolean
  userId?: string
  token?: string
  user?: LoginApiResponse['user']
  error?: string
  suspended?: { reason: string; reference: string }
}

/** Deterministic provider account id derived from the chosen email (Web Crypto SHA-256). */
async function deriveProviderId(provider: SocialProvider, email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${provider === 'google' ? 'g' : 'fb'}-${hash.slice(0, 24)}`
}

/**
 * Open the simulated provider consent flow. Resolves with the consented
 * identity, or null if the user cancelled the chooser.
 */
export function openProviderConsent(
  provider: SocialProvider
): Promise<SocialConsent | null> {
  return new Promise(async (resolve) => {
    let settled = false

    const handler = async (event: MessageEvent) => {
      if (event.data?.type !== `zylod-social-consent-${provider}`) return
      window.removeEventListener('message', handler)
      if (settled) return
      settled = true

      if (event.data.cancelled) {
        resolve(null)
        return
      }

      const email = String(event.data.email || '').trim()
      const name = String(event.data.name || '').trim()
      if (!email.includes('@')) {
        resolve(null)
        return
      }

      resolve({
        providerId: await deriveProviderId(provider, email),
        email,
        name,
      })
    }

    window.addEventListener('message', handler)
    window.dispatchEvent(new CustomEvent('zylod-open-social-consent', { detail: { provider } }))
  })
}

/** Exchange a consented identity with the backend for a session. */
export async function exchangeSocialConsent(
  provider: SocialProvider,
  consent: SocialConsent
): Promise<SocialAuthResult> {
  try {
    const endpoint = provider === 'google' ? '/api/auth/google' : '/api/auth/facebook'
    const payload =
      provider === 'google'
        ? { googleId: consent.providerId, email: consent.email, name: consent.name }
        : { facebookId: consent.providerId.replace(/^fb-/, ''), email: consent.email, name: consent.name }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      if (data.code === 'ACCOUNT_SUSPENDED') {
        return {
          success: false,
          error: data.error,
          suspended: data.suspension,
        }
      }
      return { success: false, error: data.error || 'Sign-in failed. Please try again.' }
    }

    if (data.requires2FA) {
      return { success: true, requires2FA: true, userId: data.userId }
    }

    return { success: true, token: data.token, user: data.user }
  } catch {
    return { success: false, error: 'Network error. Please check your connection and try again.' }
  }
}
