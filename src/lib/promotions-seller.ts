import { z } from 'zod'
import { SUPPORTED_PROMOTION_TYPES } from './promotions-admin'

/**
 * Task 115 — SELLER CAMPAIGN CONTRACT (shared by the seller rail's POST and
 * PATCH so the two routes can never drift).
 *
 * A seller campaign is a row on the SAME promotions table the platform
 * engine prices — with supplierId set. It has REAL pricing teeth:
 * SELLER-FUNDED, the discount reduces that supplier's own subOrder subtotal
 * at checkout. The engine (src/lib/promotions.ts) computes exactly
 * percentage and fixed — bogo / bundle / free_shipping are refused at this
 * boundary with the real reason (the platform never ships a discount label
 * it cannot compute), exactly as the admin rail does.
 *
 * Standing rules honored here:
 *  - usageLimit 0 → UNLIMITED (null); minOrderAmount 0 → NO FLOOR (null).
 *  - PATCH is HAND-BUILT, never derived from the defaulted create schema
 *    via .partial() — under .partial() a .default() fires on ABSENT keys
 *    and silently overwrites real rows (the Task 111 money-printer lesson).
 *  - Pinning: at least one product, and every pinned product must be the
 *    supplier's OWN, ACTIVE, APPROVED product (validated at the route with
 *    distinguishable phantom/foreign/unavailable refusals).
 */

const typeField = z.enum(SUPPORTED_PROMOTION_TYPES, {
  message:
    "Unknown campaign type — the pricing engine computes 'percentage' and 'fixed' only; bogo, bundle and free_shipping are not supported",
})

export const sellerCampaignObject = z
  .object({
    name: z.string().trim().min(1, 'Campaign name is required').max(120),
    type: typeField,
    value: z.coerce.number().positive('Discount value must be greater than zero'),
    maxDiscount: z.coerce.number().min(0).nullable().optional(),
    // NOTE: no .default() here — the POST path applies its defaults in
    // normalizeSellerCampaignInput; PATCH only ever touches keys that
    // actually arrived (hand-built patch schema below).
    minOrderAmount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    isActive: z.boolean().optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    bannerImageUrl: z.string().trim().max(500).optional().nullable(),
    productIds: z.array(z.string().min(1)).min(1, 'Pin at least one of your products to this campaign'),
  })
  .strict()

export const sellerCampaignCreateSchema = sellerCampaignObject
  .refine((v) => v.validUntil > v.validFrom, {
    message: 'End date must be after the start date',
    path: ['validUntil'],
  })
  .refine((v) => v.type !== 'percentage' || v.value <= 100, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['value'],
  })

/**
 * PATCH schema — hand-built, optional keys only, NO defaults anywhere.
 * An empty body yields every key undefined and the route answers
 * 400 'No fields to update' (the standing rule from the Task 111 drill).
 */
export const sellerCampaignPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Campaign name is required').max(120).optional(),
    type: typeField.optional(),
    value: z.coerce.number().positive('Discount value must be greater than zero').optional(),
    maxDiscount: z.coerce.number().min(0).nullable().optional(),
    minOrderAmount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    bannerImageUrl: z.string().trim().max(500).nullable().optional(),
    productIds: z.array(z.string().min(1)).min(1, 'Pin at least one of your products to this campaign').optional(),
  })
  .strict()
  .refine(
    (v) => !(v.validFrom && v.validUntil && v.validUntil <= v.validFrom),
    { message: 'End date must be after the start date', path: ['validUntil'] }
  )
  .refine((v) => v.type !== 'percentage' || v.value === undefined || v.value <= 100, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['value'],
  })
// Window consistency when only ONE side of the date pair moves (validFrom
// arriving without validUntil) is checked at the route against the row's
// stored counterpart — the schema alone cannot see the stored half.

export type SellerCampaignInput = z.infer<typeof sellerCampaignCreateSchema>
export type SellerCampaignPatch = z.infer<typeof sellerCampaignPatchSchema>

