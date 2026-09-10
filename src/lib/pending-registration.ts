/**
 * Pending registration store — carries the in-progress registration payload
 * (name, business name, password) from the register form through OTP verification
 * to final account creation. Backed by sessionStorage so the data survives page
 * navigation but never persists beyond the tab session.
 */

export interface PendingRegistration {
  userType: 'buyer' | 'supplier'
  fullName: string
  businessName?: string
  businessType?: string
  city?: string
  email?: string
  phone?: string
  password: string
  // Supplier KYC fields
  nidNumber?: string
  nidFrontImageUrl?: string
  nidBackImageUrl?: string
  tradeLicenseNumber?: string
  tradeLicenseImageUrl?: string
  tinNumber?: string
  bankName?: string
  bankAccountName?: string
  bankAccountNumber?: string
  branch?: string
}

const KEY = 'zylod-pending-registration'

export function setPendingRegistration(data: PendingRegistration): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable — flow will fall back to nav params */
  }
}

export function getPendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingRegistration
  } catch {
    return null
  }
}

export function clearPendingRegistration(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
