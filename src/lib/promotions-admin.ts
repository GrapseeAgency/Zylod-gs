import { z } from 'zod'

/**
 * Task 100 — admin promotion contract (shared by POST and PATCH so the two
 * routes can never drift).
 *
 * HONEST SCOPE: the pricing engine (src/lib/promotions.ts) computes exactly
 * two types — percentage and fixed. bogo / bundle / free_shipping are
 * refused at the boundary with the real reason: the platform never ships a
 * discount label it cannot compute. (The promotions.type column predates
 * the engine; the engine, not the column, is the contract.)
 *
 * usageLimit 0 means UNLIMITED and is normalized to null at the boundary.
 * minOrderAmount 0 means NO FLOOR and is normalized to null.
 * productIds requires at least one pin — a promotion pinning nothing can
 * never apply and would be dead weight.
 */
export const SUPPORTED_PROMOTION_TYPES = ['percentage', 'fixed'] as const

const typeField = z.enum(SUPPORTED_PROMOTION_TYPES, {
  message:
    "Unknown promotion type — the pricing engine computes 'percentage' and 'fixed' only; bogo, bundle and free_shipping are not supported",
})

export const promotionAdminObject = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    type: typeField,
    value: z.coerce.number().positive('Discount value must be greater than zero'),
    maxDiscount: z.coerce.number().min(0).nullable().optional(),
    // NOTE: no .default() here — under .partial() a default fires on ABSENT
    // keys, which silently paused live campaigns on unrelated PATCHes. The
    // POST path applies its defaults in normalizePromotionInput; PATCH only
    // ever touches keys that actually arrived.
    minOrderAmount: z.coerce.number().min(0).optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    isActive: z.boolean().optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    productIds: z.array(z.string().min(1)).min(1, 'Pin at least one product to this promotion'),
  })
  .strict()

/** POST shape: the full object with its cross-field rules. */
export const promotionAdminSchema = promotionAdminObject
  .refine((v) => v.validUntil > v.validFrom, {
    message: 'End date must be after the start date',
    path: ['validUntil'],
  })
  .refine((v) => v.type !== 'percentage' || v.value <= 100, {
    message: 'A percentage discount cannot exceed 100%',
    path: ['value'],
  })

export type PromotionAdminInput = z.infer<typeof promotionAdminSchema>

/** Normalizations + POST-path defaults: 0 floors/limits become "none", absent booleans default. */
export function normalizePromotionInput(d: PromotionAdminInput) {
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
  }
}

/** Admin-facing shape: campaign + computed lifecycle status + pin summary. */
export function shapePromotion(
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
  },
  pinned: Array<{ id: string; name: string }>
) {
  const now = new Date()
  const computedStatus = promotion.isActive
    ? now < promotion.validFrom
      ? 'scheduled'
      : now > promotion.validUntil
        ? 'ended'
        : 'live'
    : 'paused'
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
    computedStatus,
    pinnedProducts: pinned,
  }
}