/** POST-path normalizations + defaults (mirrors the admin normalize). */
export function normalizeSellerCampaignInput(d: SellerCampaignInput) {
  return {
    name: d.name,
    type: d.type,
    value: d.value,
    maxDiscount: d.maxDiscount ?? null,
    minOrderAmount: (d.minOrderAmount ?? 0) > 0 ? d.minOrderAmount : null,
    usageLimit: (d.usageLimit ?? 0) > 0 ? d.usageLimit : null,
    validFrom: d.validFrom,
    validUntil: d.validUntil,
    isActive: d.isActive ?? false,
    description: d.description ?? null,
    bannerImageUrl: d.bannerImageUrl ?? null,
  }
}

/** PATCH-path normalizations: only arrived keys, 0 floors/limits → null. */
export function normalizeSellerCampaignPatch(d: SellerCampaignPatch) {
  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name
  if (d.type !== undefined) data.type = d.type
  if (d.value !== undefined) data.value = d.value
  if (d.maxDiscount !== undefined) data.maxDiscount = d.maxDiscount
  if (d.minOrderAmount !== undefined) data.minOrderAmount = d.minOrderAmount > 0 ? d.minOrderAmount : null
  if (d.usageLimit !== undefined) data.usageLimit = d.usageLimit > 0 ? d.usageLimit : null
  if (d.validFrom !== undefined) data.validFrom = d.validFrom
  if (d.validUntil !== undefined) data.validUntil = d.validUntil
  if (d.isActive !== undefined) data.isActive = d.isActive
  if (d.description !== undefined) data.description = d.description
  if (d.bannerImageUrl !== undefined) data.bannerImageUrl = d.bannerImageUrl
  return data
}

/** Seller-facing shape: the admin shape plus the banner. Lifecycle status is COMPUTED (never stored). */
export function shapeSellerCampaign(
  promotion: {
    id: string
    name: string
    description: string | null
    type: string
    value: number
    minOrderAmount: number | null
    maxDiscount: number | null
    usageLimit: number | null
    usedCount: number
    isActive: boolean
    validFrom: Date
    validUntil: Date
    createdAt: Date
    bannerImageUrl: string | null
  },
  pinned: Array<{ id: string; name: string }>
) {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    type: promotion.type,
    value: promotion.value,
    minOrderAmount: promotion.minOrderAmount,
    maxDiscount: promotion.maxDiscount,
    usageLimit: promotion.usageLimit,
    usedCount: promotion.usedCount,
    isActive: promotion.isActive,
    validFrom: promotion.validFrom.toISOString(),
    validUntil: promotion.validUntil.toISOString(),
    createdAt: promotion.createdAt.toISOString(),
    bannerImageUrl: promotion.bannerImageUrl,
    pinnedProducts: pinned,
  }
}

/**
 * Pin validation for the seller rail: every id must be one of THIS
 * supplier's products AND be sellable right now (active + approved).
 * The three refusal classes are distinguishable so the drill can prove
 * each — phantom ids, FOREIGN products, and the seller's own but
 * hidden/unapproved products are different honest errors.
 */
export async function validateOwnPinnedProducts(
  db: {
    products: {
      findMany: (args: {
        where: { id: { in: string[] } }
        select: { id: true; name: true; supplierId: true; isActive: true; isApproved: true }
      }) => Promise<Array<{ id: string; name: string; supplierId: string | null; isActive: boolean; isApproved: boolean }>>
    }
  },
  supplierProfileId: string,
  ids: string[]
) {
  const unique = [...new Set(ids)]
  const found = await db.products.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, supplierId: true, isActive: true, isApproved: true },
  })
  const foundById = new Map(found.map((p) => [p.id, p]))
  const phantom: string[] = []
  const foreign: string[] = []
  const unavailable: string[] = []
  const ok: Array<{ id: string; name: string }> = []
  for (const id of unique) {
    const p = foundById.get(id)
    if (!p) {
      phantom.push(id)
    } else if (p.supplierId !== supplierProfileId) {
      foreign.push(id)
    } else if (!p.isActive || !p.isApproved) {
      unavailable.push(id)
    } else {
      ok.push({ id: p.id, name: p.name })
    }
  }
  return { ok, phantom, foreign, unavailable }
}
