// Chunk: Profile — Profile/settings/account management and wallet/finance pages

import type { PageLoadResult } from './types'
import { loadFromMap } from './types'

export const CHUNK_PROFILE = new Set([
  'profile', 'my-profile', 'edit-profile', 'profile-photo', 'account-settings', 'profile-settings',
  'notification-preferences',
  'seller-profile', 'admin-profile', 'staff-profile', 'buyer-profile',
  // Pages 93–100
  'privacy-settings', 'language-settings', 'theme-settings',
  'linked-accounts', 'delete-account', 'account-verification-badge', 'business-profile',
  'tax-information',
  // Pages 101–120 Wallet & Finance
  'my-wallet', 'wallet', 'balance-overview', 'add-money',
  'withdraw-money', 'transaction-history', 'transaction-detail', 'bank-accounts',
  'add-bank-account', 'upi-payment-setup', 'credit-debit-cards', 'add-card',
  'payment-history', 'payment-pending', 'payment-failed', 'refund-to-wallet',
  'earnings-dashboard', 'commission-history', 'invoice-management', 'credit-score', 'credit-limit',
])

export async function loadChunkPage(pageId: string): Promise<PageLoadResult> {
  const loaders: Record<string, () => Promise<any>> = {
    'profile': () => import('@/components/pages/profile-page'),
    'my-profile': () => import('@/components/pages/profile-page'),
    'seller-profile': () => import('@/components/pages/seller-profile-page'),
    'admin-profile': () => import('@/components/pages/admin-profile-page'),
    'staff-profile': () => import('@/components/pages/staff-profile-page'),
    'buyer-profile': () => import('@/components/pages/buyer-profile-page'),
    'edit-profile': () => import('@/components/pages/edit-profile-page'),
    'profile-photo': () => import('@/components/pages/profile-photo-page'),
    'account-settings': () => import('@/components/pages/account-settings-page'),
    'profile-settings': () => import('@/components/pages/account-settings-page'),
    'notification-preferences': () => import('@/components/pages/notification-preferences-page'),
    // Pages 93–100 Dedicated Component Loaders
    'privacy-settings': () => import('@/components/pages/privacy-settings-page'),
    'language-settings': () => import('@/components/pages/language-settings-page'),
    'theme-settings': () => import('@/components/pages/theme-settings-page'),
    'linked-accounts': () => import('@/components/pages/linked-accounts-page'),
    'delete-account': () => import('@/components/pages/delete-account-page'),
    'account-verification-badge': () => import('@/components/pages/account-verification-badge-page'),
    'business-profile': () => import('@/components/pages/business-profile-page'),
    'tax-information': () => import('@/components/pages/tax-information-page'),
    // Pages 101–120 Wallet & Finance Component Loaders
    'my-wallet': () => import('@/components/pages/my-wallet-page'),
    'wallet': () => import('@/components/pages/my-wallet-page'),
    'balance-overview': () => import('@/components/pages/balance-overview-page'),
    'add-money': () => import('@/components/pages/add-money-page'),
    'withdraw-money': () => import('@/components/pages/withdraw-money-page'),
    'transaction-history': () => import('@/components/pages/transaction-history-page'),
    'transaction-detail': () => import('@/components/pages/transaction-detail-page'),
    'bank-accounts': () => import('@/components/pages/bank-accounts-page'),
    'add-bank-account': () => import('@/components/pages/add-bank-account-page'),
    'upi-payment-setup': () => import('@/components/pages/upi-payment-setup-page'),
    'credit-debit-cards': () => import('@/components/pages/credit-debit-cards-page'),
    'add-card': () => import('@/components/pages/add-card-page'),
    'payment-history': () => import('@/components/pages/payment-history-page'),
    'payment-pending': () => import('@/components/pages/payment-pending-page'),
    'payment-failed': () => import('@/components/pages/payment-failed-page'),
    'refund-to-wallet': () => import('@/components/pages/refund-to-wallet-page'),
    'earnings-dashboard': () => import('@/components/pages/earnings-dashboard-page'),
    'commission-history': () => import('@/components/pages/commission-history-page'),
    'invoice-management': () => import('@/components/pages/invoice-management-page'),
    'credit-score': () => import('@/components/pages/credit-score-page'),
    'credit-limit': () => import('@/components/pages/credit-limit-page'),
  }
  return loadFromMap(loaders, pageId)
}
