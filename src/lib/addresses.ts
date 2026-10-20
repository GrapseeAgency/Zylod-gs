/**
 * Task 87 — the shipping-address history rail.
 *
 * `addresses` rows are user-deletable, and orders.shippingAddressId is a
 * SetNull FK. Without a snapshot, deleting an address book entry would
 * silently rewrite a REAL order's shipping history (courier disputes,
 * returns and invoice PDFs all read it). Every order-creation path
 * (POST /api/orders, POST /api/orders/create-direct, POST
 * /api/rfq/[id]/convert-order) stores this immutable copy at order time;
 * the order-detail read falls back to it when the live relation is gone.
 */
import type { addresses } from '@prisma/client'

/** The address fields an order needs to remember, frozen as JSON text. */
export function buildAddressSnapshot(a: addresses): string {
  return JSON.stringify({
    label: a.label,
    companyName: a.companyName,
    contactName: a.contactName,
    contactPhone: a.contactPhone,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    district: a.district,
    postalCode: a.postalCode,
    country: a.country,
    capturedAt: new Date().toISOString(),
  })
}

/** Honest parse — a corrupt/missing snapshot yields null, never fabricated fields. */
export function parseAddressSnapshot(raw: string | null | undefined): Record<string, string | null> | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    return p
  } catch {
    return null
  }
}
