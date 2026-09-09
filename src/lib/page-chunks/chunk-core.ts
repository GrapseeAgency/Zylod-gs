// Chunk: Core — Welcome page + Home + Auth pages (loaded directly, no chunk-loader needed)
// This prevents the ChunkLoadError when navigating from onboarding to home

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_CORE = new Set([
  'welcome', 'home', 'register', 'login', 'register-buyer', 'register-supplier',
  'otp-verification', 'forgot-password', 'reset-password', 'phone-verification',
  'email-verification', 'account-suspended', 'two-factor-auth', 'backup-codes', 'account-recovery',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    'welcome': () => import('@/components/pages/welcome-page'),
    'home': () => import('@/components/pages/home-page'),
    'register': () => import('@/components/pages/register-page'),
    'login': () => import('@/components/pages/login-page'),
    'register-buyer': () => import('@/components/pages/register-buyer-page'),
    'register-supplier': () => import('@/components/pages/register-supplier-page'),
    'otp-verification': () => import('@/components/pages/otp-verification-page'),
    'forgot-password': () => import('@/components/pages/forgot-password-page'),
    'reset-password': () => import('@/components/pages/reset-password-page'),
    'phone-verification': () => import('@/components/pages/phone-verification-page'),
    'email-verification': () => import('@/components/pages/email-verification-page'),
    'account-suspended': () => import('@/components/pages/account-suspended-page'),
    'two-factor-auth': () => import('@/components/pages/two-factor-auth-page'),
    'backup-codes': () => import('@/components/pages/backup-codes-page'),
    'account-recovery': () => import('@/components/pages/account-recovery-page'),
  }
  return loadFromMap(loaders, pageId)
}
