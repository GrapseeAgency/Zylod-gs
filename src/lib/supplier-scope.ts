import { db } from '@/lib/db'
import type { AuthUser } from '@/lib/auth'

/**
 * Resolve the signed-in user's supplier profile for seller-scoped endpoints.
 *
 * Campaign convention (Task 50-b): every /api/supplier/* route authenticates
 * with requireUserType, then scopes ALL reads/writes to this profile row.
 * A session without a real supplierProfile gets an honest 403 — we never
 * fabricate a profile or fall back to another supplier's rows.
 */
export async function resolveSupplierProfile(user: AuthUser) {
  return db.supplierProfiles.findUnique({
    where: { userId: user.id },
  })
}

/** Standard honest 403 for sessions without a supplier profile. */
export const SUPPLIER_PROFILE_REQUIRED = {
  error: 'Supplier profile required. Only registered suppliers can access seller data.',
}
