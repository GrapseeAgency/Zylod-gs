/**
 * THE CERTIFICATION TRUST RAIL — shared server helpers (Task 92).
 *
 * The productCertifications table is the platform's ONLY honest source of
 * compliance claims. These helpers keep the status vocabulary and the
 * per-product cap in ONE place so the public read rail, the seller write
 * rail and any future admin reviewer all speak the same truth:
 *
 *   - 'active'        — no expiry on file, or expiry in the future beyond
 *                       the 30-day window.
 *   - 'expiring_soon' — expiresAt within the next 30 days (a warning the
 *                       buyer deserves to see BEFORE the bulk order).
 *   - 'expired'       — expiresAt in the past. Never hidden: an expired
 *                       certificate ships with its expired badge, because
 *                       silently dropping it would be a softer lie.
 */

export const CERTIFICATION_CAP = 12
export const CERTIFICATION_EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type CertificationStatus = 'active' | 'expiring_soon' | 'expired'

/** Server-computed honest status — the single source of truth for badges. */
export function certificationStatus(
  expiresAt: Date | null,
  now: Date = new Date()
): CertificationStatus {
  if (!expiresAt) return 'active'
  if (expiresAt.getTime() <= now.getTime()) return 'expired'
  if (expiresAt.getTime() - now.getTime() <= CERTIFICATION_EXPIRING_WINDOW_MS) return 'expiring_soon'
  return 'active'
}

/** Server-side shape used by every response that serves a certification row. */
export function shapeCertification(c: {
  id: string
  certName: string
  certNumber: string | null
  issuedBy: string
  issuedAt: Date
  expiresAt: Date | null
  documentUrl: string | null
}) {
  return {
    id: c.id,
    certName: c.certName,
    certNumber: c.certNumber,
    issuedBy: c.issuedBy,
    issuedAt: c.issuedAt.toISOString(),
    expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
    documentUrl: c.documentUrl,
    status: certificationStatus(c.expiresAt),
  }
}
